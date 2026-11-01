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
