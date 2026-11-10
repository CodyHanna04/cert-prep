/**
 * Trailing moving average: each point is the mean of itself and up to `window - 1` points before it, so the
 * line is defined from the first session on and never looks ahead.
 * @param {number[]} values
 * @param {number} window
 */
export function movingAverage(values, window = 3) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/**
 * Vertical range for a score chart: always tops out at 100, and starts a little below the lowest score (on a multiple of 20, so
 * gridlines stay tidy) so a run of 70-90% results is not squashed into the top of a 0-100 axis. Never narrower than 40 points.
 * @param {number[]} pcts
 * @returns {{ lo: number, hi: number }}
 */
export function scoreAxis(pcts) {
  if (pcts.length === 0) return { lo: 0, hi: 100 };
  const lo = Math.max(0, Math.floor((Math.min(...pcts) - 10) / 20) * 20);
  return { lo: Math.min(lo, 60), hi: 100 };
}

/**
 * The Monday of each of the last `n` weeks, oldest first, as YYYY-MM-DD. `todayIso` is today's date in the app's
 * time zone; weeks start on Monday, the same as Postgres date_trunc('week').
 * @param {string} todayIso
 * @param {number} n
 */
export function weekStarts(todayIso, n) {
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return Array.from({ length: n }, (_, i) => {
    const w = new Date(d);
    w.setUTCDate(d.getUTCDate() - (n - 1 - i) * 7);
    return w.toISOString().slice(0, 10);
  });
}

/**
 * Accuracy per week for each group: one entry per week in `weeks` (pct is null for a week with no answers).
 * @param {{ week: string, isCorrect: boolean }[]} rows answers, each with the Monday of its week
 * @param {string[]} weeks from weekStarts
 * @param {(row: any) => string} keyOf the group a row belongs to
 * @returns {Map<string, { week: string, n: number, correct: number, pct: number | null }[]>}
 */
export function weeklyAccuracy(rows, weeks, keyOf) {
  const out = new Map();
  for (const r of rows) {
    const key = keyOf(r);
    if (!out.has(key)) out.set(key, new Map(weeks.map((w) => [w, { n: 0, correct: 0 }])));
    const cell = out.get(key).get(r.week);
    if (!cell) continue;
    cell.n += 1;
    if (r.isCorrect) cell.correct += 1;
  }
  return new Map(
    [...out].map(([key, byWeek]) => [
      key,
      weeks.map((week) => {
        const { n, correct } = byWeek.get(week);
        return { week, n, correct, pct: n ? (correct / n) * 100 : null };
      }),
    ]),
  );
}

/** Median of the positive, finite values, or null. */
export function median(values) {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Bucket edges (seconds) for the time-per-question distribution. The last bucket is open-ended. */
export const TIME_BUCKETS_SEC = [0, 30, 60, 90, 120, 180];

/**
 * How many answers fell into each time bucket: under 30s, 30s-1m, 1-1.5m, 1.5-2m, 2-3m, 3m or more.
 * @param {(number | null)[]} times milliseconds per answer (null or 0 = not measured, skipped)
 * @returns {{ fromSec: number, toSec: number | null, n: number }[]}
 */
export function timeDistribution(times) {
  const buckets = TIME_BUCKETS_SEC.map((fromSec, i) => ({
    fromSec,
    toSec: TIME_BUCKETS_SEC[i + 1] ?? null,
    n: 0,
  }));
  for (const t of times) {
    if (!Number.isFinite(t) || t <= 0) continue;
    const s = t / 1000;
    const b = buckets.findLast((x) => s >= x.fromSec);
    b.n += 1;
  }
  return buckets;
}
