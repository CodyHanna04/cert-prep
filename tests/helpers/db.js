import pg from "pg";
import { fileURLToPath } from "node:url";
import { migrate } from "../../lib/db/migrate.js";
import { makeWithUser } from "../../lib/db/with-user.js";

process.loadEnvFile?.(".env");

const MIGRATIONS = fileURLToPath(new URL("../../migrations", import.meta.url));
const testDb = process.env.TEST_DB_NAME ?? "certprep_test";

function urlFor(envName) {
  const u = new URL(process.env[envName]);
  u.pathname = `/${testDb}`;
  return u.toString();
}

/** Connects as each role to the throwaway test database and rebuilds the schema from migrations. */
export async function setupTestDb() {
  const owner = new pg.Client({ connectionString: urlFor("DATABASE_URL_OWNER") });
  await owner.connect();
  await owner.query("DROP SCHEMA IF EXISTS app CASCADE");
  await owner.query("DROP SCHEMA IF EXISTS auth CASCADE");
  await owner.query("DROP TABLE IF EXISTS public.schema_migrations");
  await migrate(owner, MIGRATIONS);

  const appPool = new pg.Pool({ connectionString: urlFor("DATABASE_URL_APP"), max: 4 });
  const authPool = new pg.Pool({ connectionString: urlFor("DATABASE_URL_AUTH"), max: 2 });
  const adminPool = new pg.Pool({ connectionString: urlFor("DATABASE_URL_ADMIN"), max: 2 });
  return {
    owner,
    appPool,
    authPool,
    adminPool,
    withUser: makeWithUser(appPool),
    async createUser(name = "user") {
      const { rows } = await owner.query(
        `INSERT INTO auth."user" (name, email) VALUES ($1, $2) RETURNING id`,
        [name, `${name}-${Math.random().toString(36).slice(2)}@users.invalid`],
      );
      return rows[0].id;
    },
    async close() {
      await Promise.all([appPool.end(), authPool.end(), adminPool.end()]);
      await owner.end();
    },
  };
}
