"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { readFileSync } from "node:fs";
import { requireUser } from "@/lib/auth/index.js";
import { withUser } from "@/lib/db/index.js";
import { enrollInPack, getExam, updateExamSettings, archiveExam } from "@/lib/db/exams.js";
import { setPrefs } from "@/lib/db/prefs.js";
import { EXAM_COOKIE, THEME_COOKIE, THEMES } from "@/lib/app/context.js";
import { listPacks, packPath } from "@/lib/content/packs.js";

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** Where a course button may send you: a course page or one of your sessions. Anything else lands on the overview. */
const COURSE_PAGES = new Set([
  "/course",
  "/map",
  "/practice",
  "/mock",
  "/library",
  "/history",
  "/settings",
]);
const RESUME_PATH = /^\/(practice|mock)\/[0-9a-f-]{36}$/;
const courseDestination = (to) =>
  COURSE_PAGES.has(String(to)) || RESUME_PATH.test(String(to)) ? String(to) : "/course";

/** Makes one of your courses the current one and opens it. The course bar always shows which is current. */
export async function openCourseAction(formData) {
  const user = await requireUser();
  const examId = String(formData.get("examId") ?? "");
  // Only exams the signed-in user owns can be opened (RLS hides everything else).
  const exam = await withUser(user.id, (db) => getExam(db, examId));
  if (!exam || exam.archived) redirect("/courses");
  (await cookies()).set(EXAM_COOKIE, exam.id, cookieOpts);
  redirect(courseDestination(formData.get("to")));
}

/** Start studying a course from the catalog; restores a paused one with its progress. */
export async function enrollAction(formData) {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "");
  if (!listPacks().some((p) => p.code === code)) redirect("/courses");
  const pack = JSON.parse(readFileSync(packPath(code), "utf8"));
  const examId = await withUser(user.id, (db) => enrollInPack(db, user.id, pack));
  (await cookies()).set(EXAM_COOKIE, examId, cookieOpts);
  revalidatePath("/", "layout");
  redirect("/course");
}

export async function updateExamSettingsAction(formData) {
  const user = await requireUser();
  const examId = String(formData.get("examId"));
  await withUser(user.id, (db) =>
    updateExamSettings(db, examId, {
      readinessTargetPct: formData.get("readinessTargetPct"),
      examDate: formData.get("examDate"),
    }),
  );
  revalidatePath("/", "layout");
}

/** Pause a course: it leaves the dashboard but nothing is deleted, and enrolling again brings it back. */
export async function pauseCourseAction(formData) {
  const user = await requireUser();
  await withUser(user.id, (db) => archiveExam(db, String(formData.get("examId")), true));
  revalidatePath("/", "layout");
  redirect("/courses");
}

export async function setThemeAction(formData) {
  const user = await requireUser();
  const id = String(formData.get("theme"));
  if (THEMES.some((t) => t.id === id)) {
    await withUser(user.id, (db) => setPrefs(db, user.id, { theme: id }));
    (await cookies()).set(THEME_COOKIE, id, { ...cookieOpts, httpOnly: false });
  }
  revalidatePath("/", "layout");
}

export async function setStudyPrefsAction(formData) {
  const user = await requireUser();
  await withUser(user.id, (db) => setPrefs(db, user.id, { showConfidence: formData.get("showConfidence") === "on" }));
  revalidatePath("/", "layout");
}
