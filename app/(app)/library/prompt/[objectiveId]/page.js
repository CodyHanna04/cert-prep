import Link from "next/link";
import { notFound } from "next/navigation";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { listQuestions } from "@/lib/db/questions.js";
import { isUuid } from "@/lib/app/feedback.js";
import { appTimeZone, indexExam } from "@/lib/app/view.js";
import { fillDraftPrompt, promptBody } from "@/lib/content/prompt.js";
import { CopyButton } from "@/components/CopyButton.js";
import { Button, Field, Input, PageHeader } from "@/components/ui/index.js";

export const metadata = { title: "Drafting prompt" };

export default async function PromptPage({ params, searchParams }) {
  const { objectiveId } = await params;
  if (!isUuid(objectiveId)) notFound();
  const sp = await searchParams;
  const count = Math.min(25, Math.max(1, Number.parseInt(sp.count ?? "10", 10) || 10));
  const { user, exam: active } = await getAppContext();
  if (!active) notFound();

  const data = await withUser(user.id, async (db) => {
    const exam = await getExam(db, active.id);
    const objective = indexExam(exam).objectiveById.get(objectiveId);
    if (!objective) return null;
    const existing = await listQuestions(db, active.id, { objectiveId, limit: 60 });
    return { exam, objective, existing };
  });
  if (!data) notFound();
  const { exam, objective, existing } = data;

  const packDir = exam.code.toLowerCase();
  const root = join(process.cwd(), "content");
  const stylePath = join(root, packDir, "style.md");
  const template = promptBody(readFileSync(join(root, "prompts", "draft-questions.md"), "utf8"));
  const prompt = fillDraftPrompt(template, {
    exam,
    domain: objective.domain,
    objective,
    count,
    packDir,
    style: existsSync(stylePath) ? readFileSync(stylePath, "utf8") : null,
    existingStems: existing.filter((q) => q.reviewStatus !== "rejected").map((q) => q.stem),
    startNumber: existing.length + 1,
    today: new Date().toLocaleDateString("en-CA", { timeZone: appTimeZone() }),
  });

  return (
    <>
      <PageHeader
        title={`Drafting prompt for ${objective.code}`}
        subtitle={objective.title}
        actions={
          <Link href="/library/coverage" className="text-sm text-accent underline">
            Back to coverage
          </Link>
        }
      />

      <div className="mb-4 max-w-2xl space-y-2 text-sm text-muted">
        <p>
          Give this to a model that can open the vendor&apos;s documentation, together with{" "}
          <code>content/{packDir}/in-scope-services.md</code>. It should save a file under{" "}
          <code>content/{packDir}/questions/</code>. Then run <code>npm run content:lint</code> and
          follow <code>content/prompts/README.md</code>.
        </p>
        <p>
          {existing.length} existing question{existing.length === 1 ? "" : "s"} for this objective{" "}
          {existing.length === 1 ? "is" : "are"} listed in the prompt so the new batch avoids
          repeating {existing.length === 1 ? "it" : "them"}.
        </p>
      </div>

      <form method="get" className="mb-4 flex max-w-xs items-end gap-2">
        <Field label="Questions in this batch">
          <Input name="count" type="number" min="1" max="25" defaultValue={count} />
        </Field>
        <Button type="submit">Update</Button>
      </form>

      <div className="mb-2">
        <CopyButton text={prompt} label="Copy prompt" />
      </div>
      <textarea
        readOnly
        value={prompt}
        aria-label="Drafting prompt"
        rows={28}
        className="w-full rounded-theme border border-line bg-surface p-3 font-mono text-xs leading-relaxed"
      />
    </>
  );
}
