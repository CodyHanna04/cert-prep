"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/app/context.js";
import { requireUser } from "@/lib/auth/index.js";
import { withUser } from "@/lib/db/index.js";
import { flaggedIds, getPool, getQuestion, setNote, toggleMark } from "@/lib/db/questions.js";
import { createSession, finishSession, getResponses, getSession, questionHistory, recordResponse } from "@/lib/db/sessions.js";
import { selectQuestions } from "@/lib/domain/selection.js";
import { buildFeedback } from "@/lib/app/feedback.js";

const startSchema = z.object({
  // "exam", "flagged", "missed", "unseen", or "domain:<uuid>" / "objective:<uuid>"
  target: z.string().regex(/^(exam|flagged|missed|unseen|(domain|objective):[0-9a-f-]{36})$/i),
  count: z.coerce.number().int().min(1).max(100),
  order: z.enum(["random", "unseen-first", "missed-first"]),
});

export async function startPracticeAction(formData) {
  const { user, exam } = await getAppContext();
  if (!exam) redirect("/settings");
  const parsed = startSchema.safeParse({
    target: formData.get("target"),
    count: formData.get("count"),
    order: formData.get("order"),
  });
  if (!parsed.success) redirect("/practice?error=invalid");
  const [scope, id] = parsed.data.target.split(":");
  const { count, order } = parsed.data;

  const result = await withUser(user.id, async (db) => {
    const [pool, history, flagged] = await Promise.all([getPool(db, exam.id), questionHistory(db, exam.id), flaggedIds(db, exam.id)]);
    const ids = selectQuestions({ pool, scope: id ? { type: scope, id } : { type: scope }, count, order, history, flaggedIds: flagged });
    if (ids.length === 0) return { error: "empty" };
    const session = await createSession(db, user.id, { examId: exam.id, mode: "practice", config: { scope, id: id ?? null, count, order }, questionIds: ids });
    return { sessionId: session.id };
  }).catch((e) => ({ error: /open session/.test(e.message) ? "open" : "failed" }));

  if (result.error) redirect(`/practice?error=${result.error}`);
  redirect(`/practice/${result.sessionId}`);
}

const answerSchema = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid(),
  selected: z.array(z.string().max(8)).max(8),
  timeMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
});

/** Scores an answer and returns the feedback to show. */
export async function submitAnswerAction(input) {
  const user = await requireUser();
  const a = answerSchema.parse(input);
  return withUser(user.id, async (db) => {
    const { isCorrect, accepted } = await recordResponse(db, user.id, a.sessionId, a.questionId, a.selected, a.timeMs ?? null);
    // Show feedback for what was actually recorded (the first answer sticks in practice).
    const responses = await getResponses(db, a.sessionId);
    const stored = responses.find((r) => r.questionId === a.questionId);
    const question = await getQuestion(db, a.questionId);
    return { accepted, ...buildFeedback(question, stored?.selectedOptionIds ?? a.selected, stored?.isCorrect ?? isCorrect) };
  });
}

export async function finishSessionAction(sessionId) {
  const user = await requireUser();
  const id = z.uuid().parse(sessionId);
  await withUser(user.id, (db) => finishSession(db, id, "completed"));
  revalidatePath("/", "layout");
  redirect(`/history/${id}`);
}

export async function abandonSessionAction(formData) {
  const user = await requireUser();
  const id = z.uuid().parse(formData.get("sessionId"));
  await withUser(user.id, (db) => finishSession(db, id, "abandoned"));
  revalidatePath("/", "layout");
  redirect("/practice");
}

/** New practice session from the questions missed in a finished one. */
export async function retryMissedAction(formData) {
  const { user, exam } = await getAppContext();
  const id = z.uuid().parse(formData.get("sessionId"));
  const result = await withUser(user.id, async (db) => {
    const session = await getSession(db, id);
    if (!session) return { error: "failed" };
    const responses = await getResponses(db, id);
    const wrong = responses.filter((r) => !r.isCorrect).map((r) => r.questionId);
    // Unanswered questions count as missed too.
    const answered = new Set(responses.map((r) => r.questionId));
    const missed = [...wrong, ...session.questionIds.filter((q) => !answered.has(q))];
    if (missed.length === 0) return { error: "empty" };
    const created = await createSession(db, user.id, { examId: session.examId, mode: "practice", config: { scope: "retry", from: id }, questionIds: missed });
    return { sessionId: created.id };
  }).catch((e) => ({ error: /open session/.test(e.message) ? "open" : "failed" }));
  if (!exam || result.error) redirect(`/practice?error=${result.error ?? "failed"}`);
  redirect(`/practice/${result.sessionId}`);
}

export async function toggleFlagAction(questionId) {
  const user = await requireUser();
  const id = z.uuid().parse(questionId);
  return withUser(user.id, (db) => toggleMark(db, user.id, id, "flag"));
}

export async function saveNoteAction(questionId, body) {
  const user = await requireUser();
  const id = z.uuid().parse(questionId);
  const text = z.string().max(5000).parse(body);
  await withUser(user.id, (db) => setNote(db, user.id, id, text));
}
