import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { getNote, getQuestion } from "@/lib/db/questions.js";
import { isUuid } from "@/lib/app/feedback.js";
import { indexExam } from "@/lib/app/view.js";
import { Badge, Card, PageHeader } from "@/components/ui/index.js";
import { QuestionEditor } from "./QuestionEditor.js";

export const metadata = { title: "Question" };

export default async function QuestionPage({ params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { user } = await getAppContext();
  const data = await withUser(user.id, async (db) => {
    const q = await getQuestion(db, id);
    if (!q) return null;
    return { q, exam: await getExam(db, q.examId), note: await getNote(db, id) };
  });
  if (!data) notFound();
  const { q, exam, note } = data;
  const ob = indexExam(exam).objectiveById.get(q.objectiveId);

  return (
    <>
      <PageHeader
        title={`${ob?.code} · ${q.type}`}
        subtitle={ob?.title}
        actions={<Badge tone={q.reviewStatus === "approved" ? "ok" : q.reviewStatus === "draft" ? "info" : "bad"}>{q.reviewStatus}</Badge>}
      />
      {q.rejectReason && <p className="mb-4 rounded-theme border border-bad bg-bad-soft p-3 text-sm text-bad">Rejected: {q.rejectReason}</p>}
      <QuestionEditor
        question={{ id: q.id, type: q.type, stem: q.stem, explanation: q.explanation ?? "", difficulty: q.difficulty ?? "", tags: q.tags.join(", "), options: q.options }}
      />
      <Card title="Provenance" className="mt-4">
        <dl className="grid gap-1 text-sm md:grid-cols-2">
          <div><dt className="inline text-muted">Source: </dt><dd className="inline">{q.source}</dd></div>
          {q.generator && <div><dt className="inline text-muted">Generator: </dt><dd className="inline">{q.generator}</dd></div>}
          {q.externalId && <div><dt className="inline text-muted">Import id: </dt><dd className="inline">{q.externalId}</dd></div>}
        </dl>
        {q.refs.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {q.refs.map((r) => <li key={r}><a className="text-accent underline" href={r} target="_blank" rel="noopener noreferrer nofollow">{r}</a></li>)}
          </ul>
        )}
        {note && <p className="mt-3 text-sm"><span className="text-muted">Your note: </span>{note}</p>}
      </Card>
    </>
  );
}
