import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { countsByObjective } from "@/lib/db/questions.js";
import { buildCoverage, BANK_MULTIPLIER, PRACTICE_MIN } from "@/lib/domain/coverage.js";
import { Badge, Card, EmptyState, LinkButton, Meter, PageHeader } from "@/components/ui/index.js";

export const metadata = { title: "Coverage" };

const STAGE = {
  needs: { label: "Needs questions", tone: "warn" },
  practice: { label: "Practice-ready", tone: "info" },
  full: { label: "At target", tone: "ok" },
};

export default async function CoveragePage() {
  const { user, exam: active } = await getAppContext();
  if (!active) {
    return <EmptyState title="No course selected" action={<LinkButton href="/courses" variant="primary">Choose a course</LinkButton>} />;
  }
  const { exam, counts } = await withUser(user.id, async (db) => ({
    exam: await getExam(db, active.id),
    counts: await countsByObjective(db, active.id),
  }));
  const cov = buildCoverage(exam, counts);

  return (
    <>
      <PageHeader
        title="Coverage"
        subtitle={`${exam.code} · approved questions against a target of ${BANK_MULTIPLIER} exams' worth, split by blueprint weight.`}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card title="Approved">
          <p className="font-display text-3xl tabular-nums">
            {cov.approved} <span className="text-base text-muted">/ {cov.target}</span>
          </p>
          <div className="mt-2"><Meter value={cov.approved} max={cov.target || 1} label="Approved questions against target" /></div>
        </Card>
        <Card title="Drafts waiting">
          <p className="font-display text-3xl tabular-nums">{cov.draft}</p>
          {cov.draft > 0 ? (
            <Link href="/library/drafts" className="mt-2 inline-block text-sm text-accent underline">Review them</Link>
          ) : (
            <p className="mt-2 text-sm text-muted">Nothing to review.</p>
          )}
        </Card>
        <Card title="Practice-ready">
          <p className="font-display text-3xl tabular-nums">
            {cov.practiceReady} <span className="text-base text-muted">/ {cov.objectiveCount}</span>
          </p>
          <p className="mt-2 text-sm text-muted">objectives with at least {PRACTICE_MIN} approved</p>
        </Card>
        <Card title="Mock exams">
          <p className="font-display text-3xl">{cov.mockReady ? "Ready" : "Not yet"}</p>
          <p className="mt-2 text-sm text-muted">
            {cov.mockReady ? "Enough questions to vary the mocks." : `Mocks repeat questions until about ${cov.mockMin} are approved.`}
          </p>
        </Card>
      </div>

      <div className="grid gap-6">
        {cov.domains.map((d) => (
          <section key={d.id} className="min-w-0 rounded-theme border border-line bg-surface shadow-card">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
              <h2 className="font-display text-lg tracking-tight">{d.name} <span className="text-sm text-muted">· {d.weightPct}% of the exam</span></h2>
              <p className="text-sm tabular-nums text-muted">{d.approved} / {d.target} approved{d.draft > 0 ? ` · ${d.draft} draft` : ""}</p>
            </header>
            <ul className="divide-y divide-line">
              {d.objectives.map((o) => (
                <li key={o.id} className="grid gap-x-4 gap-y-2 px-5 py-3 text-sm md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-center">
                  <div className="min-w-0">
                    <Link href={`/library?objective=${o.id}`} className="hover:underline">
                      <span className="font-medium">{o.code}</span> {o.title}
                    </Link>
                  </div>
                  <div>
                    <StackedBar approved={o.approved} draft={o.draft} target={o.target} label={`${o.code}: ${o.approved} approved, ${o.draft} draft, target ${o.target}`} />
                    <p className="mt-1 text-xs tabular-nums text-muted">
                      {o.approved} / {o.target}{o.draft > 0 ? ` (+${o.draft} draft)` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={STAGE[o.stage].tone}>{STAGE[o.stage].label}</Badge>
                    {o.stage !== "full" && <Link href={`/library/prompt/${o.id}`} className="text-accent underline">Prompt</Link>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">Targets are a starting guide from docs/07 (even split within a domain), not an exam requirement.</p>
    </>
  );
}

function StackedBar({ approved, draft, target, label }) {
  const a = Math.min(100, (approved / (target || 1)) * 100);
  const d = Math.min(100 - a, (draft / (target || 1)) * 100);
  return (
    <div role="img" aria-label={label} className="flex h-2 w-full overflow-hidden rounded-full bg-idle-soft">
      <div className="h-full bg-ok" style={{ width: `${a}%` }} />
      <div className="h-full bg-info" style={{ width: `${d}%`, opacity: 0.6 }} />
    </div>
  );
}

