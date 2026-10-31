"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Checkbox, CheckboxGroup, Radio, RadioGroup } from "react-aria-components";
import { saveMockAnswerAction } from "@/app/actions/mock.js";
import { finishSessionAction } from "@/app/actions/practice.js";
import { Button } from "@/components/ui/index.js";
import { Markdown } from "@/components/ui/Markdown.js";

const fmt = (s) => {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function MockRunner({ sessionId, questions, saved, endsAt }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(saved);
  const [flags, setFlags] = useState(() => new Set());
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState(null);
  const [left, setLeft] = useState(() => Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
  const [, startTransition] = useTransition();
  const submitted = useRef(false);

  const submit = () => {
    if (submitted.current) return;
    submitted.current = true;
    startTransition(() => finishSessionAction(sessionId));
  };

  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) submit();
    }, 1000);
    return () => clearInterval(t);
  }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = questions[index];
  const multi = q.type === "multi";
  const sel = answers[q.id] ?? [];
  const answeredCount = questions.filter((x) => (answers[x.id] ?? []).length > 0).length;

  async function choose(next) {
    setAnswers((a) => ({ ...a, [q.id]: next }));
    setError(null);
    const res = await saveMockAnswerAction({ sessionId, questionId: q.id, selected: next });
    if (!res.ok) setError(res.error?.includes("Time is up") ? "Time is up." : "Could not save that answer. Check your connection.");
  }

  const toggleFlag = () =>
    setFlags((f) => {
      const n = new Set(f);
      if (n.has(q.id)) n.delete(q.id);
      else n.add(q.id);
      return n;
    });

  const urgent = left <= 300;
  const Group = multi ? CheckboxGroup : RadioGroup;
  const Item = multi ? Checkbox : Radio;
  const groupProps = multi ? { value: sel, onChange: choose } : { value: sel[0] ?? null, onChange: (v) => choose([v]) };

  const header = (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
      <span className={`rounded-theme px-3 py-1 font-display text-lg tabular-nums ${urgent ? "bg-bad-soft text-bad" : "bg-idle-soft"}`} role="timer" aria-label="Time remaining">{fmt(left)}</span>
      <span className="text-muted">{answeredCount} of {questions.length} answered</span>
      <span className="flex-1" />
      <Button variant="secondary" onPress={() => setReviewing((r) => !r)}>{reviewing ? "Back to questions" : "Review and submit"}</Button>
    </div>
  );

  if (reviewing) {
    const unanswered = questions.filter((x) => (answers[x.id] ?? []).length === 0).length;
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <div className="rounded-theme border border-line bg-surface p-5">
          <h2 className="font-display text-xl">Review before submitting</h2>
          <p className="mt-1 text-sm text-muted">{unanswered} unanswered (they count as incorrect) · {flags.size} flagged</p>
          <ol className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
            {questions.map((x, i) => {
              const done = (answers[x.id] ?? []).length > 0;
              return (
                <li key={x.id}>
                  <button
                    onClick={() => { setIndex(i); setReviewing(false); }}
                    className={`relative w-full rounded-theme border py-2 text-sm ${done ? "border-accent bg-accent text-on-accent" : "border-line bg-surface"}`}
                    aria-label={`Question ${i + 1}, ${done ? "answered" : "unanswered"}${flags.has(x.id) ? ", flagged" : ""}`}
                  >
                    {i + 1}
                    {flags.has(x.id) && <span aria-hidden className="absolute -right-1 -top-1 size-3 rounded-full bg-warn" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-6 flex gap-2">
            <Button variant="primary" onPress={submit}>Submit exam</Button>
            <Button variant="ghost" onPress={() => setReviewing(false)}>Keep working</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {header}
      <div className="rounded-theme border border-line bg-surface p-5">
        <p className="mb-2 text-sm text-muted">Question {index + 1} of {questions.length}</p>
        <Markdown text={q.stem} />
        {multi && <p className="mt-2 text-sm text-muted">Select all that apply.</p>}
        <Group aria-label="Answer options" className="mt-4 flex flex-col gap-2" {...groupProps}>
          {q.options.map((o) => (
            <Item key={o.id} value={o.id} className="group flex cursor-pointer gap-3 rounded-theme border border-line bg-surface p-3 text-sm data-[selected]:border-accent data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus">
              <span aria-hidden className="mt-0.5 inline-flex size-4 shrink-0 rounded-full border border-muted group-data-[selected]:border-accent group-data-[selected]:bg-accent" />
              <span className="flex-1">{o.text}</span>
            </Item>
          ))}
        </Group>
        {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onPress={() => setIndex(index - 1)} isDisabled={index === 0}>Previous</Button>
          <Button variant="primary" onPress={() => (index === questions.length - 1 ? setReviewing(true) : setIndex(index + 1))}>
            {index === questions.length - 1 ? "Review" : "Next"}
          </Button>
          <span className="flex-1" />
          {sel.length > 0 && <Button variant="ghost" onPress={() => choose([])}>Clear answer</Button>}
          <Button variant="ghost" onPress={toggleFlag} aria-pressed={flags.has(q.id)}>{flags.has(q.id) ? "Flagged for review" : "Flag for review"}</Button>
        </div>
      </div>
    </div>
  );
}
