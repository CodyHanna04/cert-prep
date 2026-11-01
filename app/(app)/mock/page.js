import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { getPool } from "@/lib/db/questions.js";
import { getOpenSession, mockHistory } from "@/lib/db/sessions.js";
import { allocateByWeight } from "@/lib/domain/sampling.js";
import { abandonSessionAction } from "@/app/actions/practice.js";
import { startMockAction } from "@/app/actions/mock.js";
import { fmtDateTime } from "@/lib/app/view.js";
import { Badge, Button, Card, EmptyState, LinkButton, PageHeader, pct } from "@/components/ui/index.js";

export const metadata = { title: "Mock exam" };

const ERRORS = {
  empty: "There are no approved questions yet. Import and approve some first.",
  open: "You already have a session open for this exam. Resume it or abandon it first.",
  failed: "Could not start the exam. Try again.",
};

export default async function MockPage({ searchParams }) {
  const sp = await searchParams;
  const { user, exam: active } = await getAppContext();
  if (!active) return <EmptyState title="No course selected" action={<LinkButton href="/courses" variant="primary">Choose a course</LinkButton>} />;
  const { exam, pool, open, history } = await withUser(user.id, async (db) => ({
    exam: await getExam(db, active.id),
    pool: await getPool(db, active.id),
    open: await getOpenSession(db, active.id),
    history: await mockHistory(db, active.id),
  }));

  const wanted = exam.questionCount ?? 50;
  const total = Math.min(wanted, pool.length);
  const alloc = allocateByWeight(total, exam.domains.map((d) => ({ id: d.id, weightPct: d.weightPct })));
  const poolByDomain = new Map();
  for (const q of pool) poolByDomain.set(q.domainId, (poolByDomain.get(q.domainId) ?? 0) + 1);
  const minutes = Math.round(((exam.timeLimitMin ?? 90) * total) / wanted);

  return (
    <>
      <PageHeader title="Mock exam" subtitle={`${exam.code}. Timed, no feedback until you submit.`} />
      {sp.error && ERRORS[sp.error] && <p role="alert" className="mb-4 rounded-theme border border-warn bg-warn-soft p-3 text-sm text-warn">{ERRORS[sp.error]}</p>}

      {open && (
        <Card title="You have a session in progress" className="mb-4">
          <div className="flex gap-2">
            <LinkButton href={open.mode === "mock" ? `/mock/${open.id}` : `/practice/${open.id}`} variant="primary">Resume</LinkButton>
            <form action={abandonSessionAction}><input type="hidden" name="sessionId" value={open.id} /><Button type="submit" variant="danger">Abandon</Button></form>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="This exam">
          {total === 0 ? (
            <p className="text-sm text-muted">No approved questions yet.</p>
          ) : (
            <>
              <p className="text-sm">{total} questions · {minutes} minutes</p>
              {total < wanted && (
                <p className="mt-2 rounded-theme bg-warn-soft p-2 text-sm text-warn">
                  The real exam has {wanted} questions in {exam.timeLimitMin} minutes. You only have {pool.length} approved, so this mock is shorter and the time is scaled down to match.
                </p>
              )}
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-muted"><tr><th className="py-1 font-medium">Domain</th><th className="py-1 font-medium">Weight</th><th className="py-1 font-medium">Questions</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {exam.domains.map((d) => (
                    <tr key={d.id}><td className="py-1">{d.name}</td><td className="py-1">{d.weightPct}%</td><td className="py-1">{alloc.get(d.id)} <span className="text-muted">(of {poolByDomain.get(d.id) ?? 0})</span></td></tr>
                  ))}
                </tbody>
              </table>
              <form action={startMockAction} className="mt-4"><Button type="submit" variant="primary" isDisabled={!!open}>Start the mock exam</Button></form>
            </>
          )}
        </Card>

        <Card title="Past mock exams">
          {history.length === 0 ? (
            <p className="text-sm text-muted">None yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {[...history].reverse().map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-2">
                  <a className="flex-1 text-accent underline" href={`/history/${h.id}`}>{fmtDateTime(h.startedAt)}</a>
                  <span>{h.correct}/{h.total} ({pct(h.pct)})</span>
                  <Badge tone={h.pct >= exam.readinessTargetPct ? "ok" : "warn"}>{h.pct >= exam.readinessTargetPct ? "at target" : "below target"}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">Scores are raw percentages. The vendor's scaled score can't be derived from them, so the pass mark ({exam.passMarkPct ?? "—"}%) is only a proxy.</p>
        </Card>
      </div>
    </>
  );
}
