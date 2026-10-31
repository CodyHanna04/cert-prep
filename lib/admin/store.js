import { createInvitedUser, createToken } from "../auth/tokens.js";

/**
 * Admin operations. `db` is a pg Pool connected as the admin_app role: it can touch the auth schema and the audit
 * log, never study data. Every change writes an audit row in the same transaction.
 */

async function inTx(db, fn) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

const audit = (c, actor, action, user, detail = {}) =>
  c.query("INSERT INTO auth.audit_log (actor, action, target_user_id, target_name, detail) VALUES ($1,$2,$3,$4,$5)", [
    actor,
    action,
    user?.id ?? null,
    user?.name ?? null,
    JSON.stringify(detail),
  ]);

export async function listUsers(db) {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u."createdAt",
            (SELECT count(*)::int FROM auth.passkey p WHERE p."userId" = u.id) AS passkeys,
            (SELECT max(s."updatedAt") FROM auth.session s WHERE s."userId" = u.id) AS last_seen,
            (SELECT count(*)::int FROM auth.session s WHERE s."userId" = u.id AND s."expiresAt" > now()) AS sessions,
            EXISTS (SELECT 1 FROM auth.invite_token t WHERE t.user_id = u.id AND t.used_at IS NULL AND t.expires_at > now()) AS pending_link
       FROM auth."user" u ORDER BY u."createdAt"`,
  );
  return rows;
}

/** New user + first-passkey link. Returns the raw token (show once). */
export async function inviteUser(db, actor, name) {
  const clean = name.trim();
  if (!clean || clean.length > 80) throw new Error("Give a display name (up to 80 characters).");
  return inTx(db, async (c) => {
    const { userId, token } = await createInvitedUser(c, { name: clean, createdBy: actor });
    await audit(c, actor, "create-user", { id: userId, name: clean });
    return { userId, token };
  });
}

async function userById(c, id) {
  const { rows } = await c.query('SELECT id, name FROM auth."user" WHERE id = $1', [id]);
  if (rows.length === 0) throw new Error("No such user.");
  return rows[0];
}

/** Removes every passkey and session of the user and issues a single-use re-enrollment link. */
export async function resetPasskeys(db, actor, userId, typedName) {
  return inTx(db, async (c) => {
    const user = await userById(c, userId);
    if (typedName.trim() !== user.name) throw new Error("The name you typed does not match.");
    await c.query('DELETE FROM auth.passkey WHERE "userId" = $1', [userId]);
    await c.query('DELETE FROM auth.session WHERE "userId" = $1', [userId]);
    // Older unused links stop working once a newer one exists.
    await c.query("UPDATE auth.invite_token SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [userId]);
    const token = await createToken(c, { userId, purpose: "reset", createdBy: actor });
    await audit(c, actor, "reset-passkeys", user);
    return { token };
  });
}

export async function revokeSessions(db, actor, userId) {
  return inTx(db, async (c) => {
    const user = await userById(c, userId);
    const res = await c.query('DELETE FROM auth.session WHERE "userId" = $1', [userId]);
    await audit(c, actor, "revoke-sessions", user, { sessions: res.rowCount });
  });
}

/** Deletes the account; foreign keys cascade to all of the user's study data. */
export async function deleteUser(db, actor, userId, typedName) {
  return inTx(db, async (c) => {
    const user = await userById(c, userId);
    if (typedName.trim() !== user.name) throw new Error("The name you typed does not match.");
    await c.query('DELETE FROM auth."user" WHERE id = $1', [userId]);
    await audit(c, actor, "delete-user", user);
  });
}

export async function listAudit(db, limit = 200) {
  const { rows } = await db.query(
    "SELECT at, actor, action, target_name, detail FROM auth.audit_log ORDER BY at DESC, id LIMIT $1",
    [limit],
  );
  return rows;
}
