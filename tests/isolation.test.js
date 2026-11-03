import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "./helpers/db.js";

/**
 * Isolation suite (T-008): one user can never read or write another user's rows.
 * Runs against real Postgres with the production migrations and the production roles.
 */
let t;
let alice;
let bob;
let aliceExam;

beforeAll(async () => {
  t = await setupTestDb();
  alice = await t.createUser("alice");
  bob = await t.createUser("bob");
  aliceExam = await t.withUser(alice, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO exam (user_id, code, name, vendor) VALUES ($1, 'X-1', 'Alice exam', 'V') RETURNING id`,
      [alice],
    );
    return rows[0].id;
  });
});

afterAll(async () => {
  await t?.close();
});

describe("schema guards", () => {
  it("every table in schema app has user_id NOT NULL, RLS enabled and forced, and a policy", async () => {
    const { rows: tables } = await t.owner.query(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'app' AND c.relkind = 'r'`,
    );
    expect(tables.length).toBeGreaterThan(0);
    for (const tbl of tables) {
      expect(tbl.relrowsecurity, `${tbl.relname} RLS enabled`).toBe(true);
      expect(tbl.relforcerowsecurity, `${tbl.relname} RLS forced`).toBe(true);
      const { rows: col } = await t.owner.query(
        `SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'app' AND table_name = $1 AND column_name = 'user_id'`,
        [tbl.relname],
      );
      expect(col[0]?.is_nullable, `${tbl.relname}.user_id NOT NULL`).toBe("NO");
      const { rows: pol } = await t.owner.query(
        `SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = $1`,
        [tbl.relname],
      );
      expect(pol.length, `${tbl.relname} has a policy`).toBeGreaterThan(0);
    }
  });

  it("app_user has no BYPASSRLS and is not a superuser", async () => {
    const { rows } = await t.owner.query(
      `SELECT rolname, rolbypassrls, rolsuper FROM pg_roles
        WHERE rolname IN ('app_user', 'auth_app', 'admin_app')`,
    );
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.rolbypassrls, r.rolname).toBe(false);
      expect(r.rolsuper, r.rolname).toBe(false);
    }
  });
});

