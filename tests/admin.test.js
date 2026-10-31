import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { setupTestDb } from "./helpers/db.js";
import { VirtualAuthenticator } from "./helpers/virtual-authenticator.js";
import { adminFromHeaders, assertAdminEnv } from "../lib/admin/identity.js";
import { deleteUser, inviteUser, listAudit, listUsers, resetPasskeys, revokeSessions } from "../lib/admin/store.js";
import { buildAuthOptions } from "../lib/auth/config.js";
import { findValidToken } from "../lib/auth/tokens.js";

const ORIGIN = "http://localhost:3000";
const env = { NODE_ENV: "test", APP_ORIGIN: ORIGIN, PASSKEY_RP_ID: "localhost", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123" };

const hdr = (login) => new Headers(login ? { "tailscale-user-login": login } : {});
const adminEnv = { APP_MODE: "admin", ADMIN_TAILSCALE_LOGINS: "Cody@example.com, other@example.com", DATABASE_URL_ADMIN: "x", PUBLIC_ORIGIN: "https://study.codycodez.com" };

describe("admin identity", () => {
  it("accepts only allowlisted Tailscale logins, in admin mode only", () => {
    expect(adminFromHeaders(hdr("cody@example.com"), adminEnv)).toBe("cody@example.com");
    expect(adminFromHeaders(hdr("CODY@example.com"), adminEnv)).toBe("cody@example.com");
    expect(adminFromHeaders(hdr("stranger@example.com"), adminEnv)).toBeNull();
    expect(adminFromHeaders(hdr(null), adminEnv)).toBeNull();
    expect(adminFromHeaders(hdr("cody@example.com"), { ...adminEnv, APP_MODE: "web" })).toBeNull();
    expect(adminFromHeaders(hdr("cody@example.com"), { ...adminEnv, ADMIN_TAILSCALE_LOGINS: "" })).toBeNull();
  });

  it("deployment checks: admin needs an allowlist; the public site must not hold admin credentials", () => {
    expect(() => assertAdminEnv(adminEnv)).not.toThrow();
    expect(() => assertAdminEnv({ ...adminEnv, ADMIN_TAILSCALE_LOGINS: "" })).toThrow(/at least one/);
    expect(() => assertAdminEnv({ APP_MODE: "web", NODE_ENV: "production", DATABASE_URL_ADMIN: "x" })).toThrow(/must not have/);
    expect(() => assertAdminEnv({ APP_MODE: "web", NODE_ENV: "production" })).not.toThrow();
  });
});

describe("admin store", () => {
  let t;
  let auth;
  beforeAll(async () => {
    t = await setupTestDb();
    auth = betterAuth(buildAuthOptions(env, t.authPool, [], { rateLimit: { enabled: false } }));
  });
  afterAll(async () => t?.close());

  async function enroll(token) {
    const authn = new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" });
    const call = (path, init) => auth.handler(new Request(`${ORIGIN}/api/auth${path}`, { ...init, headers: { origin: ORIGIN, "content-type": "application/json", ...(init?.headers ?? {}) } }));
    const opts = await call(`/passkey/generate-register-options?context=${token}`);
    const cookie = opts.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const body = await opts.json();
    const done = await call("/passkey/verify-registration", { method: "POST", headers: { cookie }, body: JSON.stringify({ response: authn.createCredential(body), name: "dev", createSession: true }) });
    return { status: done.status, authn };
  }

  it("invite -> enroll -> reset -> old passkeys and sessions are gone, new link works once", async () => {
    const { userId, token } = await inviteUser(t.adminPool, "cody@example.com", "Ada");
    expect((await enroll(token)).status).toBe(200);
    let users = await listUsers(t.adminPool);
    expect(users.find((u) => u.id === userId)).toMatchObject({ passkeys: 1, sessions: 1 });

    await expect(resetPasskeys(t.adminPool, "cody@example.com", userId, "wrong name")).rejects.toThrow(/does not match/);
    expect((await listUsers(t.adminPool)).find((u) => u.id === userId).passkeys).toBe(1);

    const { token: reset } = await resetPasskeys(t.adminPool, "cody@example.com", userId, "Ada");
    users = await listUsers(t.adminPool);
    expect(users.find((u) => u.id === userId)).toMatchObject({ passkeys: 0, sessions: 0, pending_link: true });
    expect(await findValidToken(t.authPool, reset)).toMatchObject({ userId, purpose: "reset" });

    expect((await enroll(reset)).status).toBe(200);
    expect((await enroll(reset)).status).toBeGreaterThanOrEqual(400);
  });

  it("a newer reset link invalidates the older one", async () => {
    const { userId } = await inviteUser(t.adminPool, "cody@example.com", "Bo");
    const first = (await resetPasskeys(t.adminPool, "cody@example.com", userId, "Bo")).token;
    const second = (await resetPasskeys(t.adminPool, "cody@example.com", userId, "Bo")).token;
    expect(await findValidToken(t.authPool, first)).toBeNull();
    expect(await findValidToken(t.authPool, second)).not.toBeNull();
  });

  it("deleting a user needs their typed name and removes their study data", async () => {
    const { userId } = await inviteUser(t.adminPool, "cody@example.com", "Cy");
    await t.withUser(userId, (db) => db.query("INSERT INTO exam (user_id, code, name, vendor) VALUES ($1,'X','n','v')", [userId]));
    await expect(deleteUser(t.adminPool, "cody@example.com", userId, "nope")).rejects.toThrow();
    await deleteUser(t.adminPool, "cody@example.com", userId, "Cy");
    expect((await listUsers(t.adminPool)).some((u) => u.id === userId)).toBe(false);
    const { rows } = await t.owner.query("SELECT 1 FROM auth.audit_log WHERE action = 'delete-user' AND target_name = 'Cy'");
    expect(rows).toHaveLength(1);
  });

  it("revoking sessions signs the user out everywhere", async () => {
    const { userId, token } = await inviteUser(t.adminPool, "cody@example.com", "Di");
    await enroll(token);
    await revokeSessions(t.adminPool, "cody@example.com", userId);
    expect((await listUsers(t.adminPool)).find((u) => u.id === userId).sessions).toBe(0);
  });

  it("the audit log records who did what, and cannot be edited or deleted by the admin role", async () => {
    const log = await listAudit(t.adminPool);
    expect(log.some((l) => l.action === "reset-passkeys" && l.actor === "cody@example.com")).toBe(true);
    await expect(t.adminPool.query("UPDATE auth.audit_log SET actor = 'x'")).rejects.toThrow(/permission denied/);
    await expect(t.adminPool.query("DELETE FROM auth.audit_log")).rejects.toThrow(/permission denied/);
  });

  it("the public site's database role cannot read the audit log or mint invites", async () => {
    await expect(t.authPool.query("SELECT * FROM auth.audit_log")).rejects.toThrow(/permission denied/);
    await expect(t.authPool.query("INSERT INTO auth.invite_token (user_id, purpose, token_hash, expires_at, created_by) VALUES (gen_random_uuid(), 'invite', 'h', now(), 'x')")).rejects.toThrow(/permission denied/);
  });
});
