/**
 * Independent verification pass (docs/07 section 2, step 3). A second model, or a person, answers the questions
 * without seeing the key; any disagreement with the drafted key is flagged for a closer look in review.
 * Pure: no I/O. Option ids are letters by position (a, b, c ...), the same ids the importer assigns.
 */

const LETTERS = "abcdefgh";

/**
 * The questions with everything that gives the answer away removed: no correct flags, rationales, explanation,
 * refs or tags. For a multiple-response question the stem itself says how many to choose.
 * @param {{ questions: { id: string, type: string, stem: string, options: { text: string }[] }[] }} file
 */
export function blindCopy(file) {
  return {
    instructions:
      "Answer each question using only your own knowledge. Return a JSON object mapping each question id to an array of the option letters you choose, e.g. { \"q-001\": [\"b\"], \"q-002\": [\"a\", \"d\"] }. Do not explain.",
    questions: file.questions.map((q) => ({
      id: q.id,
      type: q.type,
      stem: q.stem,
      options: q.options.map((o, i) => ({ id: LETTERS[i], text: o.text })),
    })),
  };
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * @param {{ questions: { id: string, options: { correct: boolean }[] }[] }} file the drafted batch (with its key)
 * @param {Record<string, string[]>} answers question id -> option letters chosen by the verifier
 * @returns {{ id: string, result: "match" | "mismatch" | "missing", key: string[], answered: string[] }[]}
 */
export function compareAnswers(file, answers) {
  return file.questions.map((q) => {
    const key = q.options.flatMap((o, i) => (o.correct ? [LETTERS[i]] : []));
    const raw = answers[q.id];
    if (!Array.isArray(raw) || raw.length === 0) return { id: q.id, result: "missing", key, answered: [] };
    const answered = raw.map((x) => String(x).toLowerCase());
    return { id: q.id, result: sameSet(key, answered) ? "match" : "mismatch", key, answered };
  });
}

/** Sets `needsAttention: true` on every question the verifier disagreed with (or skipped). Returns a new file. */
export function flagDisagreements(file, comparison) {
  const flagged = new Set(comparison.filter((c) => c.result !== "match").map((c) => c.id));
  return { ...file, questions: file.questions.map((q) => (flagged.has(q.id) ? { ...q, needsAttention: true } : q)) };
}
