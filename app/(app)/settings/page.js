import { getAppContext } from "@/lib/app/context.js";
import { listPacks } from "@/lib/content/packs.js";
import { addExamFromPackAction, archiveExamAction, updateExamSettingsAction } from "@/app/actions/exam.js";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui/index.js";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { exams } = await getAppContext();
  const have = new Set(exams.map((e) => e.code));
  const available = listPacks().filter((p) => !have.has(p.code));

  return (
    <>
      <PageHeader title="Settings" subtitle="Exams and their targets." />

      <div className="grid gap-4">
        {exams.map((e) => (
          <Card key={e.id} title={`${e.code} · ${e.name}`}>
            <form action={updateExamSettingsAction} className="grid max-w-xl gap-4 md:grid-cols-2">
              <input type="hidden" name="examId" value={e.id} />
              <Field label="Readiness target (%)" hint="Objectives are 'On target' at or above this accuracy. Default 80.">
                <Input name="readinessTargetPct" type="number" min="1" max="100" defaultValue={e.readinessTargetPct} required />
              </Field>
              <Field label="Exam date (optional)">
                <Input name="examDate" type="date" defaultValue={e.examDate ?? ""} />
              </Field>
              <div className="md:col-span-2"><Button type="submit">Save</Button></div>
            </form>
            <dl className="mt-4 grid gap-1 border-t border-line pt-3 text-sm text-muted md:grid-cols-2">
              <div>Time limit: {e.timeLimitMin ?? "—"} min · Questions: {e.questionCount ?? "—"}</div>
              <div>Pass-mark proxy: {e.passMarkPct ?? "—"}%</div>
              {e.passMarkNote && <div className="md:col-span-2">{e.passMarkNote}</div>}
              {e.sources?.[0] && (
                <div className="md:col-span-2">
                  Source: {e.sources[0].title}, retrieved {e.sources[0].retrievedOn}.
                </div>
              )}
            </dl>
            <form action={archiveExamAction} className="mt-3">
              <input type="hidden" name="examId" value={e.id} />
              <input type="hidden" name="archived" value="true" />
              <Button type="submit" variant="ghost">Archive this exam</Button>
            </form>
          </Card>
        ))}

        <Card title="Add an exam">
          {available.length === 0 ? (
            <p className="text-sm text-muted">All available exam packs are added. To add another certification, follow docs/08-exam-pack-onboarding.md.</p>
          ) : (
            <ul className="divide-y divide-line">
              {available.map((p) => (
                <li key={p.code} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.code} · {p.name}</p>
                    <p className="text-muted">{p.vendor} · {p.domains} domains, {p.objectives} objectives · from "{p.source.title}" (retrieved {p.source.retrievedOn})</p>
                  </div>
                  <form action={addExamFromPackAction}>
                    <input type="hidden" name="code" value={p.code} />
                    <Button type="submit" variant="primary">Add</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
