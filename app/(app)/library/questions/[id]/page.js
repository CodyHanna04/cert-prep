import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { getNote, getQuestion } from "@/lib/db/questions.js";
import { questionAttempts } from "@/lib/db/sessions.js";
import { isUuid } from "@/lib/app/feedback.js";
import { fmtDateTime, indexExam } from "@/lib/app/view.js";
import { fmtDuration } from "@/lib/domain/timing.js";
import { Badge, Card, PageHeader } from "@/components/ui/index.js";
import { Markdown } from "@/components/ui/Markdown.js";
import { QuestionEditor } from "./QuestionEditor.js";

export const metadata = { title: "Question" };

export default async function QuestionPage({ params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { user } = await getAppContext();
  const data = await withUser(user.id, async (db) => {
    const q = await getQuestion(db, id);
    if (!q) return null;
    return { q, exam: await getExam(db, q.examId), note: await getNote(db, id), attempts: await questionAttempts(db, id) };
  });
  if (!data) notFound();
  const { q, exam, note, attempts } = data;
  const ob = indexExam(exam).objectiveById.get(q.objectiveId);

  return (
    <>
      <PageHeader
        title={`${ob?.code} · ${q.type}`}
        subtitle={ob?.title}
        actions={<Badge tone={q.reviewStatus === "approved" ? "ok" : q.reviewStatus === "draft" ? "info" : "bad"}>{q.reviewStatus}</Badge>}
      />
      {q.rejectReason && <p className="mb-4 rounded-theme border border-bad bg-bad-soft p-3 text-sm text-bad">Rejected: {q.rejectReason}</p>}
      {q.fromBank ? (
        <BankQuestion q={q} />
      ) : (
        <QuestionEditor
          question={{ id: q.id, type: q.type, stem: q.stem, explanation: q.explanation ?? "", difficulty: q.difficulty ?? "", tags: q.tags.join(", "), options: q.options }}
        />
      )}
      <Card title="Provenance" className="mt-4">
        <dl className="grid gap-1 text-sm md:grid-cols-2">
          <div><dt className="inline text-muted">Source: </dt><dd className="inline">{q.fromBank ? `shared bank (${q.source})` : q.source}</dd></div>
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
      <Attempts attempts={attempts} />
    </>
  );
}

/** Shared-bank questions are read-only: they are maintained in content/<pack>/bank/ and synced to everyone. */
function BankQuestion({ q }) {
  return (
    <Card title="Question">
      <p className="mb-3 text-sm text-muted">This question is part of the shared question bank, so it can&apos;t be edited here.</p>
      <Markdown text={q.stem} />
      <ol className="mt-3 space-y-2 text-sm">
        {q.options.map((o) => (
          <li key={o.id} className={`rounded-theme border p-3 ${o.isCorrect ? "border-ok bg-ok-soft" : "border-line"}`}>
            <p><span className="font-medium">{o.id.toUpperCase()}.</span> {o.text}{o.isCorrect && <span className="ml-2 font-medium text-ok">Correct</span>}</p>
            {o.rationale && <p className="mt-1 text-muted">{o.rationale}</p>}
          </li>
        ))}
      </ol>
      {q.explanation && <div className="mt-3 text-sm"><Markdown text={q.explanation} /></div>}
    </Card>
  );
}

const CONFIDENCE_LABEL = { guess: "Guessed", unsure: "Unsure", sure: "Sure" };

/** Every time you answered this question, newest first. */
function Attempts({ attempts }) {
  const correct = attempts.filter((a) => a.isCorrect).length;
  return (
    <section id="attempts" className="mt-4 min-w-0 scroll-mt-4 rounded-theme border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display text-lg tracking-tight">Your attempts</h2>
      {attempts.length === 0 ? (
        <p className="mt-2 text-sm text-muted">You haven&apos;t answered this question yet.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">{correct} of {attempts.length} correct</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-1 font-normal">When</th><th className="font-normal">Mode</th><th className="font-normal">Result</th><th className="font-normal">Answer</th><th className="font-normal">Time</th><th className="font-normal">Confidence</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attempts.map((a) => (
                  <tr key={a.sessionId}>
                    <td className="py-1.5"><Link className="hover:underline" href={`/history/${a.sessionId}`}>{fmtDateTime(a.answeredAt)}</Link></td>
                    <td className="capitalize">{a.mode}</td>
                    <td><Badge tone={a.isCorrect ? "ok" : "bad"}>{a.isCorrect ? "correct" : "incorrect"}</Badge></td>
                    <td className="uppercase">{a.selectedOptionIds.join(", ")}</td>
                    <td className="tabular-nums">{a.timeMs != null ? fmtDuration(a.timeMs) : "—"}</td>
                    <td>{a.confidence ? CONFIDENCE_LABEL[a.confidence] : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
