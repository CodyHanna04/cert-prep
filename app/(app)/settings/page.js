import { getAppContext } from "@/lib/app/context.js";
import { appTimeZone } from "@/lib/app/view.js";
import {
  pauseCourseAction,
  setExamOutcomeAction,
  updateExamSettingsAction,
} from "@/app/actions/exam.js";
import {
  Button,
  Card,
  checkClass,
  EmptyState,
  Field,
  Input,
  LinkButton,
  optionCardClass,
  OutcomeBadge,
  PageHeader,
} from "@/components/ui/index.js";

const OUTCOME_CHOICES = [
  { id: "passed", name: "I passed the exam", note: "Shows a Passed badge, with the date and score if you add them." },
  { id: "finished", name: "I'm finished with this course", note: "For when you're done studying, whatever the result." },
];

export const metadata = { title: "Course settings" };

export default async function SettingsPage() {
  const { exam: e } = await getAppContext();
  if (!e)
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

  return (
    <>
      <PageHeader title="Course settings" subtitle={`${e.code} · ${e.name}`} />

      <div className="grid max-w-2xl gap-6">
        <Card title="Mark this course done">
          {e.outcome && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <OutcomeBadge exam={e} />
              <form action={setExamOutcomeAction}>
                <input type="hidden" name="examId" value={e.id} />
                <input type="hidden" name="outcome" value="" />
                <Button type="submit" variant="secondary">
                  Clear
                </Button>
              </form>
            </div>
          )}
          <form action={setExamOutcomeAction} className="grid gap-4">
            <input type="hidden" name="examId" value={e.id} />
            <div className="grid gap-2 text-sm">
              {OUTCOME_CHOICES.map((o) => (
                <label key={o.id} className={optionCardClass}>
                  <input
                    type="radio"
                    name="outcome"
                    value={o.id}
                    defaultChecked={(e.outcome ?? "passed") === o.id}
                    className={`mt-0.5 ${checkClass}`}
                  />
                  <span>
                    <span className="font-medium">{o.name}</span>{" "}
                    <span className="block text-muted">{o.note}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Date">
                <Input
                  name="outcomeDate"
                  type="date"
                  defaultValue={
                    e.outcomeDate ?? new Date().toLocaleDateString("en-CA", { timeZone: appTimeZone() })
                  }
                />
              </Field>
              <Field label="Scaled score (optional)" hint="100 to 1,000. Only kept for a pass.">
                <Input
                  name="outcomeScore"
                  type="number"
                  min="100"
                  max="1000"
                  defaultValue={e.outcomeScore ?? ""}
                />
              </Field>
            </div>
            <div>
              <Button type="submit" variant="primary">
                {e.outcome ? "Update" : "Mark done"}
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Target and exam date">
          <form action={updateExamSettingsAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="examId" value={e.id} />
            <Field
              label="Readiness target (%)"
              hint="Objectives are 'On target' at or above this accuracy. Default 80."
            >
              <Input
                name="readinessTargetPct"
                type="number"
                min="1"
                max="100"
                defaultValue={e.readinessTargetPct}
                required
              />
            </Field>
            <Field label="Exam date (optional)" hint="Shows a countdown on your dashboard.">
              <Input name="examDate" type="date" defaultValue={e.examDate ?? ""} />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit" variant="primary">
                Save
              </Button>
            </div>
          </form>
        </Card>

        <Card title="About this exam">
          <dl className="grid gap-1 text-sm text-muted md:grid-cols-2">
            <div>
              Time limit: {e.timeLimitMin ?? "—"} min · Questions: {e.questionCount ?? "—"}
            </div>
            <div>Pass-mark proxy: {e.passMarkPct ?? "—"}%</div>
            {e.passMarkNote && <div className="md:col-span-2">{e.passMarkNote}</div>}
            {e.sources?.[0] && (
              <div className="md:col-span-2">
                Source: {e.sources[0].title}, retrieved {e.sources[0].retrievedOn}.
              </div>
            )}
          </dl>
        </Card>

        <Card title="Pause this course">
          <p className="text-sm text-muted">
            Hides it from your dashboard. Nothing is deleted: your questions, answers and history
            stay, and starting the course again from the Courses page brings them back.
          </p>
          <form action={pauseCourseAction} className="mt-3">
            <input type="hidden" name="examId" value={e.id} />
            <Button type="submit" variant="secondary">
              Pause course
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
