import { computeProgress } from "../domain/progress.js";
import { getExam } from "./exams.js";
import { getPool } from "./questions.js";
import { attemptsForExam } from "./sessions.js";

/** Loads what the progress model needs and returns its result together with the exam. */
export async function getExamProgress(db, examId) {
  const exam = await getExam(db, examId);
  if (!exam) return null;
  const [pool, attempts] = await Promise.all([getPool(db, examId), attemptsForExam(db, examId)]);
  const progress = computeProgress({
    targetPct: exam.readinessTargetPct,
    domains: exam.domains.map((d) => ({ id: d.id, weightPct: d.weightPct })),
    objectives: exam.domains.flatMap((d) => d.objectives.map((o) => ({ id: o.id, domainId: d.id }))),
    pool,
    attempts,
  });
  return { exam, progress };
}
