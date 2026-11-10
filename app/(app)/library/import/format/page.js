import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui/index.js";

export const metadata = { title: "Import file format" };

/** The import format, explained in the app, with an example that uses this course's own domain and objective codes. */
export default async function ImportFormatPage() {
  const { user, exam: active } = await getAppContext();
  if (!active)
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
  const exam = await withUser(user.id, (db) => getExam(db, active.id));
  const domain = exam.domains[0];
  const objective = domain?.objectives[0];
  const singleCount = exam.profile?.single?.options ?? 4;
  const example = {
    formatVersion: 1,
    questions: [
      {
        id: "my-0001",
        domain: domain?.key ?? "d1",
        objective: objective?.code ?? "1.1",
        type: "single",
        stem: "Your question text. Markdown works here.",
        options: Array.from({ length: singleCount }, (_, i) => ({
          text: i === 0 ? "The correct answer" : `A wrong answer ${i}`,
          correct: i === 0,
          rationale: i === 0 ? "Why this one is right." : "Why this one is wrong.",
        })),
        explanation: "Shown after answering.",
        difficulty: 2,
        tags: ["my-topic"],
        refs: ["https://docs.example.com/the-page-that-backs-this-up"],
        source: "own",
      },
    ],
  };

  const rules = [];
  if (exam.profile?.single?.options)
    rules.push(`One-answer questions have exactly ${exam.profile.single.options} options.`);
  if (exam.profile?.multi?.minOptions || exam.profile?.multi?.minCorrect)
    rules.push(
      `Multi-answer questions have at least ${exam.profile.multi.minOptions ?? 2} options and at least ${exam.profile.multi.minCorrect ?? 1} correct ones, and the question says how many to pick.`,
    );
  if (exam.profile?.bannedOptionText?.length)
    rules.push(`These option texts are not allowed: ${exam.profile.bannedOptionText.map((t) => `"${t}"`).join(", ")}.`);
  if (exam.profile?.outOfScopeTerms?.length)
    rules.push(
      `Questions that name a service or term the exam guide lists as out of scope are rejected (${exam.profile.outOfScopeTerms.length} terms).`,
    );

  return (
    <>
      <PageHeader
        title="Import file format"
        subtitle={`A JSON file of questions for ${exam.code}.`}
        actions={
          <LinkButton href="/library/import" variant="primary">
            Back to import
          </LinkButton>
        }
      />
      <div className="grid gap-4">
        <Card title="Example">
          <p className="mb-3 text-sm text-muted">
            This example uses a real domain and objective from {exam.code}, so it imports as it is.
            Add more questions to the <code>questions</code> list.
          </p>
          <pre className="overflow-x-auto rounded-theme bg-idle-soft p-3 text-xs leading-relaxed">
            {JSON.stringify(example, null, 2)}
          </pre>
        </Card>

        <Card title="Fields">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Field</th>
                  <th className="py-1.5 pr-3 font-medium">Needed</th>
                  <th className="py-1.5 font-medium">What it holds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {FIELDS.map(([name, needed, what]) => (
                  <tr key={name}>
                    <td className="py-2 pr-3">
                      <code>{name}</code>
                    </td>
                    <td className="py-2 pr-3">{needed}</td>
                    <td className="py-2">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {rules.length > 0 && (
          <Card title={`Rules for ${exam.code}`}>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Card>
        )}

        <Card title={`Domain and objective codes in ${exam.code}`}>
          <ul className="grid gap-3 text-sm md:grid-cols-2">
            {exam.domains.map((d) => (
              <li key={d.id}>
                <p className="font-medium">
                  <code>{d.key}</code> {d.name}
                </p>
                <ul className="mt-1 space-y-0.5 text-muted">
                  {d.objectives.map((o) => (
                    <li key={o.id}>
                      <code>{o.code}</code> {o.title}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>

        <p className="text-sm text-muted">
          Writing one question at a time? The{" "}
          <Link href="/library/questions/new" className="text-accent underline">
            New question
          </Link>{" "}
          form runs the same checks.
        </p>
      </div>
    </>
  );
}

const FIELDS = [
  ["formatVersion", "Yes", "Always 1."],
  ["questions", "Yes", "The list of questions."],
  ["id", "No", "Your own id. Importing a file again with the same id can update that question instead of adding a copy."],
  ["domain", "Yes", "A domain key or name from this course (listed below)."],
  ["objective", "Yes", "An objective code from that domain, such as 1.1."],
  ["type", "Yes", "single (one correct answer), multi (more than one) or tf (true or false)."],
  ["stem", "Yes", "The question text, in Markdown."],
  ["options", "Yes", "2 to 8 options, each with text and correct (true or false). Option text must not repeat."],
  ["options[].rationale", "Recommended", "Why that option is right or wrong. You get a warning when one is missing."],
  ["explanation", "No", "Shown after you answer."],
  ["difficulty", "No", "1 (easy) to 5 (hard)."],
  ["tags", "No", "Lowercase words joined by hyphens, such as my-topic."],
  ["refs", "No", "https links to the pages that back up the answer."],
  ["source", "No", "own or licensed questions go straight into practice. imported (the default) and ai-draft questions land in Drafts for you to approve. ai-draft also needs generator, generatedAt, lastVerified and refs."],
  ["reviewStatus", "No", "draft or approved, to override the default above."],
];
