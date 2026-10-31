/**
 * Progress model (docs/10-flows-and-structure.md section 3). Pure functions, no I/O.
 *
 * Pool = approved questions only (callers pass only those). Accuracy uses each question's latest
 * `recentAttempts` attempts. Thresholds are starting values, not research-backed.
 */

export const DEFAULT_THRESHOLDS = Object.freeze({
  recentAttempts: 3,
  coverageForStatus: 0.8,
  minSampleForStatus: 5,
  minDomainSampleForReadiness: 10,
});

export const STATUS = Object.freeze({
  NO_QUESTIONS: "no-questions",
  NOT_STARTED: "not-started",
  IN_PROGRESS: "in-progress",
  NEEDS_WORK: "needs-work",
  ON_TARGET: "on-target",
});

/**
 * @typedef {{ id: string, objectiveId: string, domainId: string }} PoolQuestion
 * @typedef {{ questionId: string, isCorrect: boolean, answeredAt: string | number | Date }} Attempt
 */

function latestAttemptsByQuestion(attempts, recentAttempts) {
  const byQ = new Map();
  for (const a of attempts) {
    if (!byQ.has(a.questionId)) byQ.set(a.questionId, []);
    byQ.get(a.questionId).push(a);
  }
  for (const [q, list] of byQ) {
    list.sort((x, y) => new Date(y.answeredAt) - new Date(x.answeredAt));
    byQ.set(q, list.slice(0, recentAttempts));
  }
  return byQ;
}

/** Stats for a set of pool questions. accuracy is a percentage, or null when nothing was attempted. */
function statsFor(questions, latest) {
  let sample = 0;
  let attempts = 0;
  let correct = 0;
  for (const q of questions) {
    const list = latest.get(q.id);
    if (!list || list.length === 0) continue;
    sample += 1;
    attempts += list.length;
    correct += list.filter((a) => a.isCorrect).length;
  }
  const poolSize = questions.length;
  return {
    poolSize,
    sample,
    coverage: poolSize === 0 ? 0 : sample / poolSize,
    accuracy: attempts === 0 ? null : (correct / attempts) * 100,
  };
}

export function statusFor({ poolSize, sample, coverage, accuracy }, targetPct, th) {
  if (poolSize === 0) return STATUS.NO_QUESTIONS;
  if (sample === 0) return STATUS.NOT_STARTED;
  if (coverage < th.coverageForStatus || sample < th.minSampleForStatus) return STATUS.IN_PROGRESS;
  return accuracy >= targetPct ? STATUS.ON_TARGET : STATUS.NEEDS_WORK;
}

/**
 * @param {{
 *   targetPct: number,
 *   domains: { id: string, weightPct: number }[],
 *   objectives: { id: string, domainId: string }[],
 *   pool: PoolQuestion[],
 *   attempts: Attempt[],
 *   thresholds?: Partial<typeof DEFAULT_THRESHOLDS>,
 * }} input
 */
export function computeProgress({ targetPct, domains, objectives, pool, attempts, thresholds = {} }) {
  const th = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const poolIds = new Set(pool.map((q) => q.id));
  const latest = latestAttemptsByQuestion(
    attempts.filter((a) => poolIds.has(a.questionId)),
    th.recentAttempts,
  );

  const objectiveRows = objectives.map((o) => {
    const s = statsFor(
      pool.filter((q) => q.objectiveId === o.id),
      latest,
    );
    return { objectiveId: o.id, domainId: o.domainId, ...s, status: statusFor(s, targetPct, th) };
  });

  const domainRows = domains.map((d) => {
    const s = statsFor(
      pool.filter((q) => q.domainId === d.id),
      latest,
    );
    return { domainId: d.id, weightPct: d.weightPct, ...s, status: statusFor(s, targetPct, th) };
  });

  // What's left: every objective that is not On target, biggest (domain weight x gap) first.
  const weightOf = new Map(domains.map((d) => [d.id, d.weightPct]));
  const whatsLeft = objectiveRows
    .filter((o) => o.status !== STATUS.ON_TARGET)
    .map((o) => {
      const gapPct = Math.max(0, targetPct - (o.accuracy ?? 0));
      return { ...o, gapPct, priority: (weightOf.get(o.domainId) ?? 0) * gapPct };
    })
    .sort((a, b) => b.priority - a.priority);

  return {
    objectives: objectiveRows,
    domains: domainRows,
    whatsLeft,
    readiness: readiness(domainRows, targetPct, th),
  };
}

/**
 * Readiness = sum(domain weight x domain accuracy) / sum(weights), only when every domain has
 * enough attempted questions. Otherwise reports what is missing.
 */
function readiness(domainRows, targetPct, th) {
  const missing = domainRows
    .filter((d) => d.sample < th.minDomainSampleForReadiness)
    .map((d) => ({
      domainId: d.domainId,
      sample: d.sample,
      needed: th.minDomainSampleForReadiness,
    }));
  if (domainRows.length === 0 || missing.length > 0) {
    return { available: false, scorePct: null, targetPct, meetsTarget: null, missing };
  }
  const totalWeight = domainRows.reduce((s, d) => s + d.weightPct, 0);
  const score = domainRows.reduce((s, d) => s + d.weightPct * d.accuracy, 0) / totalWeight;
  return { available: true, scorePct: score, targetPct, meetsTarget: score >= targetPct, missing: [] };
}
