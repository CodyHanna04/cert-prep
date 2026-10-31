"use client";
import { useState, useTransition } from "react";
import { updateQuestionAction } from "@/app/actions/library.js";
import { Button, Card, Field, Input, Textarea } from "@/components/ui/index.js";

export function QuestionEditor({ question }) {
  const [stem, setStem] = useState(question.stem);
  const [explanation, setExplanation] = useState(question.explanation);
  const [difficulty, setDifficulty] = useState(String(question.difficulty));
  const [tags, setTags] = useState(question.tags);
  const [options, setOptions] = useState(question.options.map((o) => ({ text: o.text, correct: o.isCorrect, rationale: o.rationale ?? "" })));
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();

  const setOpt = (i, patch) => setOptions((os) => os.map((o, j) => (i === j ? { ...o, ...patch } : o)));

  function save(e) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const res = await updateQuestionAction({
        id: question.id,
        stem,
        explanation,
        difficulty: difficulty === "" ? undefined : Number(difficulty),
        tags,
        options,
      });
      setMessage(res.error ? { error: res.error } : { ok: "Saved." });
    });
  }

  return (
    <form onSubmit={save}>
      <Card title="Edit">
        <div className="grid gap-4">
          <Field label="Question (markdown)">
            <Textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={4} required />
          </Field>
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">Options ({question.type === "multi" ? "tick every correct one" : "tick the one correct answer"})</legend>
            {options.map((o, i) => (
              <div key={i} className="grid gap-2 rounded-theme border border-line p-3 md:grid-cols-[auto_1fr_1fr]">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type={question.type === "multi" ? "checkbox" : "radio"}
                    name="correct"
                    checked={o.correct}
                    onChange={(e) => (question.type === "multi" ? setOpt(i, { correct: e.target.checked }) : setOptions((os) => os.map((x, j) => ({ ...x, correct: j === i }))))}
                    aria-label={`Option ${i + 1} is correct`}
                  />
                  {String.fromCharCode(65 + i)}
                </label>
                <Input value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} aria-label={`Option ${i + 1} text`} required />
                <Input value={o.rationale} onChange={(e) => setOpt(i, { rationale: e.target.value })} placeholder="Why this is right or wrong" aria-label={`Option ${i + 1} rationale`} />
              </div>
            ))}
          </fieldset>
          <Field label="Explanation">
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Difficulty (1-5)">
              <Input type="number" min="1" max="5" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} />
            </Field>
            <Field label="Tags" hint="Comma-separated, lowercase-kebab-case.">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" isDisabled={pending}>Save changes</Button>
            {message?.ok && <span role="status" className="text-sm text-ok">{message.ok}</span>}
            {message?.error && <span role="alert" className="text-sm text-bad">{message.error}</span>}
          </div>
        </div>
      </Card>
    </form>
  );
}
