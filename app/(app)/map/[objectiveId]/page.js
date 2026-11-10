import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExamProgress } from "@/lib/db/progress.js";
import { listQuestions } from "@/lib/db/questions.js";
import { answersSinceWeek, questionHistory } from "@/lib/db/sessions.js";
import { appTimeZone, indexExam } from "@/lib/app/view.js";
import { scoreAxis, weekStarts, weeklyAccuracy } from "@/lib/domain/trend.js";
import { Sparkline } from "@/components/Trend.js";
import { Badge, Card, LinkButton, Meter, PageHeader, StatusBadge, pct } from "@/components/ui/index.js";

const WEEKS = 8;

export default async function ObjectivePage({ params }) {
  const { objectiveId } = await params;
  const { user, exam: active } = await getAppContext();
  if (!active) notFound();
  const tz = appTimeZone();
  const weeks = weekStarts(new Date().toLocaleDateString("en-CA", { timeZone: tz }), WEEKS);
  const data = await withUser(user.id, async (db) => {
    const res = await getExamProgress(db, active.id);
    const ob = indexExam(res.exam).objectiveById.get(objectiveId);
    if (!ob) return null;
    const [questions, history, recent] = await Promise.all([
      listQuestions(db, active.id, { objectiveId, limit: 200 }),
      questionHistory(db, active.id),
      answersSinceWeek(db, active.id, weeks[0], tz, objectiveId),
    ]);
    return { ...res, ob, questions, history, recent };
  });
  if (!data) notFound();
  const { exam, progress, ob, questions, history, recent } = data;
  const perWeek = weeklyAccuracy(recent, weeks, () => "all").get("all");
  const axis = scoreAxis([...(perWeek ?? []).filter((c) => c.pct != null).map((c) => c.pct), exam.readinessTargetPct]);
  const row = progress.objectives.find((o) => o.objectiveId === objectiveId);
  const approved = questions.filter((q) => q.reviewStatus === "approved");
  const drafts = questions.filter((q) => q.reviewStatus === "draft");
  const missed = approved.filter((q) => history.get(q.id)?.lastResult === false);

  return (
    <>
      <PageHeader
        title={`${ob.code} ${ob.title}`}
        subtitle={`${ob.domain.name} · ${ob.domain.weightPct}% of the exam`}
        actions={
          <>
            <LinkButton href={`/library/questions/new?objective=${objectiveId}`}>Write a question</LinkButton>
            {row.poolSize > 0 ? (
              <LinkButton href={`/practice?scope=objective&id=${objectiveId}`} variant="primary">Practice this objective</LinkButton>
            ) : (
              <LinkButton href="/library/import" variant="primary">Add questions</LinkButton>
            )}
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Status">
          <StatusBadge status={row.status} />
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-muted">Accuracy (latest 3 attempts per question)</dt>
              <dd className="mb-1 font-display text-2xl">{pct(row.accuracy)}</dd>
              {row.accuracy != null && <Meter value={row.accuracy} label="Accuracy" tone={row.accuracy >= exam.readinessTargetPct ? "ok" : "warn"} />}
              <dd className="mt-1 text-xs text-muted">Target {exam.readinessTargetPct}%</dd>
            </div>
            <div>
              <dt className="text-muted">Coverage</dt>
              <dd>{row.sample} of {row.poolSize} questions attempted ({pct(row.coverage * 100)})</dd>
            </div>
            <div>
              <dt className="text-muted">Attempts over time</dt>
              {perWeek ? (
                <dd className="mt-1">
                  <Sparkline
                    label={`Weekly accuracy on ${ob.code}, last ${WEEKS} weeks`}
                    target={exam.readinessTargetPct}
                    min={axis.lo}
                    max={axis.hi}
                    height={44}
                    points={perWeek.map((c) => ({
                      key: c.week,
                      value: c.pct,
                      tip: c.n
                        ? `Week of ${shortDate(c.week)}: ${Math.round(c.pct)}% (${c.correct} of ${c.n})`
                        : `Week of ${shortDate(c.week)}: no attempts`,
                    }))}
                  />
                  <p className="mt-1 text-xs text-muted">
                    {recent.length} attempt{recent.length === 1 ? "" : "s"} in the last {WEEKS} weeks, accuracy per week
                  </p>
                </dd>
              ) : (
                <dd className="text-xs text-muted">No attempts in the last {WEEKS} weeks.</dd>
              )}
            </div>
          </dl>
        </Card>
        <Card title="What the guide says" className="md:col-span-2">
          {ob.scope.length === 0 ? (
            <p className="text-sm text-muted">No scope notes for this objective.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {ob.scope.map((s) => <li key={s}>{s}</li>)}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title={`Questions (${approved.length} approved${drafts.length ? `, ${drafts.length} draft` : ""})`}>
          {questions.length === 0 ? (
            <p className="text-sm text-muted">No questions yet for this objective.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {questions.slice(0, 20).map((q) => (
                <li key={q.id} className="flex items-start gap-2 py-2">
                  <Link href={`/library/questions/${q.id}`} className="min-w-0 flex-1 hover:underline">{q.stem.length > 110 ? `${q.stem.slice(0, 110)}…` : q.stem}</Link>
                  {q.reviewStatus !== "approved" && <Badge tone={q.reviewStatus === "draft" ? "info" : "bad"}>{q.reviewStatus}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Mistakes">
            {missed.length === 0 ? (
              <p className="text-sm text-muted">Nothing missed here (last attempt).</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {missed.map((q) => (
                  <li key={q.id}><Link href={`/library/questions/${q.id}`} className="hover:underline">{q.stem.length > 110 ? `${q.stem.slice(0, 110)}…` : q.stem}</Link></li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Study material">
            <p className="text-sm text-muted">Study notes for this objective will live here. Coming later.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

const shortDate = (w) =>
  new Date(`${w}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
