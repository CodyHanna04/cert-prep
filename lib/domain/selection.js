import { shuffle } from "./rng.js";

/**
 * @typedef {{ id: string, domainId: string, objectiveId: string }} PoolQuestion
 * @typedef {{ attempts: number, lastResult: boolean | null, lastSeenAt: number | null }} QuestionHistory
 * @typedef {{ type: "exam" } | { type: "domain" | "objective", id: string } | { type: "flagged" | "missed" | "unseen" }} Scope
 */

const noHistory = { attempts: 0, lastResult: null, lastSeenAt: null };

/**
 * Picks questions for a practice session from the approved pool.
 * @param {{
 *   pool: PoolQuestion[],
 *   scope: Scope,
 *   count: number,
 *   order?: "random" | "unseen-first" | "missed-first",
 *   history?: Map<string, QuestionHistory>,
 *   flaggedIds?: Set<string>,
 *   rng?: () => number,
 * }} input
 * @returns {string[]} question ids
 */
export function selectQuestions({
  pool,
  scope,
  count,
  order = "random",
  history = new Map(),
  flaggedIds = new Set(),
  rng = Math.random,
}) {
  const h = (q) => history.get(q.id) ?? noHistory;
  let candidates = pool.filter((q) => {
    switch (scope.type) {
      case "exam":
        return true;
      case "domain":
        return q.domainId === scope.id;
      case "objective":
        return q.objectiveId === scope.id;
      case "flagged":
        return flaggedIds.has(q.id);
      case "missed":
        return h(q).lastResult === false;
      case "unseen":
        return h(q).attempts === 0;
      default:
        return false;
    }
  });

  candidates = shuffle(candidates, rng);
  if (order === "unseen-first") {
    candidates.sort((a, b) => Number(h(a).attempts > 0) - Number(h(b).attempts > 0));
  } else if (order === "missed-first") {
    candidates.sort((a, b) => rank(h(a)) - rank(h(b)));
  }
  return candidates.slice(0, count).map((q) => q.id);
}

// missed (0) before unseen (1) before answered-correctly (2); sort is stable so the shuffle breaks ties.
function rank(h) {
  if (h.lastResult === false) return 0;
  if (h.attempts === 0) return 1;
  return 2;
}
