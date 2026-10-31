"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approveQuestionAction, rejectQuestionAction } from "@/app/actions/library.js";
import { Badge, Button, Field, Input } from "@/components/ui/index.js";
import { Markdown } from "@/components/ui/Markdown.js";

/** Blind review: answer first, then the key, rationales and sources are revealed. */
export function ReviewCard({ question, objective, remaining, editHref }) {
  const router = useRouter();
  const [picked, setPicked] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  const multi = question.type === "multi";

  const toggle = (id) => setPicked((p) => (multi ? (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) : [id]));
  const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
  const agrees = revealed && picked.length === correctIds.length && picked.every((p) => correctIds.includes(p));

  function act(fn) {
    setError(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e.message || "Something went wrong.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm text-muted">{remaining} draft{remaining === 1 ? "" : "s"} left · {objective}</p>
      <div className="rounded-theme border border-line bg-surface p-5">
        <Markdown text={question.stem} />
        {multi && <p className="mt-2 text-sm text-muted">Select all that apply.</p>}
        <ul className="mt-4 space-y-2">
          {question.options.map((o) => {
            const isPicked = picked.includes(o.id);
            const tone = !revealed ? (isPicked ? "border-accent" : "border-line") : o.isCorrect ? "border-ok bg-ok-soft" : isPicked ? "border-bad bg-bad-soft" : "border-line";
            return (
              <li key={o.id}>
                <label className={`flex cursor-pointer gap-3 rounded-theme border p-3 text-sm ${tone}`}>
                  <input type={multi ? "checkbox" : "radio"} name="answer" checked={isPicked} disabled={revealed} onChange={() => toggle(o.id)} />
                  <span className="flex-1">
                    {o.text}
                    {revealed && <span className="mt-1 block text-xs text-muted">{o.isCorrect ? "Marked correct. " : ""}{o.rationale}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {!revealed ? (
          <div className="mt-5">
            <Button variant="primary" onPress={() => setRevealed(true)} isDisabled={picked.length === 0}>Reveal the key</Button>
          </div>
        ) : (
          <>
            <div role="status" className={`mt-4 rounded-theme p-3 text-sm ${agrees ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
              {agrees ? "You agree with the marked answer." : "Your answer differs from the marked answer. Check the sources before approving."}
            </div>
            {question.explanation && <p className="mt-3 text-sm">{question.explanation}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              {question.generator && <Badge tone="info">{question.generator}</Badge>}
              {question.needsAttention && <Badge tone="warn">flagged by the verification pass</Badge>}
            </div>
            {question.refs.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {question.refs.map((r) => <li key={r}><a className="text-accent underline" href={r} target="_blank" rel="noopener noreferrer nofollow">{r}</a></li>)}
              </ul>
            )}
            {rejecting ? (
              <div className="mt-4 grid gap-2">
                <Field label="Why reject it?"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                <div className="flex gap-2">
                  <Button variant="danger" isDisabled={pending || !reason.trim()} onPress={() => act(() => rejectQuestionAction(question.id, reason))}>Reject</Button>
                  <Button variant="ghost" onPress={() => setRejecting(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="primary" isDisabled={pending} onPress={() => act(() => approveQuestionAction(question.id))}>Approve</Button>
                <Link href={editHref} className="inline-flex items-center rounded-theme border border-line bg-surface px-4 py-2 text-sm hover:bg-raised">Edit</Link>
                <Button variant="danger" onPress={() => setRejecting(true)}>Reject…</Button>
              </div>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
