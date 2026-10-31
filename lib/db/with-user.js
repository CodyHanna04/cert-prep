import pg from "pg";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Builds the only way application code touches app tables: a transaction whose
 * `app.user_id` setting drives the row-level-security policies. The setting is
 * transaction-local, so it cannot leak to the next user of a pooled connection.
 * @param {pg.Pool} pool a pool connected as the `app_user` role
 */
export function makeWithUser(pool) {
  /**
   * @template T
   * @param {string} userId
   * @param {(db: pg.PoolClient) => Promise<T>} fn
   * @returns {Promise<T>}
   */
  return async function withUser(userId, fn) {
    if (typeof userId !== "string" || !UUID_RE.test(userId)) {
      throw new Error("withUser requires a user id (uuid)");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  };
}
