"use client";
import { useState, useTransition } from "react";
import { Checkbox, CheckboxGroup, Radio, RadioGroup } from "react-aria-components";
import { finishSessionAction, saveNoteAction, submitAnswerAction, toggleBookmarkAction, toggleFlagAction } from "@/app/actions/practice.js";
import { optionKeys, ShortcutHelp, useShortcuts, useVisibleTime } from "@/components/SessionKeys.js";
import { Button, Meter } from "@/components/ui/index.js";
import { Markdown } from "@/components/ui/Markdown.js";

const CONFIDENCE = [
  ["guess", "Guess"],
  ["unsure", "Unsure"],
  ["sure", "Sure"],
];

export function PracticeRunner({ sessionId, questions, answered: initialAnswered, showConfidence = true }) {
  const firstOpen = questions.findIndex((q) => !initialAnswered[q.id]);
  const [index, setIndex] = useState(firstOpen === -1 ? questions.length - 1 : firstOpen);
  const [answered, setAnswered] = useState(initialAnswered);
  const [selected, setSelected] = useState([]);
  const [flags, setFlags] = useState(() => new Set(questions.filter((q) => q.flagged).map((q) => q.id)));
  const [bookmarks, setBookmarks] = useState(() => new Set(questions.filter((q) => q.bookmarked).map((q) => q.id)));
  const [confidence, setConfidence] = useState(null);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const timer = useVisibleTime();

  const q = questions[index];
  const feedback = answered[q.id];
  const doneCount = Object.keys(answered).length;
  const isLast = index === questions.length - 1;
  const multi = q.type === "multi";

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const fb = await submitAnswerAction({ sessionId, questionId: q.id, selected, timeMs: timer.elapsed(), confidence });
        setAnswered((a) => ({ ...a, [q.id]: fb }));
      } catch {
        setError("Could not save that answer. Check your connection and try again.");
      }
    });
  }

  function go(next) {
    setIndex(next);
    setSelected([]);
    setConfidence(null);
    setNote("");
    setNoteOpen(false);
    setError(null);
    timer.restart();
  }

  const mark = (action, setter) => () =>
    startTransition(async () => {
      const on = await action(q.id);
      setter((f) => {
        const n = new Set(f);
        if (on) n.add(q.id);
        else n.delete(q.id);
        return n;
      });
    });
  const flag = mark(toggleFlagAction, setFlags);
  const bookmark = mark(toggleBookmarkAction, setBookmarks);
  const finish = () => startTransition(() => finishSessionAction(sessionId));

  // Enter does whatever the primary button says: check, next, or finish.
  const primary = () => {
    if (pending) return;
    if (!feedback) {
      if (selected.length > 0) submit();
    } else if (isLast) finish();
    else go(index + 1);
  };
  const pick = (i) => {
    if (feedback || pending) return;
    const id = q.options[i]?.id;
    if (!id) return;
    setSelected((s) => (multi ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));
  };
  useShortcuts({
    ...optionKeys(q.options.length, pick),
    Enter: primary,
    f: flag,
    b: bookmark,
    n: () => setNoteOpen((o) => !o),
    ArrowLeft: () => index > 0 && go(index - 1),
    ArrowRight: () => feedback && !isLast && go(index + 1),
  });

  const optionClass = (id) => {
    if (!feedback) return "border-line bg-surface";
    const correct = feedback.correct.includes(id);
    const picked = feedback.selected.includes(id);
    if (correct) return "border-ok bg-ok-soft";
    if (picked) return "border-bad bg-bad-soft";
    return "border-line bg-surface opacity-80";
  };

  const Group = multi ? CheckboxGroup : RadioGroup;
  const Item = multi ? Checkbox : Radio;
  const groupProps = multi
    ? { value: selected, onChange: setSelected }
    : { value: selected[0] ?? null, onChange: (v) => setSelected([v]) };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3 text-sm text-muted">
        <span>Question {index + 1} of {questions.length}</span>
        <div className="flex-1"><Meter value={doneCount} max={questions.length} label="Progress" /></div>
        <span>{doneCount} answered</span>
      </div>

      <div className="rounded-theme border border-line bg-surface p-5">
        <Markdown text={q.stem} className="text-base" />
        {multi && <p className="mt-2 text-sm text-muted">Select all that apply.</p>}

        <Group aria-label="Answer options" isDisabled={!!feedback || pending} className="mt-4 flex flex-col gap-2" {...groupProps}>
          {q.options.map((o) => (
            <Item
              key={o.id}
              value={o.id}
              className={`group flex cursor-pointer gap-3 rounded-theme border p-3 text-sm data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus ${optionClass(o.id)}`}
            >
              <span aria-hidden className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-muted group-data-[selected]:border-accent group-data-[selected]:bg-accent" />
              <span className="flex-1">
                {o.text}
                {feedback && (
                  <span className="mt-1 block text-xs text-muted">
                    {feedback.correct.includes(o.id) ? "Correct. " : feedback.selected.includes(o.id) ? "Your answer. " : ""}
                    {feedback.rationales[o.id]}
                  </span>
                )}
              </span>
            </Item>
          ))}
        </Group>

        {showConfidence && !feedback && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">How sure are you?</span>
            {CONFIDENCE.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={confidence === value}
                onClick={(e) => {
                  setConfidence((c) => (c === value ? null : value));
                  // Let Enter go back to "Check answer" instead of pressing this chip again.
                  e.currentTarget.blur();
                }}
                className={`rounded-full border px-3 py-0.5 ${confidence === value ? "border-accent bg-accent text-on-accent" : "border-line"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {feedback && (
          <div role="status" className={`mt-4 rounded-theme p-3 text-sm ${feedback.isCorrect ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
            <strong>{feedback.isCorrect ? "Correct." : "Not quite."}</strong>
            {feedback.explanation && <span className="text-text"> {feedback.explanation}</span>}
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {!feedback ? (
            <Button variant="primary" onPress={submit} isDisabled={selected.length === 0 || pending}>Check answer</Button>
          ) : isLast ? (
            <Button variant="primary" onPress={finish} isDisabled={pending}>Finish and see results</Button>
          ) : (
            <Button variant="primary" onPress={() => go(index + 1)}>Next question</Button>
          )}
          {index > 0 && <Button variant="ghost" onPress={() => go(index - 1)}>Previous</Button>}
          <span className="flex-1" />
          <Button variant="ghost" onPress={flag} aria-pressed={flags.has(q.id)}>{flags.has(q.id) ? "Flagged" : "Flag"}</Button>
          <Button variant="ghost" onPress={bookmark} aria-pressed={bookmarks.has(q.id)}>{bookmarks.has(q.id) ? "Bookmarked" : "Bookmark"}</Button>
          <Button variant="ghost" onPress={() => setNoteOpen((o) => !o)}>Note</Button>
        </div>

        {noteOpen && (
          <div className="mt-3">
            <label className="sr-only" htmlFor="note">Note for this question</label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note.trim() && saveNoteAction(q.id, note)}
              rows={3}
              placeholder="Your note (saved when you click away)"
              className="w-full rounded-theme border border-line bg-surface p-2 text-sm"
            />
          </div>
        )}
      </div>

      {doneCount === questions.length && !isLast && (
        <p className="mt-3 text-sm text-muted">
          Every question is answered.{" "}
          <button className="text-accent underline" onClick={finish}>Finish the session</button>
        </p>
      )}

      <ShortcutHelp
        keys={[
          ["1-9", "Choose an option (toggles on multi-answer questions)"],
          ["Enter", "Check answer, then next question"],
          ["← →", "Previous / next question"],
          ["F", "Flag"],
          ["B", "Bookmark"],
          ["N", "Note"],
          ["?", "Show or hide this list"],
        ]}
      />
    </div>
  );
}
