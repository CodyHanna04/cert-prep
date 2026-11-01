import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExamProgress } from "@/lib/db/progress.js";
import { activityByDay, listSessions } from "@/lib/db/sessions.js";
import { appTimeZone, daysUntil, fmtDateTime, resumeHref } from "@/lib/app/view.js";
import { openCourseAction } from "@/app/actions/exam.js";
import { DomainRing } from "@/components/DomainRing.js";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  Meter,
  PageHeader,
  STATUS_META,
  pct,
} from "@/components/ui/index.js";

export const metadata = { title: "Dashboard" };

const DAYS = 14;

export default async function DashboardPage() {
  const { user, exams } = await getAppContext();
  if (exams.length === 0) {
    return (
      <>
        <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="Nothing to show yet." />
        <EmptyState
          title="Choose your first course"
          action={
            <LinkButton href="/courses" variant="primary">
              Browse courses
            </LinkButton>
          }
        >
          Each course follows the vendor's published exam blueprint. Once you start one, your
          progress shows up here.
        </EmptyState>
      </>
    );
  }

  const tz = appTimeZone();
  const courses = await withUser(user.id, (db) =>
    Promise.all(
      exams.map(async (e) => {
        const [{ exam, progress }, sessions, activity] = await Promise.all([
          getExamProgress(db, e.id),
          listSessions(db, e.id, 6),
          activityByDay(db, e.id, DAYS, tz),
        ]);
        return { exam, progress, sessions, activity };
      }),
    ),
  );

  const open = courses
    .map((c) => ({ course: c, session: c.sessions.find((s) => s.status === "in-progress") }))
    .filter((x) => x.session);
  const recent = courses
    .flatMap((c) => c.sessions.map((s) => ({ ...s, code: c.exam.code })))
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, 6);

  // Answers per day across every course, including empty days.
  const perDay = new Map();
  for (const c of courses)
    for (const a of c.activity) perDay.set(a.day, (perDay.get(a.day) ?? 0) + a.n);
  const bars = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS - 1 - i));
    const key = d.toLocaleDateString("en-CA", { timeZone: tz });
    return { key, n: perDay.get(key) ?? 0 };
  });
  const maxBar = Math.max(1, ...bars.map((b) => b.n));
  const answered = bars.reduce((s, b) => s + b.n, 0);
  const activeDays = bars.filter((b) => b.n > 0).length;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        actions={<LinkButton href="/courses">Browse courses</LinkButton>}
      />

      {open.length > 0 && (
        <section aria-label="Resume" className="mb-6 grid gap-3">
          {open.map(({ course, session }) => (
            <div
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-theme border border-accent bg-accent-soft p-4 shadow-card"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  Pick up where you left off
                </p>
                <p className="mt-1 font-display text-lg">
                  {course.exam.code} {session.mode === "mock" ? "mock exam" : "practice"}
                </p>
                <p className="text-sm text-muted">
                  {session.answered} of {session.total} answered · started{" "}
                  {fmtDateTime(session.startedAt)}
                </p>
              </div>
              <CourseButton examId={course.exam.id} to={resumeHref(session)} variant="primary">
                Resume
              </CourseButton>
            </div>
          ))}
        </section>
      )}

      <h2 className="mb-3 font-display text-xl tracking-tight">Your courses</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {courses.map(({ exam, progress }) => {
          const r = progress.readiness;
          const onTarget = progress.objectives.filter((o) => o.status === "on-target").length;
          const days = daysUntil(exam.examDate);
          return (
            <section
              key={exam.id}
              className="rounded-theme border border-line bg-surface p-5 shadow-card"
            >
              <div className="flex items-start gap-5">
                <DomainRing
                  size={112}
                  thickness={13}
                  label={`Readiness by domain for ${exam.code}`}
                  segments={progress.domains.map((d) => ({
                    weight: d.weightPct,
                    tone: STATUS_META[d.status]?.tone ?? "idle",
                    title: `${exam.domains.find((x) => x.id === d.domainId)?.name}: ${STATUS_META[d.status]?.label}`,
                  }))}
                >
                  <span className="font-display text-2xl leading-none">
                    {r.available ? pct(r.scorePct) : "—"}
                  </span>
                  <span className="mt-0.5 text-[0.65rem] uppercase tracking-wider text-muted">
                    ready
                  </span>
                </DomainRing>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg leading-snug tracking-tight">{exam.name}</h3>
                  <p className="text-sm text-muted">
                    {exam.code} · target {exam.readinessTargetPct}%
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.available ? (
                      <Badge tone={r.meetsTarget ? "ok" : "warn"}>
                        {r.meetsTarget ? "At or above target" : "Below target"}
                      </Badge>
                    ) : (
                      <Badge tone="idle">Building a baseline</Badge>
                    )}
                    {days != null && (
                      <Badge tone={days <= 14 ? "warn" : "info"}>
                        {days < 0
                          ? "Exam date passed"
                          : days === 0
                            ? "Exam today"
                            : `Exam in ${days} day${days === 1 ? "" : "s"}`}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>Objectives on target</span>
                  <span className="tabular-nums">
                    {onTarget} / {progress.objectives.length}
                  </span>
                </div>
                <Meter
                  value={onTarget}
                  max={progress.objectives.length || 1}
                  label={`Objectives on target in ${exam.code}`}
                  tone="ok"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <CourseButton examId={exam.id} to="/course" variant="primary">
                  Open course
                </CourseButton>
                <CourseButton examId={exam.id} to="/practice">
                  Practice
                </CourseButton>
                <CourseButton examId={exam.id} to="/map">
                  Map
                </CourseButton>
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card title={`Last ${DAYS} days`} className="md:col-span-2">
          <div className="mb-3 flex gap-6 text-sm">
            <p>
              <span className="font-display text-2xl">{answered}</span>{" "}
              <span className="text-muted">questions answered</span>
            </p>
            <p>
              <span className="font-display text-2xl">{activeDays}</span>{" "}
              <span className="text-muted">active day{activeDays === 1 ? "" : "s"}</span>
            </p>
          </div>
          <div
            className="flex h-28 items-end gap-1.5"
            role="img"
            aria-label={`Questions answered per day: ${bars.map((b) => b.n).join(", ")}`}
          >
            {bars.map((b) => (
              <div
                key={b.key}
                title={`${b.key}: ${b.n}`}
                className="flex-1 rounded-t-sm bg-accent"
                style={{ height: `${Math.max(4, (b.n / maxBar) * 100)}%`, opacity: b.n ? 1 : 0.18 }}
              />
            ))}
          </div>
        </Card>

        <Card
          title="Recent sessions"
          action={
            <Link href="/history" className="text-sm text-accent underline">
              History
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="text-sm text-muted">
              No sessions yet. Open a course and start practicing.
            </p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {recent.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-2">
                  <span>
                    <span className="font-medium">{s.code}</span>{" "}
                    <span className="capitalize text-muted">{s.mode}</span>
                    <span className="block text-xs text-muted">{fmtDateTime(s.startedAt)}</span>
                  </span>
                  <span className="tabular-nums">
                    {s.status === "in-progress" ? (
                      <span className="text-accent">in progress</span>
                    ) : s.status === "abandoned" ? (
                      <span className="text-muted">abandoned</span>
                    ) : (
                      `${s.correct}/${s.total}`
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function CourseButton({ examId, to, variant = "secondary", children }) {
  return (
    <form action={openCourseAction}>
      <input type="hidden" name="examId" value={examId} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" variant={variant}>
        {children}
      </Button>
    </form>
  );
}
