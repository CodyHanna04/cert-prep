import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { setupTestDb } from "./helpers/db.js";
import { VirtualAuthenticator } from "./helpers/virtual-authenticator.js";
import { assertSafeEnv, buildAuthOptions, devPasswordLoginEnabled } from "../lib/auth/config.js";
import { createInvitedUser, createToken, findValidToken } from "../lib/auth/tokens.js";

const ORIGIN = "http://localhost:3000";
const env = {
  NODE_ENV: "test",
  APP_ORIGIN: ORIGIN,
  PASSKEY_RP_ID: "localhost",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
};

let t;
let auth;

/** Calls the auth handler like the HTTP layer would, carrying cookies between calls. */
function client() {
  let cookies = {};
  const cookieHeader = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  return {
    async call(path, { method = "GET", body } = {}) {
      const res = await auth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
          method,
          headers: { origin: ORIGIN, "content-type": "application/json", cookie: cookieHeader() },
          body: body ? JSON.stringify(body) : undefined,
        }),
      );
      for (const sc of res.headers.getSetCookie()) {
        const [pair] = sc.split(";");
        const i = pair.indexOf("=");
        const name = pair.slice(0, i);
        const value = pair.slice(i + 1);
        if (/max-age=0/i.test(sc) || value === "") delete cookies[name];
        else cookies[name] = value;
      }
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: res.status, json, text };
    },
    hasSession: () => Object.keys(cookies).some((k) => k.includes("session_token")),
  };
}

async function register(token, authenticator, { name = "My laptop" } = {}) {
  const c = client();
  const opts = await c.call(`/passkey/generate-register-options?context=${encodeURIComponent(token ?? "")}`);
  if (opts.status !== 200) return { c, step: "options", ...opts };
  const verified = await c.call("/passkey/verify-registration", {
    method: "POST",
    body: { response: authenticator.createCredential(opts.json), name, createSession: true },
  });
  return { c, step: "verify", ...verified };
}

async function signIn(authenticator) {
  const c = client();
  const opts = await c.call("/passkey/generate-authenticate-options");
  const res = await c.call("/passkey/verify-authentication", {
    method: "POST",
    body: { response: authenticator.getAssertion(opts.json) },
  });
  return { c, ...res };
}

beforeAll(async () => {
  t = await setupTestDb();
  // Rate limits are exercised in their own test; the rest would trip them by sharing one (absent) client IP.
  auth = betterAuth(buildAuthOptions(env, t.authPool, [], { rateLimit: { enabled: false } }));
});
afterAll(async () => t?.close());

