import "server-only";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/index.js";
import { withUser } from "@/lib/db/index.js";
import { listExams } from "@/lib/db/exams.js";

export const EXAM_COOKIE = "certprep_exam";
export const THEME_COOKIE = "certprep_theme";
export const THEMES = [
  { id: "ledger", name: "Ledger", note: "Warm paper, serif headings" },
  { id: "control-room", name: "Control room", note: "Cool slate, monospace headings" },
];

/** Signed-in user, their exams, and the active exam (cookie, falling back to the first). */
export async function getAppContext() {
  const user = await requireUser();
  const exams = await withUser(user.id, (db) => listExams(db));
  const wanted = (await cookies()).get(EXAM_COOKIE)?.value;
  const exam = exams.find((e) => e.id === wanted) ?? exams[0] ?? null;
  return { user, exams, exam };
}

export async function getTheme() {
  const id = (await cookies()).get(THEME_COOKIE)?.value;
  return THEMES.some((t) => t.id === id) ? id : "ledger";
}
