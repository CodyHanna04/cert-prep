"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { readFileSync } from "node:fs";
import { requireUser } from "@/lib/auth/index.js";
import { withUser } from "@/lib/db/index.js";
import { createExamFromPack, getExam, updateExamSettings, archiveExam } from "@/lib/db/exams.js";
import { EXAM_COOKIE, THEME_COOKIE, THEMES } from "@/lib/app/context.js";
import { listPacks, packPath } from "@/lib/content/packs.js";

const cookieOpts = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function setActiveExamAction(formData) {
  const user = await requireUser();
  const examId = String(formData.get("examId") ?? "");
  // Only exams the signed-in user owns can be activated (RLS hides everything else).
  const exam = await withUser(user.id, (db) => getExam(db, examId));
  if (exam) (await cookies()).set(EXAM_COOKIE, exam.id, cookieOpts);
  revalidatePath("/", "layout");
}

export async function addExamFromPackAction(formData) {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "");
  if (!listPacks().some((p) => p.code === code)) throw new Error("Unknown exam pack.");
  const pack = JSON.parse(readFileSync(packPath(code), "utf8"));
  const examId = await withUser(user.id, (db) => createExamFromPack(db, user.id, pack));
  (await cookies()).set(EXAM_COOKIE, examId, cookieOpts);
  redirect("/map");
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

export async function archiveExamAction(formData) {
  const user = await requireUser();
  await withUser(user.id, (db) => archiveExam(db, String(formData.get("examId")), formData.get("archived") !== "false"));
  revalidatePath("/", "layout");
}

export async function setThemeAction(formData) {
  await requireUser();
  const id = String(formData.get("theme"));
  if (THEMES.some((t) => t.id === id)) (await cookies()).set(THEME_COOKIE, id, { ...cookieOpts, httpOnly: false });
  revalidatePath("/", "layout");
}
