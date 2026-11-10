"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQuestionAction, updateQuestionAction } from "@/app/actions/library.js";
import { Button, Card, checkClass, Field, Input, Select, Textarea } from "@/components/ui/index.js";

const MAX_OPTIONS = 8;
const blank = () => ({ text: "", correct: false, rationale: "" });
const TF = [
  { text: "True", correct: true, rationale: "" },
  { text: "False", correct: false, rationale: "" },
];

/** How many options a new question of this type starts with, following the exam's profile when it has one. */
function startingOptions(type, profile) {
  if (type === "tf") return TF.map((o) => ({ ...o }));
  const n = type === "multi" ? Math.max(5, profile?.multi?.minOptions ?? 5) : (profile?.single?.options ?? 4);
  return Array.from({ length: n }, blank);
}

/**
 * Edits one of your own questions, or writes a new one when `question` is null. A new question also picks its
 * objective, type, references and whether it goes straight into practice (approved) or into Drafts.
 * Both paths run the same checks as an import, including the exam's rules on option counts.
 */
export function QuestionEditor({ question = null, objectives = [], defaultObjectiveId, profile = null }) {
  const isNew = question == null;
  const router = useRouter();
  const [objectiveId, setObjectiveId] = useState(defaultObjectiveId ?? objectives[0]?.id ?? "");
  const [type, setType] = useState(question?.type ?? "single");
  const [stem, setStem] = useState(question?.stem ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [difficulty, setDifficulty] = useState(question ? String(question.difficulty) : "");
  const [tags, setTags] = useState(question?.tags ?? "");
  const [refs, setRefs] = useState("");
  const [status, setStatus] = useState("approved");
  const [options, setOptions] = useState(() =>
    question
      ? question.options.map((o) => ({ text: o.text, correct: o.isCorrect, rationale: o.rationale ?? "" }))
      : startingOptions("single", profile),
  );
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();

  const setOpt = (i, patch) => setOptions((os) => os.map((o, j) => (i === j ? { ...o, ...patch } : o)));
  const changeType = (t) => {
    setType(t);
    setOptions(startingOptions(t, profile));
  };
  const multi = type === "multi";
  const fixed = type === "tf";
  // The exam's profile can fix the option count (CLF-C02: exactly 4 for one answer, at least 5 for several).
  const minOptions = multi ? Math.max(2, profile?.multi?.minOptions ?? 2) : (profile?.single?.options ?? 2);
  const maxOptions = !multi && profile?.single?.options ? profile.single.options : MAX_OPTIONS;
  const canRemove = isNew && !fixed && options.length > minOptions;
  const canAdd = isNew && !fixed && options.length < maxOptions;
  const resizable = isNew && !fixed && minOptions < maxOptions;

  function save(e) {
    e.preventDefault();
    setMessage(null);
    const common = {
      stem,
      explanation,
      difficulty: difficulty === "" ? undefined : Number(difficulty),
      tags,
      options,
    };
    start(async () => {
      if (isNew) {
        const res = await createQuestionAction({
          ...common,
          objectiveId,
          type,
          status,
          refs: refs.split(/\s+/).filter(Boolean),
        });
        if (res.error) setMessage({ error: res.error });
        else router.push(`/library/questions/${res.id}`);
        return;
      }
      const res = await updateQuestionAction({ id: question.id, ...common });
      setMessage(res.error ? { error: res.error } : { ok: "Saved." });
    });
  }

  return (
    <form onSubmit={save}>
      <Card title={isNew ? "Question" : "Edit"}>
        <div className="grid gap-4">
          {isNew && (
            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <Field label="Objective">
                <Select value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)} required>
                  {objectives.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.code} {o.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Type">
                <Select value={type} onChange={(e) => changeType(e.target.value)}>
                  <option value="single">One correct answer</option>
                  <option value="multi">More than one correct answer</option>
                  <option value="tf">True or false</option>
                </Select>
              </Field>
            </div>
          )}
          <Field
            label="Question (markdown)"
            hint={multi ? "Say how many to pick, for example (Select TWO.)" : undefined}
          >
            <Textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={4} required />
          </Field>
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">
              Options ({multi ? "tick every correct one" : "tick the one correct answer"})
            </legend>
            {options.map((o, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-theme border border-line p-3 md:grid-cols-[auto_1fr_1fr_auto]"
              >
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type={multi ? "checkbox" : "radio"}
                    className={checkClass}
                    name="correct"
                    checked={o.correct}
                    onChange={(e) =>
                      multi
                        ? setOpt(i, { correct: e.target.checked })
                        : setOptions((os) => os.map((x, j) => ({ ...x, correct: j === i })))
                    }
                    aria-label={`Option ${i + 1} is correct`}
                  />
                  {String.fromCharCode(65 + i)}
                </label>
                <Input
                  value={o.text}
                  onChange={(e) => setOpt(i, { text: e.target.value })}
                  aria-label={`Option ${i + 1} text`}
                  readOnly={fixed}
                  required
                />
                <Input
                  value={o.rationale}
                  onChange={(e) => setOpt(i, { rationale: e.target.value })}
                  placeholder="Why this is right or wrong"
                  aria-label={`Option ${i + 1} rationale`}
                />
                {resizable ? (
                  <Button
                    variant="ghost"
                    onPress={() => setOptions((os) => os.filter((_, j) => j !== i))}
                    isDisabled={!canRemove}
                    aria-label={`Remove option ${String.fromCharCode(65 + i)}`}
                  >
                    Remove
                  </Button>
                ) : (
                  <span className="hidden md:block" />
                )}
              </div>
            ))}
            {canAdd && (
              <div>
                <Button variant="secondary" onPress={() => setOptions((os) => [...os, blank()])}>
                  Add an option
                </Button>
              </div>
            )}
          </fieldset>
          <Field label="Explanation">
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Difficulty (1-5)">
              <Input
                type="number"
                min="1"
                max="5"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              />
            </Field>
            <Field label="Tags" hint="Comma-separated, lowercase-kebab-case.">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} />
            </Field>
          </div>
          {isNew && (
            <>
              <Field label="References (optional)" hint="https links that back up the answer, one per line.">
                <Textarea value={refs} onChange={(e) => setRefs(e.target.value)} rows={2} />
              </Field>
              <fieldset>
                <legend className="mb-1 text-sm font-medium">When saved</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      className={checkClass}
                      checked={status === "approved"}
                      onChange={() => setStatus("approved")}
                    />
                    Add it to practice now
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      className={checkClass}
                      checked={status === "draft"}
                      onChange={() => setStatus("draft")}
                    />
                    Keep it in Drafts to review later
                  </label>
                </div>
              </fieldset>
            </>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" isDisabled={pending}>
              {isNew ? "Save question" : "Save changes"}
            </Button>
            {message?.ok && (
              <span role="status" className="text-sm text-ok">
                {message.ok}
              </span>
            )}
            {message?.error && (
              <span role="alert" className="text-sm text-bad">
                {message.error}
              </span>
            )}
          </div>
        </div>
      </Card>
    </form>
  );
}
