import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { getQuestionsByIds } from "@/lib/db/questions.js";
import { getResponses, getSession, sessionScore } from "@/lib/db/sessions.js";
import { isUuid } from "@/lib/app/feedback.js";
import { fmtDateTime, indexExam } from "@/lib/app/view.js";
import { retryMissedAction } from "@/app/actions/practice.js";
import { Badge, Button, Card, PageHeader, pct } from "@/components/ui/index.js";
import { Markdown } from "@/components/ui/Markdown.js";

export const metadata = { title: "Session results" };

export default async function SessionResultsPage({ params }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const { user } = await getAppContext();

  const data = await withUser(user.id, async (db) => {
    const session = await getSession(db, sessionId);
    if (!session) return null;
    const exam = await getExam(db, session.examId);
    const [questions, responses, score] = await Promise.all([
      getQuestionsByIds(db, session.questionIds),
      getResponses(db, sessionId),
      sessionScore(db, session, exam),
    ]);
    return { session, exam, questions, responses, score };
  });
  if (!data) notFound();
  const { session, exam, questions, responses, score } = data;
  if (session.status === "in-progress") redirect(`/practice/${sessionId}`);

  const { objectiveById, domainById } = indexExam(exam);
  const qById = new Map(questions.map((q) => [q.id, q]));
  const rById = new Map(responses.map((r) => [r.questionId, r]));
  const ordered = session.questionIds.map((id) => qById.get(id)).filter(Boolean);
  const missed = ordered.filter((q) => !rById.get(q.id)?.isCorrect).length;

  // Breakdown per domain: correct / total (unanswered count as incorrect).
  const byDomain = new Map();
  for (const q of ordered) {
    const row = byDomain.get(q.domainId) ?? { total: 0, correct: 0 };
    row.total += 1;
    if (rById.get(q.id)?.isCorrect) row.correct += 1;
    byDomain.set(q.domainId, row);
  }

  return (
    <>
      <PageHeader
        title={session.status === "abandoned" ? "Abandoned session" : "Results"}
        subtitle={`${exam.code} · ${session.mode} · ${fmtDateTime(session.startedAt)}`}
        actions={
          missed > 0 && (
            <form action={retryMissedAction}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <Button type="submit" variant="primary">Retry the {missed} missed</Button>
            </form>
          )
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Score">
          <p className="font-display text-4xl">{pct(score.pct)}</p>
          <p className="text-sm text-muted">{score.correct} of {score.total} correct</p>
          <p className="mt-3 flex flex-wrap gap-2 text-sm">
            <Badge tone={score.meetsReadinessTarget ? "ok" : "warn"}>
              {score.meetsReadinessTarget ? "Meets" : "Below"} your {exam.readinessTargetPct}% target
            </Badge>
            {session.mode === "mock" && score.meetsPassMarkProxy != null && (
              <Badge tone={score.meetsPassMarkProxy ? "ok" : "warn"}>
                {score.meetsPassMarkProxy ? "Above" : "Below"} the {exam.passMarkPct}% pass-mark proxy
              </Badge>
            )}
          </p>
        </Card>
        <Card title="By domain" className="md:col-span-2">
          <ul className="space-y-2 text-sm">
            {[...byDomain].map(([id, r]) => (
              <li key={id} className="flex justify-between gap-3">
                <span>{domainById.get(id)?.name}</span>
                <span className="text-muted">{r.correct}/{r.total} ({pct((r.correct / r.total) * 100)})</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl">Answer review</h2>
      <ol className="space-y-4">
        {ordered.map((q, i) => {
          const r = rById.get(q.id);
          const ob = objectiveById.get(q.objectiveId);
          return (
            <li key={q.id} className="rounded-theme border border-line bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>Q{i + 1}</span>
                <Badge tone={!r ? "idle" : r.isCorrect ? "ok" : "bad"}>{!r ? "unanswered" : r.isCorrect ? "correct" : "incorrect"}</Badge>
                <Link className="hover:underline" href={`/map/${q.objectiveId}`}>{ob?.code} {ob?.title}</Link>
              </div>
              <Markdown text={q.stem} />
              <ul className="mt-3 space-y-1.5 text-sm">
                {q.options.map((o) => {
                  const picked = r?.selectedOptionIds.includes(o.id);
                  return (
                    <li key={o.id} className={`rounded-theme border px-3 py-2 ${o.isCorrect ? "border-ok bg-ok-soft" : picked ? "border-bad bg-bad-soft" : "border-line"}`}>
                      {o.text}
                      <span className="block text-xs text-muted">
                        {o.isCorrect ? "Correct. " : picked ? "Your answer. " : ""}{o.rationale}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {q.explanation && <p className="mt-3 text-sm text-muted">{q.explanation}</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}
