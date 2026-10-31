import { shuffle } from "./rng.js";

/**
 * Largest-remainder allocation of `total` questions across domains by weight; the result always sums to `total`.
 * @param {number} total
 * @param {{ id: string, weightPct: number }[]} domains
 * @returns {Map<string, number>}
 */
export function allocateByWeight(total, domains) {
  const weightSum = domains.reduce((s, d) => s + d.weightPct, 0);
  const rows = domains.map((d, index) => {
    const exact = (total * d.weightPct) / weightSum;
    return { id: d.id, index, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let left = total - rows.reduce((s, r) => s + r.floor, 0);
  // Biggest remainders get the leftover seats; ties go to the earlier domain.
  const byRemainder = [...rows].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const r of byRemainder) {
    if (left <= 0) break;
    r.floor += 1;
    left -= 1;
  }
  return new Map(rows.map((r) => [r.id, r.floor]));
}

/**
 * Stratified sample for a mock exam: allocate by domain weight, prefer least-recently-seen questions,
 * and redistribute the shortfall (with a warning) when a domain's pool is too small.
 * @param {{
 *   total: number,
 *   domains: { id: string, weightPct: number }[],
 *   pool: { id: string, domainId: string }[],
 *   lastSeenAt?: Map<string, number>,
 *   rng?: () => number,
 * }} input
 * @returns {{ questionIds: string[], allocation: Map<string, number>, warnings: string[] }}
 */
export function stratifiedSample({ total, domains, pool, lastSeenAt = new Map(), rng = Math.random }) {
  const warnings = [];
  const wanted = allocateByWeight(total, domains);

  // Per domain: shuffled, then least-recently-seen first (never seen = -Infinity).
  const queues = new Map(
    domains.map((d) => {
      const qs = shuffle(
        pool.filter((q) => q.domainId === d.id),
        rng,
      ).sort((a, b) => (lastSeenAt.get(a.id) ?? -Infinity) - (lastSeenAt.get(b.id) ?? -Infinity));
      return [d.id, qs];
    }),
  );

  const take = new Map();
  let shortfall = 0;
  for (const d of domains) {
    const want = wanted.get(d.id);
    const have = queues.get(d.id).length;
    take.set(d.id, Math.min(want, have));
    if (have < want) {
      shortfall += want - have;
      warnings.push(`Domain ${d.id} has ${have} approved questions but ${want} were wanted.`);
    }
  }

  // Hand the shortfall to domains with spare questions, heaviest weight first.
  const byWeight = [...domains].sort((a, b) => b.weightPct - a.weightPct);
  while (shortfall > 0) {
    let moved = false;
    for (const d of byWeight) {
      if (shortfall === 0) break;
      if (take.get(d.id) < queues.get(d.id).length) {
        take.set(d.id, take.get(d.id) + 1);
        shortfall -= 1;
        moved = true;
      }
    }
    if (!moved) {
      warnings.push(`Only ${total - shortfall} questions are available; ${shortfall} short of ${total}.`);
      break;
    }
  }

  const questionIds = [];
  for (const d of domains) {
    questionIds.push(...queues.get(d.id).slice(0, take.get(d.id)).map((q) => q.id));
  }
  return { questionIds: shuffle(questionIds, rng), allocation: take, warnings };
}
