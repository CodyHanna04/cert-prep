"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppContext } from "@/lib/app/context.js";
import { requireUser } from "@/lib/auth/index.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { getPool } from "@/lib/db/questions.js";
import { clearResponse, createSession, questionHistory, recordResponse } from "@/lib/db/sessions.js";
import { stratifiedSample } from "@/lib/domain/sampling.js";

export async function startMockAction() {
  const { user, exam: active } = await getAppContext();
  if (!active) redirect("/courses");

  const result = await withUser(user.id, async (db) => {
    const exam = await getExam(db, active.id);
    const [pool, history] = await Promise.all([getPool(db, exam.id), questionHistory(db, exam.id)]);
    const total = Math.min(exam.questionCount ?? 50, pool.length);
    if (total === 0) return { error: "empty" };
    const { questionIds, allocation, warnings } = stratifiedSample({
      total,
      domains: exam.domains.map((d) => ({ id: d.id, weightPct: d.weightPct })),
      pool,
      lastSeenAt: new Map([...history].map(([id, h]) => [id, h.lastSeenAt])),
    });
    // Same pace as the real exam: if the bank is smaller than the real question count, scale the time down.
    const fullSec = (exam.timeLimitMin ?? 90) * 60;
    const timeLimitSec = Math.round(fullSec * (questionIds.length / (exam.questionCount ?? questionIds.length)));
    const session = await createSession(db, user.id, {
      examId: exam.id,
      mode: "mock",
      config: { warnings, allocation: Object.fromEntries(allocation) },
      questionIds,
      timeLimitSec,
    });
    return { sessionId: session.id };
  }).catch((e) => ({ error: /open session/.test(e.message) ? "open" : "failed" }));

  if (result.error) redirect(`/mock?error=${result.error}`);
  redirect(`/mock/${result.sessionId}`);
}

const saveSchema = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid(),
  selected: z.array(z.string().max(8)).max(8),
  // Time spent on this question so far (visible tab only), for the time stats on the results page.
  timeMs: z.number().int().min(0).max(86_400_000).nullable().optional(),
});

/** Stores (or clears) the current choice for one mock question. No feedback is returned. */
export async function saveMockAnswerAction(input) {
  const user = await requireUser();
  const a = saveSchema.parse(input);
  try {
    await withUser(user.id, async (db) => {
      if (a.selected.length === 0) await clearResponse(db, a.sessionId, a.questionId);
      else await recordResponse(db, user.id, a.sessionId, a.questionId, a.selected, a.timeMs ?? null);
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
