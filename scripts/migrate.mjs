#!/usr/bin/env node
// Usage: npm run db:migrate   (uses DATABASE_URL_OWNER; loads .env / .env.local if present)
import pg from "pg";
import { fileURLToPath } from "node:url";
import { migrate } from "../lib/db/migrate.js";
import { loadEnv } from "./load-env.mjs";

loadEnv();
const url = process.env.DATABASE_URL_OWNER;
if (!url) {
  console.error("DATABASE_URL_OWNER is not set");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const ran = await migrate(client, fileURLToPath(new URL("../migrations", import.meta.url)));
  console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Nothing to apply.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