describe("cross-user access", () => {
  it("another user sees none of Alice's rows", async () => {
    const seen = await t.withUser(bob, (db) => db.query("SELECT id FROM exam"));
    expect(seen.rows).toHaveLength(0);
    const mine = await t.withUser(alice, (db) => db.query("SELECT id FROM exam"));
    expect(mine.rows).toHaveLength(1);
  });

  it("cannot read another user's row by id", async () => {
    const r = await t.withUser(bob, (db) => db.query("SELECT id FROM exam WHERE id = $1", [aliceExam]));
    expect(r.rows).toHaveLength(0);
  });

  it("cannot update or delete another user's rows (0 rows affected)", async () => {
    const upd = await t.withUser(bob, (db) =>
      db.query("UPDATE exam SET name = 'hacked' WHERE id = $1", [aliceExam]),
    );
    expect(upd.rowCount).toBe(0);
    const del = await t.withUser(bob, (db) => db.query("DELETE FROM exam WHERE id = $1", [aliceExam]));
    expect(del.rowCount).toBe(0);
    const still = await t.withUser(alice, (db) => db.query("SELECT name FROM exam WHERE id = $1", [aliceExam]));
    expect(still.rows[0].name).toBe("Alice exam");
  });

  it("cannot insert a row owned by someone else", async () => {
    await expect(
      t.withUser(bob, (db) =>
        db.query(`INSERT INTO exam (user_id, code, name, vendor) VALUES ($1, 'Y', 'n', 'v')`, [alice]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot reassign a row to another user", async () => {
    await expect(
      t.withUser(alice, (db) => db.query("UPDATE exam SET user_id = $1 WHERE id = $2", [bob, aliceExam])),
    ).rejects.toThrow(/row-level security/);
  });

  it("every app table hides Alice's rows from Bob (generated from the catalog)", async () => {
    // Give Alice one row in each table through the owner (RLS applies to owner too, so use her context).
    await t.withUser(alice, async (db) => {
      const dom = (
        await db.query(
          `INSERT INTO domain (user_id, exam_id, key, name, weight_pct) VALUES ($1,$2,'d1','D',100) RETURNING id`,
          [alice, aliceExam],
        )
      ).rows[0].id;
      const obj = (
        await db.query(
          `INSERT INTO objective (user_id, exam_id, domain_id, code, title) VALUES ($1,$2,$3,'1.1','O') RETURNING id`,
          [alice, aliceExam, dom],
        )
      ).rows[0].id;
      const q = (
        await db.query(
          `INSERT INTO question (user_id, exam_id, domain_id, objective_id, type, stem, options, content_hash)
           VALUES ($1,$2,$3,$4,'single','s','[]','h') RETURNING id`,
          [alice, aliceExam, dom, obj],
        )
      ).rows[0].id;
      await db.query(`INSERT INTO question_mark (user_id, question_id, kind) VALUES ($1,$2,'flag')`, [alice, q]);
      await db.query(`INSERT INTO note (user_id, question_id, body) VALUES ($1,$2,'n')`, [alice, q]);
      const s = (
        await db.query(`INSERT INTO session (user_id, exam_id, mode) VALUES ($1,$2,'practice') RETURNING id`, [
          alice,
          aliceExam,
        ])
      ).rows[0].id;
      await db.query(
        `INSERT INTO response (user_id, session_id, question_id, selected_option_ids, is_correct)
         VALUES ($1,$2,$3,'[]',true)`,
        [alice, s, q],
      );
      await db.query(`INSERT INTO user_pref (user_id, theme) VALUES ($1, 'ledger')`, [alice]);
    });

    const { rows: tables } = await t.owner.query(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'app' AND c.relkind = 'r'`,
    );
    for (const { relname } of tables) {
      const a = await t.withUser(alice, (db) => db.query(`SELECT count(*)::int AS n FROM app."${relname}"`));
      const b = await t.withUser(bob, (db) => db.query(`SELECT count(*)::int AS n FROM app."${relname}"`));
      expect(a.rows[0].n, `${relname}: Alice sees her row`).toBeGreaterThan(0);
      expect(b.rows[0].n, `${relname}: Bob sees none`).toBe(0);
    }
  });
});

describe("fail closed", () => {
  it("with no user context, app_user sees nothing and cannot insert", async () => {
    const c = await t.appPool.connect();
    try {
      const r = await c.query("SELECT count(*)::int AS n FROM exam");
      expect(r.rows[0].n).toBe(0);
      await expect(
        c.query(`INSERT INTO exam (user_id, code, name, vendor) VALUES ($1, 'Z', 'n', 'v')`, [alice]),
      ).rejects.toThrow(/row-level security/);
    } finally {
      c.release();
    }
  });

  it("a malformed user id is rejected before touching the database", async () => {
    await expect(t.withUser("not-a-uuid", async () => 1)).rejects.toThrow(/user id/);
    await expect(t.withUser(undefined, async () => 1)).rejects.toThrow(/user id/);
  });
});

describe("pooled connections", () => {
  it("user context does not leak to the next caller of the same connection", async () => {
    const onePool = new (await import("pg")).default.Pool({
      connectionString: t.appPool.options.connectionString,
      max: 1,
    });
    try {
      const { makeWithUser } = await import("../lib/db/with-user.js");
      const withUser = makeWithUser(onePool);
      const first = await withUser(alice, (db) => db.query("SELECT count(*)::int AS n FROM exam"));
      expect(first.rows[0].n).toBe(1);
      // Same physical connection, no context: must see nothing.
      const c = await onePool.connect();
      try {
        const r = await c.query("SELECT count(*)::int AS n FROM exam");
        expect(r.rows[0].n).toBe(0);
        const setting = await c.query("SELECT current_setting('app.user_id', true) AS v");
        expect([null, ""]).toContain(setting.rows[0].v);
      } finally {
        c.release();
      }
      // And a different user on that connection sees only their own rows.
      const second = await withUser(bob, (db) => db.query("SELECT count(*)::int AS n FROM exam"));
      expect(second.rows[0].n).toBe(0);
    } finally {
      await onePool.end();
    }
  });

  it("a failed transaction does not leave context behind", async () => {
    await expect(
      t.withUser(alice, async (db) => {
        await db.query("SELECT 1");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const r = await t.withUser(bob, (db) => db.query("SELECT count(*)::int AS n FROM exam"));
    expect(r.rows[0].n).toBe(0);
  });
});

describe("role separation", () => {
  it("app_user cannot read auth tables", async () => {
    await expect(t.appPool.query('SELECT * FROM auth."user"')).rejects.toThrow(/permission denied/);
  });

  it("auth_app and admin_app cannot read app tables", async () => {
    await expect(t.authPool.query("SELECT * FROM app.exam")).rejects.toThrow(/permission denied/);
    await expect(t.adminPool.query("SELECT * FROM app.exam")).rejects.toThrow(/permission denied/);
  });

  it("app_user cannot create objects or change policies", async () => {
    await expect(t.appPool.query("CREATE TABLE app.evil (id int)")).rejects.toThrow(/permission denied/);
    await expect(t.appPool.query("ALTER TABLE app.exam DISABLE ROW LEVEL SECURITY")).rejects.toThrow(
      /must be owner/,
    );
  });
});

describe("account deletion", () => {
  it("deleting a user from the auth side removes every row they own, and only theirs", async () => {
    const carol = await t.createUser("carol");
    const dave = await t.createUser("dave");
    for (const u of [carol, dave]) {
      await t.withUser(u, (db) =>
        db.query(`INSERT INTO exam (user_id, code, name, vendor) VALUES ($1, 'C', 'n', 'v')`, [u]),
      );
    }
    // admin_app has no access to app tables, but the FK cascade must still clean them up.
    await t.adminPool.query('DELETE FROM auth."user" WHERE id = $1', [carol]);
    const c = await t.withUser(carol, (db) => db.query("SELECT count(*)::int AS n FROM exam"));
    const d = await t.withUser(dave, (db) => db.query("SELECT count(*)::int AS n FROM exam"));
    expect(c.rows[0].n).toBe(0);
    expect(d.rows[0].n).toBe(1);
  });
});
