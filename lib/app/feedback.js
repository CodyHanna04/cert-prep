/** What the learner sees after answering. Built on the server; the client never gets answer keys earlier. */
export function buildFeedback(question, selectedOptionIds, isCorrect) {
  return {
    selected: selectedOptionIds,
    isCorrect,
    correct: question.options.filter((o) => o.isCorrect).map((o) => o.id),
    rationales: Object.fromEntries(question.options.map((o) => [o.id, o.rationale ?? null])),
    explanation: question.explanation ?? null,
  };
}

/** Question as sent to the client while it is still unanswered: no correctness, no rationales. */
export function publicQuestion(question) {
  return {
    id: question.id,
    type: question.type,
    stem: question.stem,
    options: question.options.map((o) => ({ id: o.id, text: o.text })),
  };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
