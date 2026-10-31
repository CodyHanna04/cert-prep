import { notFound, redirect } from "next/navigation";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getQuestionsByIds } from "@/lib/db/questions.js";
import { getResponses, getSession } from "@/lib/db/sessions.js";
import { buildFeedback, isUuid, publicQuestion } from "@/lib/app/feedback.js";
import { PracticeRunner } from "./PracticeRunner.js";

export const metadata = { title: "Practice session" };

export default async function SessionPage({ params }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const { user } = await getAppContext();

  const data = await withUser(user.id, async (db) => {
    const session = await getSession(db, sessionId);
    if (!session) return null;
    const [questions, responses, marks] = await Promise.all([
      getQuestionsByIds(db, session.questionIds),
      getResponses(db, sessionId),
      db.query("SELECT question_id FROM question_mark WHERE kind = 'flag' AND question_id = ANY($1::uuid[])", [session.questionIds]),
    ]);
    return { session, questions, responses, flagged: new Set(marks.rows.map((r) => r.question_id)) };
  });
  if (!data) notFound();
  if (data.session.status !== "in-progress") redirect(`/history/${sessionId}`);
  if (data.session.mode === "mock") redirect(`/mock/${sessionId}`);

  const byId = new Map(data.questions.map((q) => [q.id, q]));
  const ordered = data.session.questionIds.map((id) => byId.get(id)).filter(Boolean);
  const answered = {};
  for (const r of data.responses) {
    const q = byId.get(r.questionId);
    if (q) answered[r.questionId] = buildFeedback(q, r.selectedOptionIds, r.isCorrect);
  }

  return (
    <PracticeRunner
      sessionId={sessionId}
      questions={ordered.map((q) => ({ ...publicQuestion(q), flagged: data.flagged.has(q.id) }))}
      answered={answered}
    />
  );
}
