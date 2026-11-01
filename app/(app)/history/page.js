import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { listSessions } from "@/lib/db/sessions.js";
import { fmtDateTime, resumeHref } from "@/lib/app/view.js";
import { ScoreChart } from "@/components/ScoreChart.js";
import { Badge, Card, EmptyState, LinkButton, PageHeader, pct } from "@/components/ui/index.js";

export const metadata = { title: "History" };

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
  const sessions = await withUser(user.id, (db) => listSessions(db, exam.id, 200));

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
