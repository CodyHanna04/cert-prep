/** Per-user preferences (see exams.js for the conventions). Missing row = defaults. */

export const DEFAULT_PREFS = { theme: null, showConfidence: true };

export async function getPrefs(db) {
  const { rows } = await db.query("SELECT theme, show_confidence FROM user_pref LIMIT 1");
  if (rows.length === 0) return { ...DEFAULT_PREFS };
  return { theme: rows[0].theme, showConfidence: rows[0].show_confidence };
}

/** Saves the given fields, leaving the others as they are. */
export async function setPrefs(db, userId, patch) {
  const next = { ...(await getPrefs(db)), ...patch };
  await db.query(
    `INSERT INTO user_pref (user_id, theme, show_confidence) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme, show_confidence = EXCLUDED.show_confidence,
       updated_at = now()`,
    [userId, next.theme, next.showConfidence],
  );
  return next;
}
