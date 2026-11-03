import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { flaggedIds, getPool } from "@/lib/db/questions.js";
import { getOpenSession, questionHistory } from "@/lib/db/sessions.js";
import { isUuid } from "@/lib/app/feedback.js";
import { abandonSessionAction, startPracticeAction } from "@/app/actions/practice.js";
import { Button, Card, EmptyState, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui/index.js";

export const metadata = { title: "Practice" };

const ERRORS = {
  empty: "No approved questions match that scope yet. Pick a wider scope, or import and approve more questions.",
  open: "You already have a session open for this exam. Resume it or abandon it first.",
  invalid: "Those settings were not valid.",
  failed: "Could not start the session. Try again.",
};

export default async function PracticePage({ searchParams }) {
  const sp = await searchParams;
  const { user, exam: active } = await getAppContext();
  if (!active) return <EmptyState title="No course selected" action={<LinkButton href="/courses" variant="primary">Choose a course</LinkButton>} />;

  const { exam, open, pool, history, flagged } = await withUser(user.id, async (db) => ({
    exam: await getExam(db, active.id),
    open: await getOpenSession(db, active.id),
    pool: await getPool(db, active.id),
    history: await questionHistory(db, active.id),
    flagged: await flaggedIds(db, active.id),
  }));
  // How many approved questions each scope holds, shown in the picker so an empty scope is visible up front.
  const count = (test) => pool.filter(test).length;
  const n = {
    exam: pool.length,
    flagged: count((q) => flagged.has(q.id)),
    missed: count((q) => history.get(q.id)?.lastResult === false),
    unseen: count((q) => !history.has(q.id)),
  };
  const inDomain = (id) => count((q) => q.domainId === id);
  const inObjective = (id) => count((q) => q.objectiveId === id);
  const label = (text, k) => `${text} (${k})`;
  const target = ["exam", "flagged", "missed", "unseen"].includes(sp.scope)
    ? sp.scope
    : ["domain", "objective"].includes(sp.scope) && isUuid(sp.id)
      ? `${sp.scope}:${sp.id}`
      : "exam";

  return (
    <>
      <PageHeader title="Practice" subtitle={`${exam.code}. ${pool.length} approved question${pool.length === 1 ? "" : "s"} available.`} />
      {sp.error && ERRORS[sp.error] && (
        <p role="alert" className="mb-4 rounded-theme border border-warn bg-warn-soft p-3 text-sm text-warn">{ERRORS[sp.error]}</p>
      )}
      {open && (
        <Card title="You have a session in progress" className="mb-4">
          <p className="mb-3 text-sm text-muted">{open.questionIds.length} questions, started {new Date(open.startedAt).toLocaleString()}.</p>
          <div className="flex gap-2">
            <LinkButton href={`/practice/${open.id}`} variant="primary">Resume</LinkButton>
            <form action={abandonSessionAction}>
              <input type="hidden" name="sessionId" value={open.id} />
              <Button type="submit" variant="danger">Abandon</Button>
            </form>
          </div>
        </Card>
      )}
      {pool.length === 0 ? (
        <EmptyState title="No approved questions yet" action={<LinkButton href="/library/import" variant="primary">Import questions</LinkButton>}>
          Practice draws only from approved questions. Import a file, then review and approve the drafts.
        </EmptyState>
      ) : (
        <Card title="Start a session">
          <form action={startPracticeAction} className="grid max-w-xl gap-4">
            <Field label="What to practice" hint="Numbers are approved questions available in each scope.">
              <Select name="target" defaultValue={target}>
                <option value="exam">{label("Whole exam", n.exam)}</option>
                <option value="flagged" disabled={n.flagged === 0}>{label("Flagged questions", n.flagged)}</option>
                <option value="missed" disabled={n.missed === 0}>{label("Questions I last missed", n.missed)}</option>
                <option value="unseen" disabled={n.unseen === 0}>{label("Questions I haven't seen", n.unseen)}</option>
                {exam.domains.map((d) => (
                  <optgroup key={d.id} label={`${d.name} (${d.weightPct}% of the exam)`}>
                    <option value={`domain:${d.id}`}>{label(`Whole domain: ${d.name}`, inDomain(d.id))}</option>
                    {d.objectives.map((o) => (
                      <option key={o.id} value={`objective:${o.id}`} disabled={inObjective(o.id) === 0}>
                        {label(`${o.code} ${o.title}`, inObjective(o.id))}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Number of questions">
                <Input name="count" type="number" min="1" max="100" defaultValue="10" required />
              </Field>
              <Field label="Order">
                <Select name="order" defaultValue="random">
                  <option value="random">Random</option>
                  <option value="unseen-first">Unseen first</option>
                  <option value="missed-first">Missed first</option>
                </Select>
              </Field>
            </div>
            <div><Button type="submit" variant="primary" isDisabled={!!open}>Start</Button></div>
          </form>
        </Card>
      )}
    </>
  );
}
