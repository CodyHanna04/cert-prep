import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { listExams, listPausedExams } from "@/lib/db/exams.js";
import { listPacks } from "@/lib/content/packs.js";
import { readPackBank } from "@/lib/content/bank.js";
import { enrollAction, openCourseAction } from "@/app/actions/exam.js";
import { DomainRing } from "@/components/DomainRing.js";
import { Badge, Button, PageHeader } from "@/components/ui/index.js";

export const metadata = { title: "Courses" };

const SHADES = [1, 0.72, 0.5, 0.34, 0.24, 0.18];
const STATE_ORDER = { studying: 0, paused: 1, new: 2 };

export default async function CoursesPage() {
  const { user } = await getAppContext();
  const { active, paused } = await withUser(user.id, async (db) => ({
    active: await listExams(db),
    paused: await listPausedExams(db),
  }));
  const activeByCode = new Map(active.map((e) => [e.code, e]));
  const pausedCodes = new Set(paused.map((e) => e.code));

  const courses = listPacks()
    .map((p) => ({
      pack: p,
      exam: activeByCode.get(p.code) ?? null,
      state: activeByCode.has(p.code) ? "studying" : pausedCodes.has(p.code) ? "paused" : "new",
    }))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Every course is built from the vendor's published exam blueprint, so your progress maps to what the exam really covers."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {courses.map(({ pack: p, exam, state }) => (
          <article
            key={p.code}
            className="flex flex-col overflow-hidden rounded-theme border border-line bg-surface shadow-card"
          >
            <div className="flex items-start gap-5 bg-accent-soft p-5">
              <DomainRing
                size={104}
                thickness={13}
                label={`Exam weighting: ${p.domainWeights.map((d) => `${d.name} ${d.weightPct}%`).join(", ")}`}
                segments={p.domainWeights.map((d, i) => ({
                  weight: d.weightPct,
                  opacity: SHADES[i % SHADES.length],
                  title: `${d.name}: ${d.weightPct}%`,
                }))}
              >
                <span className="font-display text-xs font-semibold leading-tight">{p.code}</span>
              </DomainRing>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  {p.vendor}
                  {p.marketing && ` · ${p.marketing.level}`}
                </p>
                <h2 className="mt-1 font-display text-xl leading-snug tracking-tight">{p.name}</h2>
                {p.marketing && <p className="mt-2 text-sm">{p.marketing.tagline}</p>}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 p-5">
              {p.marketing && <p className="text-sm text-muted">{p.marketing.audience}</p>}

              <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <Stat label="on the exam" value={p.questionCount ?? "—"} />
                <Stat label="minutes" value={p.timeLimitMin ?? "—"} />
                <Stat label="objectives" value={p.objectives} />
                <Stat label="practice questions" value={readPackBank(p.code).questions.length || "Soon"} />
              </dl>

              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                  What the exam covers
                </h3>
                <ul className="space-y-1.5">
                  {p.domainWeights.map((d, i) => (
                    <li
                      key={d.key}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full bg-accent"
                          style={{ opacity: SHADES[i % SHADES.length] }}
                        />
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="tabular-nums text-muted">{d.weightPct}%</span>
                    </li>
                  ))}
                </ul>
              </div>

              {p.marketing?.highlights.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                  {p.marketing.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="max-w-[16rem] text-xs text-muted">
                  Blueprint: {p.source.title}, retrieved {p.source.retrievedOn}.
                </p>
                <div className="flex items-center gap-3">
                  {state === "studying" && <Badge tone="ok">Studying</Badge>}
                  {state === "paused" && <Badge tone="idle">Paused</Badge>}
                  {state === "studying" ? (
                    <form action={openCourseAction}>
                      <input type="hidden" name="examId" value={exam.id} />
                      <input type="hidden" name="to" value="/course" />
                      <Button type="submit" variant="primary">
                        Continue
                      </Button>
                    </form>
                  ) : (
                    <form action={enrollAction}>
                      <input type="hidden" name="code" value={p.code} />
                      <Button type="submit" variant="primary">
                        {state === "paused" ? "Resume course" : "Start studying"}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}

        <div className="flex flex-col justify-center rounded-theme border border-dashed border-line p-6 text-sm text-muted">
          <p className="font-display text-lg text-text">More certifications</p>
          <p className="mt-1">
            A course is a blueprint file plus questions. New ones are added to the app by following
            the exam pack guide (docs/08-exam-pack-onboarding.md), then they appear here.
          </p>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-theme bg-idle-soft px-2 py-2">
      <dd className="font-display text-2xl tabular-nums">{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}
