import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExamProgress } from "@/lib/db/progress.js";
import { countsByObjective } from "@/lib/db/questions.js";
import { activityByDay, getOpenSession, listSessions, mockHistory } from "@/lib/db/sessions.js";
import { indexExam, daysUntil, fmtDateTime } from "@/lib/app/view.js";
import { Badge, Card, EmptyState, LinkButton, Meter, PageHeader, StatusBadge, pct } from "@/components/ui/index.js";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const { user, exam: active } = await getAppContext();
  if (!active) {
    return (
      <EmptyState title="Add your first exam" action={<LinkButton href="/settings" variant="primary">Choose an exam pack</LinkButton>}>
        An exam pack brings in the vendor's published domains and objectives. Everything on this site is organized around them.
      </EmptyState>
    );
  }

  const data = await withUser(user.id, async (db) => {
    const [{ exam, progress }, open, counts, sessions, activity, mocks] = await Promise.all([
      getExamProgress(db, active.id),
      getOpenSession(db, active.id),
      countsByObjective(db, active.id),
      listSessions(db, active.id, 5),
      activityByDay(db, active.id, 14),
      mockHistory(db, active.id),
    ]);
    return { exam, progress, open, counts, sessions, activity, mocks };
  });
  const { exam, progress, open, counts, sessions, activity, mocks } = data;
  const { objectiveById, domainById } = indexExam(exam);
  const r = progress.readiness;
  const drafts = counts.filter((c) => c.reviewStatus === "draft").reduce((n, c) => n + c.n, 0);
  const approved = counts.filter((c) => c.reviewStatus === "approved").reduce((n, c) => n + c.n, 0);
  const noQuestions = progress.objectives.filter((o) => o.status === "no-questions").length;
  const days = daysUntil(exam.examDate);

  const startable = progress.whatsLeft.find((o) => o.poolSize > 0);
  const next = open
    ? { href: `/practice/${open.id}`, label: "Resume your session" }
    : startable
      ? { href: `/practice?scope=objective&id=${startable.objectiveId}`, label: `Practice ${objectiveById.get(startable.objectiveId).code}` }
      : approved === 0
        ? { href: "/library/import", label: "Import questions" }
        : null;

  const left = exam.domains.map((d) => ({
    domain: d,
    items: progress.whatsLeft.filter((o) => o.domainId === d.id),
  }));
  const weakest = progress.whatsLeft.filter((o) => o.poolSize > 0).slice(0, 5);

  // Activity: fill the last 14 days, including empty ones.
  const byDay = new Map(activity.map((a) => [a.day, a.n]));
  const bars = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toLocaleDateString("en-CA");
    return { key, n: byDay.get(key) ?? 0 };
  });
  const maxBar = Math.max(1, ...bars.map((b) => b.n));

  return (
    <>
      <PageHeader
        title={exam.name}
        subtitle={`${exam.code} · readiness target ${exam.readinessTargetPct}%${days != null ? ` · exam in ${days} day${days === 1 ? "" : "s"}` : ""}`}
        actions={next && <LinkButton href={next.href} variant="primary">{next.label}</LinkButton>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Readiness" className="md:col-span-1">
          {r.available ? (
            <>
              <p className="font-display text-4xl">{pct(r.scorePct)}</p>
              <p className="mt-1 text-sm">
                <Badge tone={r.meetsTarget ? "ok" : "warn"}>{r.meetsTarget ? "At or above target" : "Below target"}</Badge>{" "}
                <span className="text-muted">target {r.targetPct}%</span>
              </p>
              <div className="mt-3"><Meter value={r.scorePct} label="Readiness" tone={r.meetsTarget ? "ok" : "warn"} /></div>
            </>
          ) : (
            <>
              <p className="font-display text-2xl text-muted">Not enough data yet</p>
              <p className="mt-2 text-sm text-muted">Readiness appears once every domain has at least {r.missing[0]?.needed ?? 10} questions answered:</p>
              <ul className="mt-2 space-y-1 text-sm">
                {r.missing.map((m) => (
                  <li key={m.domainId}>
                    {domainById.get(m.domainId).name}: {m.sample}/{m.needed}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Question bank" className="md:col-span-1">
          <p className="font-display text-4xl">{approved}</p>
          <p className="text-sm text-muted">approved questions</p>
          <ul className="mt-3 space-y-1 text-sm">
            {drafts > 0 && (
              <li>
                <Link className="text-accent underline" href="/library/drafts">{drafts} draft{drafts === 1 ? "" : "s"} to review</Link>
              </li>
            )}
            {noQuestions > 0 && <li className="text-muted">{noQuestions} of {progress.objectives.length} objectives have no questions yet</li>}
            {mocks.length === 0 && (
              <li><Link className="text-accent underline" href="/mock">No mock exam taken yet</Link></li>
            )}
          </ul>
        </Card>

        <Card title="Last 14 days" className="md:col-span-1">
          <div className="flex h-24 items-end gap-1" role="img" aria-label={`Questions answered per day: ${bars.map((b) => b.n).join(", ")}`}>
            {bars.map((b) => (
              <div key={b.key} title={`${b.key}: ${b.n}`} className="flex-1 rounded-sm bg-accent" style={{ height: `${Math.max(4, (b.n / maxBar) * 100)}%`, opacity: b.n ? 1 : 0.2 }} />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{bars.reduce((s, b) => s + b.n, 0)} questions answered</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card title="What's left" className="md:col-span-2" action={<Link href="/map" className="text-sm text-accent underline">Open the map</Link>}>
          {progress.whatsLeft.length === 0 ? (
            <p className="text-sm text-muted">Every objective is on target. Take a mock exam to confirm.</p>
          ) : (
            <div className="space-y-5">
              {left.filter((g) => g.items.length).map(({ domain, items }) => (
                <div key={domain.id}>
                  <h3 className="mb-1 text-sm font-medium text-muted">
                    {domain.name} · {domain.weightPct}%
                  </h3>
                  <ul className="divide-y divide-line">
                    {items.map((o) => {
                      const ob = objectiveById.get(o.objectiveId);
                      return (
                        <li key={o.objectiveId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                          <Link href={`/map/${o.objectiveId}`} className="min-w-0 flex-1 hover:underline">
                            <span className="font-medium">{ob.code}</span> {ob.title}
                          </Link>
                          <StatusBadge status={o.status} />
                          {o.poolSize > 0 && (
                            <LinkButton href={`/practice?scope=objective&id=${o.objectiveId}`} className="px-2 py-1 text-xs">
                              Practice
                            </LinkButton>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Mock exam trend" action={<Link href="/mock" className="text-sm text-accent underline">Mock</Link>}>
            {mocks.length === 0 ? (
              <p className="text-sm text-muted">Take a timed mock to see your trend against the {exam.readinessTargetPct}% target.</p>
            ) : (
              <>
                <svg viewBox="0 0 200 70" className="h-20 w-full" role="img" aria-label={`Mock exam scores: ${mocks.map((m) => Math.round(m.pct)).join(", ")} percent`}>
                  <line x1="0" x2="200" y1={70 - exam.readinessTargetPct * 0.7} y2={70 - exam.readinessTargetPct * 0.7} stroke="var(--c-muted)" strokeDasharray="3 3" strokeWidth="1" />
                  <polyline fill="none" stroke="var(--c-accent)" strokeWidth="2" points={mocks.map((m, i) => `${mocks.length === 1 ? 100 : 6 + (i * 188) / (mocks.length - 1)},${70 - m.pct * 0.7}`).join(" ")} />
                  {mocks.map((m, i) => (
                    <circle key={m.id} cx={mocks.length === 1 ? 100 : 6 + (i * 188) / (mocks.length - 1)} cy={70 - m.pct * 0.7} r="3" fill="var(--c-accent)" />
                  ))}
                </svg>
                <p className="text-xs text-muted">Latest {pct(mocks[mocks.length - 1].pct)}. Dashed line is your {exam.readinessTargetPct}% target.</p>
              </>
            )}
          </Card>
          <Card title="Weakest objectives">
            {weakest.length === 0 ? (
              <p className="text-sm text-muted">Answer some questions to see where to focus.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {weakest.map((o) => {
                  const ob = objectiveById.get(o.objectiveId);
                  return (
                    <li key={o.objectiveId}>
                      <Link href={`/map/${o.objectiveId}`} className="hover:underline">
                        <span className="font-medium">{ob.code}</span> {ob.title}
                      </Link>
                      <div className="text-xs text-muted">{o.accuracy == null ? "not started" : `${pct(o.accuracy)} accuracy`}, {o.poolSize} question{o.poolSize === 1 ? "" : "s"}</div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
          <Card title="Recent sessions" action={<Link href="/history" className="text-sm text-accent underline">All</Link>}>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted">No sessions yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link href={s.status === "in-progress" ? `/practice/${s.id}` : `/history/${s.id}`} className="hover:underline">
                      {fmtDateTime(s.startedAt)}
                    </Link>{" "}
                    <span className="text-muted">
                      {s.mode} · {s.status === "in-progress" ? "in progress" : `${s.correct}/${s.total}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
