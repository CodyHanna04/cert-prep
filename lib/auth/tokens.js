import { createHash, randomBytes } from "node:crypto";

/**
 * Single-use invite / reset tokens. Only the sha256 hash is stored. `db` is anything with `.query`
 * (a pg Pool or Client). Minting needs the admin role; checking and consuming works with the auth role.
 */

export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Creates a token for an existing user and returns the raw token (shown once). */
export async function createToken(db, { userId, purpose, createdBy, ttlHours = 72 }) {
  const token = newToken();
  await db.query(
    `INSERT INTO auth.invite_token (user_id, purpose, token_hash, expires_at, created_by)
     VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval, $5)`,
    [userId, purpose, hashToken(token), String(ttlHours), createdBy],
  );
  return token;
}

/** Creates a user with no credentials and a first-passkey invite. Placeholder email: sign-in never uses email. */
export async function createInvitedUser(db, { name, createdBy, ttlHours = 72 }) {
  const { rows } = await db.query(
    `INSERT INTO auth."user" (name, email) VALUES ($1, gen_random_uuid()::text || '@users.invalid') RETURNING id`,
    [name],
  );
  const userId = rows[0].id;
  const token = await createToken(db, { userId, purpose: "invite", createdBy, ttlHours });
  return { userId, token };
}

/** The user a still-valid token belongs to, or null. Does not consume it. */
export async function findValidToken(db, token) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const { rows } = await db.query(
    `SELECT t.id, t.user_id, t.purpose, u.name
       FROM auth.invite_token t JOIN auth."user" u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ? { id: rows[0].id, userId: rows[0].user_id, purpose: rows[0].purpose, name: rows[0].name } : null;
}

/** Atomically marks a token used. Returns false if it was already used, expired, or belongs to someone else. */
export async function consumeToken(db, token, userId) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return false;
  const res = await db.query(
    `UPDATE auth.invite_token SET used_at = now()
      WHERE token_hash = $1 AND user_id = $2 AND used_at IS NULL AND expires_at > now()`,
    [hashToken(token), userId],
  );
  return res.rowCount === 1;
}
