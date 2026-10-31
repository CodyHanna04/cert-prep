import "server-only";
import pg from "pg";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildAuthOptions } from "./config.js";
import { findValidToken } from "./tokens.js";

// Built on first use (not at import) so `next build` never needs runtime secrets, while a production
// server still fails on its first request if the environment is unsafe.
const g = globalThis;

export function getAuth() {
  if (!g.__certprepAuth) {
    const url = process.env.DATABASE_URL_AUTH;
    if (!url) throw new Error("DATABASE_URL_AUTH is not set");
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    g.__certprepAuthPool = pool;
    // nextCookies must be last so it can set cookies from server actions.
    g.__certprepAuth = betterAuth(buildAuthOptions(process.env, pool, [nextCookies()]));
  }
  return g.__certprepAuth;
}

/** Who an enrollment link belongs to (without using it up), or null if it is invalid, used or expired. */
export async function lookupEnrollmentToken(token) {
  getAuth();
  return findValidToken(g.__certprepAuthPool, token);
}

/** The signed-in user ({ id, name }) or null. */
export async function getCurrentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, name: session.user.name } : null;
}

/** For pages and actions that need a user: redirects to sign-in when there is none. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/**
 * Permanently deletes the signed-in user's account. Foreign keys cascade to sessions, passkeys and every
 * app row they own. Only ever called with the current session's user id.
 */
export async function deleteAccount(userId) {
  getAuth();
  await g.__certprepAuthPool.query('DELETE FROM auth."user" WHERE id = $1', [userId]);
}
