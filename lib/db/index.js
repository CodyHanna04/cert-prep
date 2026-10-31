import "server-only";
import pg from "pg";
import { makeWithUser } from "./with-user.js";

// One pool per server process (reused across dev hot reloads).
const globalForPool = globalThis;

function appPool() {
  if (!globalForPool.__certprepAppPool) {
    const url = process.env.DATABASE_URL_APP;
    if (!url) throw new Error("DATABASE_URL_APP is not set");
    globalForPool.__certprepAppPool = new pg.Pool({ connectionString: url, max: 10 });
  }
  return globalForPool.__certprepAppPool;
}

/**
 * Runs `fn` in a transaction scoped to `userId` (row-level security applies).
 * This module is the only place that holds the app database pool.
 */
export function withUser(userId, fn) {
  return makeWithUser(appPool())(userId, fn);
}
