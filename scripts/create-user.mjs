#!/usr/bin/env node
// Break-glass / first-account CLI. Creates a user with no credentials and prints a single-use enrollment link.
// Runs on the server with the admin database role; there is no public setup page.
// Usage: npm run user:create -- "Display Name"        (new user + invite link)
//        npm run user:create -- --reset "Display Name" (revoke passkeys and sessions, print a re-enrollment link)
import pg from "pg";
import { loadEnv } from "./load-env.mjs";
import { createInvitedUser, createToken } from "../lib/auth/tokens.js";

loadEnv();
const args = process.argv.slice(2);
const reset = args.includes("--reset");
const name = args.filter((a) => !a.startsWith("--")).join(" ").trim();
if (!name) {
  console.error('usage: npm run user:create -- [--reset] "Display Name"');
  process.exit(2);
}
if (!process.env.DATABASE_URL_ADMIN || !process.env.APP_ORIGIN) {
  console.error("DATABASE_URL_ADMIN and APP_ORIGIN must be set");
  process.exit(1);
}

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL_ADMIN });
const actor = "cli";
try {
  let token;
  let userId;
  if (reset) {
    const { rows } = await db.query('SELECT id FROM auth."user" WHERE name = $1', [name]);
    if (rows.length !== 1) throw new Error(rows.length === 0 ? `No user named "${name}".` : `More than one user is named "${name}".`);
    userId = rows[0].id;
    await db.query('DELETE FROM auth.passkey WHERE "userId" = $1', [userId]);
    await db.query('DELETE FROM auth.session WHERE "userId" = $1', [userId]);
    token = await createToken(db, { userId, purpose: "reset", createdBy: actor });
  } else {
    ({ userId, token } = await createInvitedUser(db, { name, createdBy: actor }));
  }
  await db.query(
    "INSERT INTO auth.audit_log (actor, action, target_user_id, target_name) VALUES ($1, $2, $3, $4)",
    [actor, reset ? "reset-passkeys" : "create-user", userId, name],
  );
  console.log(`\n${reset ? "Re-enrollment" : "Invite"} link for ${name} (single use, expires in 72 hours):\n`);
  console.log(`  ${process.env.APP_ORIGIN}/join/${token}\n`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
