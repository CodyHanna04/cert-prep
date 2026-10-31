import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCK_ID = 727274; // arbitrary constant: one migrator at a time

/**
 * Applies numbered `NNNN_name.sql` files in order, once each.
 * Each file runs in its own transaction. Applied files are checksummed:
 * editing one after it was applied is an error (write a new migration instead).
 * @param {import("pg").Client} client connected as the owner role
 * @param {string} dir migrations directory
 * @returns {Promise<string[]>} names applied in this run
 */
export async function migrate(client, dir) {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query("SELECT name, checksum FROM public.schema_migrations");
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));

    const files = readdirSync(dir)
      .filter((f) => /^\d{4}_.+\.sql$/.test(f))
      .sort();
    const ran = [];
    for (const file of files) {
      const sql = readFileSync(join(dir, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      if (applied.has(file)) {
        if (applied.get(file) !== checksum) {
          throw new Error(`Migration ${file} was edited after it was applied. Add a new migration.`);
        }
        continue;
      }
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)", [
          file,
          checksum,
        ]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${e.message}`);
      }
      ran.push(file);
    }
    return ran;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
  }
}
