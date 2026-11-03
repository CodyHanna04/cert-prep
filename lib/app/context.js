import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser, requireUser } from "@/lib/auth/index.js";
import { withUser } from "@/lib/db/index.js";
import { listExams } from "@/lib/db/exams.js";
import { syncStaleBanks } from "@/lib/db/bank.js";
import { readPackBank } from "@/lib/content/bank.js";
import { getPrefs } from "@/lib/db/prefs.js";

export const EXAM_COOKIE = "certprep_exam";
export const THEME_COOKIE = "certprep_theme";
export const THEMES = [
  { id: "ledger", name: "Ledger", note: "Warm paper, serif headings" },
  { id: "control-room", name: "Control room", note: "Cool slate, monospace headings" },
];

/**
 * Signed-in user, their exams, and the active exam (cookie, falling back to the first). Brings each exam's
 * copy of the shared question bank up to date first (a no-op unless a deploy changed the bank).
 */
export async function getAppContext() {
  const user = await requireUser();
  const exams = await withUser(user.id, async (db) => {
    const list = await listExams(db);
    await syncStaleBanks(db, user.id, list, readPackBank);
    return list;
  });
  const wanted = (await cookies()).get(EXAM_COOKIE)?.value;
  const exam = exams.find((e) => e.id === wanted) ?? exams[0] ?? null;
  return { user, exams, exam };
}

/** The theme is saved with the account; the cookie is a cache so most pages need no lookup. */
export async function getTheme() {
  const id = (await cookies()).get(THEME_COOKIE)?.value;
  if (THEMES.some((t) => t.id === id)) return id;
  const user = await getCurrentUser().catch(() => null);
  const saved = user ? (await withUser(user.id, getPrefs)).theme : null;
  return THEMES.some((t) => t.id === saved) ? saved : "ledger";
}
