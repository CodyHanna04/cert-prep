import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { answersSinceWeek, listSessions } from "@/lib/db/sessions.js";
import { appTimeZone, fmtDateTime, resumeHref } from "@/lib/app/view.js";
import {
  median,
  scoreAxis,
  timeDistribution,
  weekStarts,
  weeklyAccuracy,
} from "@/lib/domain/trend.js";
import { fmtDuration } from "@/lib/domain/timing.js";
import { ScoreChart } from "@/components/ScoreChart.js";
import { BarStrip, Sparkline } from "@/components/Trend.js";
import { Badge, Card, EmptyState, LinkButton, PageHeader, pct } from "@/components/ui/index.js";

export const metadata = { title: "History" };

const TREND_WEEKS = 8;

const FILTERS = [
  ["all", "All"],
  ["mock", "Mock exams"],
  ["practice", "Practice"],
];

export default async function HistoryPage({ searchParams }) {
  const { user, exam } = await getAppContext();
  if (!exam)
    return (
      <EmptyState
        title="No course selected"
        action={
          <LinkButton href="/courses" variant="primary">
            Choose a course
          </LinkButton>
        }
      />
    );
  const { mode: modeParam } = await searchParams;
  const mode = FILTERS.some(([k]) => k === modeParam) ? modeParam : "all";
  const tz = appTimeZone();
  const weeks = weekStarts(new Date().toLocaleDateString("en-CA", { timeZone: tz }), TREND_WEEKS);
  // The full exam (with domains) for the trends; the app context only lists courses.
  const [sessions, answers, full] = await withUser(user.id, (db) =>
    Promise.all([
      listSessions(db, exam.id, 200),
      answersSinceWeek(db, exam.id, weeks[0], tz),
      getExam(db, exam.id),
    ]),
  );

  // Oldest first for the chart; only finished sessions have a score.
  const scored = sessions
    .filter((s) => s.status === "completed" && s.total > 0 && (mode === "all" || s.mode === mode))
    .reverse()
    .map((s) => ({
      id: s.id,
      mode: s.mode,
      total: s.total,
      correct: s.correct,
      startedAt: s.startedAt,
      pct: (s.correct / s.total) * 100,
      href: `/history/${s.id}`,
    }));
  const last5 = scored.slice(-5);
  const avg5 = last5.length ? last5.reduce((n, p) => n + p.pct, 0) / last5.length : null;
  const best = scored.length ? Math.max(...scored.map((p) => p.pct)) : null;
  const latest = scored[scored.length - 1];

  return (
    <>
      <PageHeader title="History" subtitle={`${exam.code} · how your scores are moving.`} />

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          action={
            <LinkButton href="/practice" variant="primary">
              Start practicing
            </LinkButton>
          }
        />
      ) : (
        <div className="grid gap-6">
          <Card
            title="Scores over time"
            action={
              <nav
                aria-label="Filter sessions"
                className="flex gap-1 rounded-theme bg-idle-soft p-1 text-sm"
              >
                {FILTERS.map(([key, label]) => (
                  <Link
                    key={key}
                    href={key === "all" ? "/history" : `/history?mode=${key}`}
                    aria-current={mode === key ? "page" : undefined}
                    className={`rounded-theme px-3 py-1 ${mode === key ? "bg-surface font-medium shadow-card" : "text-muted hover:text-text"}`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            }
          >
            {scored.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                No finished {mode === "all" ? "" : mode + " "}sessions yet. Scores appear here once
                you complete one.
              </p>
            ) : (
              <>
                <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile
                    label="Latest"
                    value={pct(latest.pct)}
                    tone={latest.pct >= exam.readinessTargetPct ? "ok" : "warn"}
                  />
                  <Tile
                    label={`Average, last ${last5.length}`}
                    value={pct(avg5)}
                    tone={avg5 >= exam.readinessTargetPct ? "ok" : "warn"}
                  />
                  <Tile label="Best" value={pct(best)} />
                  <Tile label="Finished sessions" value={scored.length} />
                </dl>
                <ScoreChart points={scored} targetPct={exam.readinessTargetPct} />
              </>
            )}
          </Card>

          <Trends exam={full} weeks={weeks} answers={answers} />

          <section aria-label="All sessions" className="min-w-0">
            <h2 className="mb-3 font-display text-xl tracking-tight">All sessions</h2>
            <div className="overflow-x-auto rounded-theme border border-line bg-surface shadow-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Mode</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Score</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sessions.map((s) => (
                    <tr key={s.id} className={s.status === "in-progress" ? "bg-accent-soft" : ""}>
                      <td className="px-4 py-2.5">{fmtDateTime(s.startedAt)}</td>
                      <td className="px-4 py-2.5 capitalize">{s.mode}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          tone={
                            s.status === "completed"
                              ? "ok"
                              : s.status === "in-progress"
                                ? "info"
                                : "idle"
                          }
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {s.status === "in-progress"
                          ? `${s.answered}/${s.total} answered`
                          : `${s.correct}/${s.total} (${pct(s.total ? (s.correct / s.total) * 100 : 0)})`}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {s.status === "in-progress" ? (
                          <LinkButton
                            href={resumeHref(s)}
                            variant="primary"
                            className="px-3 py-1 text-xs"
                          >
                            Resume
                          </LinkButton>
                        ) : (
                          <Link className="text-accent underline" href={`/history/${s.id}`}>
                            Review
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Tile({ label, value, tone }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-text";
  return (
    <div className="rounded-theme bg-idle-soft px-3 py-2.5">
      <dd className={`font-display text-2xl tabular-nums ${color}`}>{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}

const weekLabel = (w) =>
  new Date(`${w}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const BUCKET_LABEL = ["<30s", "30s–1m", "1–1.5m", "1.5–2m", "2–3m", "3m+"];

/** Accuracy by domain per week, and how long answers take: every answer in the window, practice and mock. */
function Trends({ exam, weeks, answers }) {
  const span = `last ${weeks.length} weeks`;
  if (answers.length === 0)
    return (
      <Card title="Trends">
        <p className="py-4 text-sm text-muted">
          No answers in the {span}. Trends show up here once you practice.
        </p>
      </Card>
    );

  const byDomain = weeklyAccuracy(answers, weeks, (a) => a.domainId);
  const rows = exam.domains.map((d) => {
    const cells =
      byDomain.get(d.id) ?? weeks.map((week) => ({ week, n: 0, correct: 0, pct: null }));
    const withData = cells.filter((c) => c.pct != null);
    const first = withData[0];
    const last = withData.at(-1);
    return {
      domain: d,
      cells,
      last,
      change: withData.length > 1 ? last.pct - first.pct : null,
      firstWeek: first?.week,
      answered: cells.reduce((n, c) => n + c.n, 0),
    };
  });

  // One shared vertical range for every domain row, fitted to the data (as the score chart does), so rows compare.
  const axis = scoreAxis([
    ...rows.flatMap((r) => r.cells.filter((c) => c.pct != null).map((c) => c.pct)),
    exam.readinessTargetPct,
  ]);

  const times = answers.map((a) => a.timeMs);
  const dist = timeDistribution(times);
  const measured = dist.reduce((n, b) => n + b.n, 0);
  const medianByWeek = weeks.map((week) => ({
    week,
    ms: median(answers.filter((a) => a.week === week).map((a) => a.timeMs)),
  }));
  const topMedian = Math.max(1, ...medianByWeek.map((m) => m.ms ?? 0));
  const overallMedian = median(times);

  return (
    <Card
      title="Trends"
      action={
        <span className="text-xs text-muted">Weekly, {span} · practice and mock answers</span>
      }
    >
      <h3 className="text-sm font-medium">Accuracy by domain</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Domain</th>
              <th className="w-24 py-1.5 pr-3 font-medium sm:w-44">Per week</th>
              <th className="py-1.5 pr-3 text-right font-medium">Latest week</th>
              <th className="hidden py-1.5 pr-3 text-right font-medium sm:table-cell">Change</th>
              <th className="hidden py-1.5 text-right font-medium sm:table-cell">Answers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.domain.id}>
                <td className="py-2 pr-3">{r.domain.name}</td>
                <td className="py-2 pr-3">
                  {r.answered === 0 ? (
                    <span className="text-xs text-muted">No answers yet</span>
                  ) : (
                    <Sparkline
                      label={`Weekly accuracy for ${r.domain.name}`}
                      target={exam.readinessTargetPct}
                      min={axis.lo}
                      max={axis.hi}
                      height={44}
                      points={r.cells.map((c) => ({
                        key: c.week,
                        value: c.pct,
                        tip: c.n
                          ? `Week of ${weekLabel(c.week)}: ${Math.round(c.pct)}% (${c.correct} of ${c.n})`
                          : `Week of ${weekLabel(c.week)}: no answers`,
                      }))}
                    />
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {r.last ? (
                    <span
                      className={r.last.pct >= exam.readinessTargetPct ? "text-ok" : "text-warn"}
                    >
                      {pct(r.last.pct)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="hidden py-2 pr-3 text-right tabular-nums text-muted sm:table-cell">
                  {r.change == null ? (
                    "—"
                  ) : (
                    <span title={`Since the week of ${weekLabel(r.firstWeek)}`}>
                      {r.change > 0 ? "+" : r.change < 0 ? "−" : "±"}
                      {Math.abs(Math.round(r.change))} pts
                    </span>
                  )}
                </td>
                <td className="hidden py-2 text-right tabular-nums text-muted sm:table-cell">{r.answered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Each line runs from {axis.lo}% to {axis.hi}%. Dashed line: your {exam.readinessTargetPct}%
        target. Change compares your latest week with your first week of answers in this window.
      </p>

      <h3 className="mt-6 text-sm font-medium">Time per question</h3>
      {measured === 0 ? (
        <p className="mt-2 text-sm text-muted">No timing recorded in the {span}.</p>
      ) : (
        <div className="mt-2 grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-muted">
              How long answers took · median {fmtDuration(overallMedian)}
            </p>
            <BarStrip
              label="Answers by time taken"
              height="h-24"
              bars={dist.map((b, i) => ({
                key: String(b.fromSec),
                value: b.n,
                label: BUCKET_LABEL[i],
                tip: `${BUCKET_LABEL[i]}: ${b.n} answer${b.n === 1 ? "" : "s"} (${Math.round((b.n / measured) * 100)}%)`,
              }))}
            />
          </div>
          <div>
            <p className="mb-2 text-xs text-muted">Median time per question, by week</p>
            <div className="flex gap-2">
              <div
                aria-hidden
                className="flex flex-col justify-between py-0.5 text-right text-[0.65rem] tabular-nums text-muted"
              >
                <span>{fmtDuration(topMedian)}</span>
                <span>0:00</span>
              </div>
              <Sparkline
                className="flex-1"
                label="Median time per question by week"
                min={0}
                max={topMedian}
                height={64}
                points={medianByWeek.map((m) => ({
                  key: m.week,
                  value: m.ms,
                  tip: m.ms
                    ? `Week of ${weekLabel(m.week)}: ${fmtDuration(m.ms)} median`
                    : `Week of ${weekLabel(m.week)}: no timed answers`,
                }))}
              />
            </div>
            <div aria-hidden className="mt-1 flex justify-between text-[0.65rem] text-muted">
              <span>{weekLabel(weeks[0])}</span>
              <span>This week</span>
            </div>
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">Counts only time with the tab visible.</p>
    </Card>
  );
}
