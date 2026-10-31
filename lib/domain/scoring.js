/**
 * @typedef {{ id: string, text: string, isCorrect: boolean, rationale?: string }} Option
 * @typedef {{ type: "single" | "multi" | "tf", options: Option[] }} ScorableQuestion
 */

/**
 * Scores one answer. Single / true-false: correct iff the one correct option is the only one picked.
 * Multi: all-or-nothing by default; with `partialCredit`, score = (correct picks - wrong picks) / correct count, floored at 0.
 * Selecting nothing is always incorrect (unanswered = incorrect).
 * @param {ScorableQuestion} question
 * @param {string[]} selectedIds
 * @param {{ partialCredit?: boolean }} [opts]
 * @returns {{ isCorrect: boolean, score: number }}
 */
export function scoreAnswer(question, selectedIds, { partialCredit = false } = {}) {
  const selected = new Set(selectedIds);
  if (selected.size === 0) return { isCorrect: false, score: 0 };

  const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
  const correctPicks = correctIds.filter((id) => selected.has(id)).length;
  const wrongPicks = selected.size - correctPicks;
  const isCorrect = wrongPicks === 0 && correctPicks === correctIds.length;

  if (isCorrect) return { isCorrect, score: 1 };
  if (partialCredit && question.type === "multi") {
    const score = Math.max(0, (correctPicks - wrongPicks) / correctIds.length);
    return { isCorrect: false, score };
  }
  return { isCorrect: false, score: 0 };
}

/**
 * Summarises a finished session or mock.
 * @param {{ isCorrect: boolean }[]} answers one entry per question in the session (unanswered ones included as incorrect)
 * @param {{ passMarkPct?: number | null, readinessTargetPct?: number | null }} thresholds
 */
export function summarizeScore(answers, { passMarkPct = null, readinessTargetPct = null } = {}) {
  const total = answers.length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const pct = total === 0 ? 0 : (correct / total) * 100;
  return {
    total,
    correct,
    pct,
    // Vendor scaled scores can't be derived from raw %, so both comparisons are labeled proxies in the UI.
    meetsPassMarkProxy: passMarkPct == null ? null : pct >= passMarkPct,
    meetsReadinessTarget: readinessTargetPct == null ? null : pct >= readinessTargetPct,
  };
}
