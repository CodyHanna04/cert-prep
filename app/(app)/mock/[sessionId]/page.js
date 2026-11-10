import { notFound, redirect } from "next/navigation";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getQuestionsByIds } from "@/lib/db/questions.js";
import { finishSession, getResponses, getSession, hasExpired, reviewFlags } from "@/lib/db/sessions.js";
import { isUuid, publicQuestion } from "@/lib/app/feedback.js";
import { MockRunner } from "./MockRunner.js";

export const metadata = { title: "Mock exam" };
export const dynamic = "force-dynamic";

export default async function MockSessionPage({ params }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const { user } = await getAppContext();

  const data = await withUser(user.id, async (db) => {
    const session = await getSession(db, sessionId);
    if (!session) return null;
    // Out of time while away: close the exam with whatever was saved.
    if (session.status === "in-progress" && hasExpired(session)) {
      await finishSession(db, sessionId, "completed");
      return { done: true };
    }
    const [questions, responses] = await Promise.all([getQuestionsByIds(db, session.questionIds), getResponses(db, sessionId)]);
    return { session, questions, responses };
  });
  if (!data) notFound();
  if (data.done || data.session.status !== "in-progress") redirect(`/history/${sessionId}`);
  if (data.session.mode !== "mock") redirect(`/practice/${sessionId}`);

  const byId = new Map(data.questions.map((q) => [q.id, q]));
  const ordered = data.session.questionIds.map((id) => byId.get(id)).filter(Boolean);
  const saved = Object.fromEntries(data.responses.map((r) => [r.questionId, r.selectedOptionIds]));
  const savedTime = Object.fromEntries(data.responses.filter((r) => r.timeMs != null).map((r) => [r.questionId, r.timeMs]));
  const endsAt = new Date(data.session.startedAt).getTime() + data.session.timeLimitSec * 1000;

  return <MockRunner sessionId={sessionId} questions={ordered.map(publicQuestion)} saved={saved} savedTime={savedTime} savedFlags={reviewFlags(data.session)} endsAt={endsAt} />;
}