describe("rate limiting", () => {
  it("is backed by the database and answers 429 when a client hammers an auth endpoint", async () => {
    const limited = betterAuth(buildAuthOptions(env, t.authPool));
    const hit = () =>
      limited.handler(
        new Request(`${ORIGIN}/api/auth/passkey/verify-authentication`, {
          method: "POST",
          headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
          body: JSON.stringify({ response: {} }),
        }),
      );
    const statuses = [];
    for (let i = 0; i < 14; i++) statuses.push((await hit()).status);
    expect(statuses).toContain(429);
    const { rows } = await t.owner.query('SELECT count FROM auth."rateLimit"');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("passkey-first onboarding", () => {
  it("an invite lets a new user enroll a passkey and signs them in", async () => {
    const { userId, token } = await createInvitedUser(t.adminPool, { name: "Ada", createdBy: "test" });
    const authn = new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" });

    const r = await register(token, authn);
    expect(r.status, r.text).toBe(200);
    expect(r.c.hasSession()).toBe(true);

    const session = await r.c.call("/get-session");
    expect(session.json.user.id).toBe(userId);
    expect(session.json.user.name).toBe("Ada");

    const { rows } = await t.owner.query('SELECT "userId", name FROM auth.passkey WHERE "userId" = $1', [userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("My laptop");
  });

  it("the invite is single-use", async () => {
    const { token } = await createInvitedUser(t.adminPool, { name: "Bea", createdBy: "test" });
    expect((await register(token, new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" }))).status).toBe(200);
    expect(await findValidToken(t.authPool, token)).toBeNull();
    const again = await register(token, new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" }));
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(again.c.hasSession()).toBe(false);
  });

  it("two attempts racing on one invite create only one passkey", async () => {
    const { userId, token } = await createInvitedUser(t.adminPool, { name: "Race", createdBy: "test" });
    const results = await Promise.all([
      register(token, new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" })),
      register(token, new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" })),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const { rows } = await t.owner.query('SELECT 1 FROM auth.passkey WHERE "userId" = $1', [userId]);
    expect(rows).toHaveLength(1);
  });

  it("expired and made-up tokens are rejected", async () => {
    const { userId } = await createInvitedUser(t.adminPool, { name: "Cy", createdBy: "test" });
    const expired = await createToken(t.adminPool, { userId, purpose: "reset", createdBy: "test", ttlHours: -1 });
    for (const token of [expired, "x".repeat(43), "", null]) {
      const r = await register(token, new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" }));
      expect(r.status, String(token)).toBeGreaterThanOrEqual(400);
      expect(r.c.hasSession()).toBe(false);
    }
  });

  it("an anonymous visitor cannot enroll a passkey", async () => {
    const c = client();
    const res = await c.call("/passkey/generate-register-options");
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("registration without user verification is refused", async () => {
    const { userId, token } = await createInvitedUser(t.adminPool, { name: "Di", createdBy: "test" });
    const r = await register(token, new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost", userVerified: false }));
    expect(r.status).toBeGreaterThanOrEqual(400);
    const { rows } = await t.owner.query('SELECT 1 FROM auth.passkey WHERE "userId" = $1', [userId]);
    expect(rows).toHaveLength(0);
  });

  it("registration from a different origin is refused", async () => {
    const { token } = await createInvitedUser(t.adminPool, { name: "Eve", createdBy: "test" });
    const r = await register(token, new VirtualAuthenticator({ origin: "https://evil.example", rpId: "localhost" }));
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe("sign-in and sessions", () => {
  let authn;
  let userId;

  beforeAll(async () => {
    const invite = await createInvitedUser(t.adminPool, { name: "Finn", createdBy: "test" });
    userId = invite.userId;
    authn = new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" });
    expect((await register(invite.token, authn)).status).toBe(200);
  });

  it("signs in with the registered passkey", async () => {
    const r = await signIn(authn);
    expect(r.status, r.text).toBe(200);
    expect((await r.c.call("/get-session")).json.user.id).toBe(userId);
  });

  it("a signed-in user can add a second passkey, listed on their account", async () => {
    const first = await signIn(authn);
    const second = new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" });
    const opts = await first.c.call("/passkey/generate-register-options");
    expect(opts.status).toBe(200);
    const done = await first.c.call("/passkey/verify-registration", {
      method: "POST",
      body: { response: second.createCredential(opts.json), name: "Phone" },
    });
    expect(done.status, done.text).toBe(200);
    const list = await first.c.call("/passkey/list-user-passkeys");
    expect(list.json.map((p) => p.name).sort()).toEqual(["My laptop", "Phone"]);
  });

  it("the last passkey cannot be removed, but a spare can", async () => {
    const solo = new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" });
    const invite = await createInvitedUser(t.adminPool, { name: "Hal", createdBy: "test" });
    const reg = await register(invite.token, solo);
    expect(reg.status).toBe(200);
    const list = await reg.c.call("/passkey/list-user-passkeys");
    const onlyId = list.json[0].id;
    const refused = await reg.c.call("/passkey/delete-passkey", { method: "POST", body: { id: onlyId } });
    expect(refused.status).toBe(400);

    const spare = new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" });
    const opts = await reg.c.call("/passkey/generate-register-options");
    expect((await reg.c.call("/passkey/verify-registration", { method: "POST", body: { response: spare.createCredential(opts.json), name: "Spare" } })).status).toBe(200);
    const both = (await reg.c.call("/passkey/list-user-passkeys")).json;
    expect(both).toHaveLength(2);
    const ok = await reg.c.call("/passkey/delete-passkey", { method: "POST", body: { id: both.find((p) => p.name === "Spare").id } });
    expect(ok.status, ok.text).toBe(200);
  });

  it("sign-in without user verification is refused", async () => {
    const lax = new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" });
    const invite = await createInvitedUser(t.adminPool, { name: "Gus", createdBy: "test" });
    expect((await register(invite.token, lax)).status).toBe(200);
    lax.userVerified = false;
    const r = await signIn(lax);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.c.hasSession()).toBe(false);
  });

  it("an unknown credential cannot sign in", async () => {
    const stranger = new VirtualAuthenticator({ origin: ORIGIN, rpId: "localhost" });
    const r = await signIn(stranger);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.c.hasSession()).toBe(false);
  });

  it("sign out ends the session", async () => {
    const r = await signIn(authn);
    expect((await r.c.call("/sign-out", { method: "POST", body: {} })).status).toBe(200);
    expect((await r.c.call("/get-session")).json).toBeNull();
  });
});

describe("the public surface is passkey-only", () => {
  it("email sign-up, sign-in and password reset are off in a production configuration", async () => {
    const prodEnv = { ...env, NODE_ENV: "production", APP_ORIGIN: "https://study.codycodez.com", PASSKEY_RP_ID: "study.codycodez.com" };
    const prod = betterAuth(buildAuthOptions(prodEnv, t.authPool));
    for (const [path, method] of [["/sign-up/email", "POST"], ["/sign-in/email", "POST"], ["/request-password-reset", "POST"], ["/delete-user", "POST"]]) {
      const res = await prod.handler(
        new Request(`https://study.codycodez.com/api/auth${path}`, {
          method,
          headers: { origin: "https://study.codycodez.com", "content-type": "application/json" },
          body: JSON.stringify({ email: "a@b.co", password: "password123", name: "x" }),
        }),
      );
      expect(res.status, path).toBeGreaterThanOrEqual(400);
      expect(res.status, path).not.toBe(200);
    }
    const { rows } = await t.owner.query(`SELECT 1 FROM auth."user" WHERE email = 'a@b.co'`);
    expect(rows).toHaveLength(0);
  });
});

describe("dev-only password login guards", () => {
  const dev = { ...env, ALLOW_DEV_PASSWORD_LOGIN: "true" };

  it("is enabled only outside production, with the flag, on localhost", () => {
    expect(devPasswordLoginEnabled(dev)).toBe(true);
    expect(devPasswordLoginEnabled({ ...dev, ALLOW_DEV_PASSWORD_LOGIN: "false" })).toBe(false);
    expect(devPasswordLoginEnabled({ ...dev, NODE_ENV: "production" })).toBe(false);
    expect(devPasswordLoginEnabled({ ...dev, APP_ORIGIN: "https://study.codycodez.com" })).toBe(false);
    expect(devPasswordLoginEnabled(env)).toBe(false);
  });

  it("a production server refuses to boot while the flag exists", () => {
    const prod = { ...env, NODE_ENV: "production", APP_ORIGIN: "https://study.codycodez.com", PASSKEY_RP_ID: "study.codycodez.com" };
    expect(() => assertSafeEnv(prod)).not.toThrow();
    expect(() => assertSafeEnv({ ...prod, ALLOW_DEV_PASSWORD_LOGIN: "false" })).toThrow(/must not exist/);
    expect(() => assertSafeEnv({ ...prod, APP_ORIGIN: "http://study.codycodez.com" })).toThrow(/https/);
    expect(() => assertSafeEnv({ ...prod, BETTER_AUTH_SECRET: "short" })).toThrow(/32/);
  });

  it("password sign-in works on localhost dev when enabled, and a user created that way gets a session", async () => {
    const devAuth = betterAuth(buildAuthOptions(dev, t.authPool));
    await devAuth.api.signUpEmail({ body: { email: "dev@users.invalid", password: "correct horse battery", name: "Dev" } });
    const res = await devAuth.handler(
      new Request(`${ORIGIN}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ email: "dev@users.invalid", password: "correct horse battery" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token"))).toBe(true);
  });
});
