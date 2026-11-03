import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { getQuestionsByIds } from "@/lib/db/questions.js";
import { getResponses, getSession, sessionScore } from "@/lib/db/sessions.js";
import { isUuid } from "@/lib/app/feedback.js";
import { fmtDateTime, indexExam } from "@/lib/app/view.js";
import { fmtDuration, isSlow, timeStats } from "@/lib/domain/timing.js";
import { retryMissedAction } from "@/app/actions/practice.js";
import { Badge, Button, Card, PageHeader, pct } from "@/components/ui/index.js";
import { Markdown } from "@/components/ui/Markdown.js";

export const metadata = { title: "Session results" };

const FILTERS = [
  ["all", "All"],
  ["incorrect", "Incorrect"],
  ["flagged", "Flagged"],
  ["unanswered", "Unanswered"],
  ["slow", "Slow"],
  ["guessed", "Guessed"],
];
const CONFIDENCE_LABEL = { guess: "guessed", unsure: "unsure", sure: "sure" };

export default async function SessionResultsPage({ params, searchParams }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const sp = await searchParams;
  const show = FILTERS.some(([k]) => k === sp.show) ? sp.show : "all";
  const { user } = await getAppContext();

  const data = await withUser(user.id, async (db) => {
    const session = await getSession(db, sessionId);
    if (!session) return null;
    const exam = await getExam(db, session.examId);
    const [questions, responses, score, flags] = await Promise.all([
      getQuestionsByIds(db, session.questionIds),
      getResponses(db, sessionId),
      sessionScore(db, session, exam),
      db.query("SELECT question_id FROM question_mark WHERE kind = 'flag' AND question_id = ANY($1::uuid[])", [session.questionIds]),
    ]);
    return { session, exam, questions, responses, score, flagged: new Set(flags.rows.map((r) => r.question_id)) };
  });
  if (!data) notFound();
  const { session, exam, questions, responses, score, flagged } = data;
  if (session.status === "in-progress") redirect(`/practice/${sessionId}`);

  const { objectiveById, domainById } = indexExam(exam);
  const qById = new Map(questions.map((q) => [q.id, q]));
  const rById = new Map(responses.map((r) => [r.questionId, r]));
  const ordered = session.questionIds.map((id) => qById.get(id)).filter(Boolean);
  const missed = ordered.filter((q) => !rById.get(q.id)?.isCorrect).length;
  const times = timeStats(responses.map((r) => r.timeMs));
  const slowest = times && responses.find((r) => r.timeMs === times.maxMs);

  const matches = {
    all: () => true,
    incorrect: (q, r) => r && !r.isCorrect,
    flagged: (q, r) => flagged.has(q.id) || r?.flagged,
    unanswered: (q, r) => !r,
    slow: (q, r) => isSlow(r?.timeMs, times),
    guessed: (q, r) => r?.confidence === "guess",
  };
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, ordered.filter((q) => matches[k](q, rById.get(q.id))).length]));
  const shown = ordered.map((q, i) => ({ q, i })).filter(({ q }) => matches[show](q, rById.get(q.id)));
  const luckyGuesses = responses.filter((r) => r.isCorrect && r.confidence === "guess").length;

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
          {luckyGuesses > 0 && (
            <p className="mt-2 text-xs text-muted">
              {luckyGuesses} correct answer{luckyGuesses === 1 ? " was a guess" : "s were guesses"}: worth reviewing anyway.
            </p>
          )}
        </Card>
        <Card title="By domain">
          <ul className="space-y-2 text-sm">
            {[...byDomain].map(([id, r]) => (
              <li key={id} className="flex justify-between gap-3">
                <span>{domainById.get(id)?.name}</span>
                <span className="shrink-0 text-muted">{r.correct}/{r.total} ({pct((r.correct / r.total) * 100)})</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Time">
          {times ? (
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted">Per question</dt>
              <dd className="text-right tabular-nums">{fmtDuration(times.avgMs)} avg</dd>
              <dt className="text-muted">Median</dt>
              <dd className="text-right tabular-nums">{fmtDuration(times.medianMs)}</dd>
              <dt className="text-muted">Slowest</dt>
              <dd className="text-right tabular-nums">
                {fmtDuration(times.maxMs)}
                {slowest && ` (Q${session.questionIds.indexOf(slowest.questionId) + 1})`}
              </dd>
              <dt className="text-muted">Answering</dt>
              <dd className="text-right tabular-nums">{fmtDuration(times.totalMs)}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted">No timing recorded for this session.</p>
          )}
          <p className="mt-2 text-xs text-muted">Counts only time with this tab visible.</p>
        </Card>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h2 className="font-display text-xl">Answer review</h2>
        <nav aria-label="Filter answers" className="flex flex-wrap gap-1 text-sm">
          {FILTERS.filter(([k]) => k === "all" || counts[k] > 0).map(([k, label]) => (
            <Link
              key={k}
              href={k === "all" ? `/history/${sessionId}` : `/history/${sessionId}?show=${k}`}
              aria-current={show === k ? "page" : undefined}
              className={`rounded-full border px-3 py-0.5 ${show === k ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-idle-soft"}`}
            >
              {label} <span className="tabular-nums opacity-75">{counts[k]}</span>
            </Link>
          ))}
        </nav>
      </div>
      {shown.length === 0 && <p className="text-sm text-muted">No questions match this filter.</p>}
      <ol className="space-y-4">
        {shown.map(({ q, i }) => {
          const r = rById.get(q.id);
          const ob = objectiveById.get(q.objectiveId);
          return (
            <li key={q.id} className="rounded-theme border border-line bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>Q{i + 1}</span>
                <Badge tone={!r ? "idle" : r.isCorrect ? "ok" : "bad"}>{!r ? "unanswered" : r.isCorrect ? "correct" : "incorrect"}</Badge>
                {r?.confidence && <Badge tone={r.confidence === "guess" ? "warn" : "idle"}>{CONFIDENCE_LABEL[r.confidence]}</Badge>}
                {flagged.has(q.id) && <Badge tone="warn">flagged</Badge>}
                {r?.timeMs != null && <span className={isSlow(r.timeMs, times) ? "font-medium text-warn" : ""}>{fmtDuration(r.timeMs)}</span>}
                <Link className="hover:underline" href={`/map/${q.objectiveId}`}>{ob?.code} {ob?.title}</Link>
                <span className="flex-1" />
                <Link className="hover:underline" href={`/library/questions/${q.id}#attempts`}>Question history</Link>
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
