/**
 * Time stats for one session. `times` are milliseconds per answered question (null = not measured).
 * A question counts as slow when it took at least 1.5x the session's median and at least 30 seconds,
 * so a quick session doesn't flag a 12-second question as slow.
 */
export const SLOW_FACTOR = 1.5;
export const SLOW_MIN_MS = 30_000;

export function timeStats(times) {
  const ms = times.filter((t) => Number.isFinite(t) && t > 0).sort((a, b) => a - b);
  if (ms.length === 0) return null;
  const mid = Math.floor(ms.length / 2);
  const medianMs = ms.length % 2 ? ms[mid] : (ms[mid - 1] + ms[mid]) / 2;
  const totalMs = ms.reduce((a, b) => a + b, 0);
  return {
    count: ms.length,
    totalMs,
    avgMs: totalMs / ms.length,
    medianMs,
    maxMs: ms[ms.length - 1],
    slowThresholdMs: Math.max(SLOW_MIN_MS, medianMs * SLOW_FACTOR),
  };
}

export const isSlow = (t, stats) => stats != null && Number.isFinite(t) && t >= stats.slowThresholdMs;

/** 75000 -> "1:15", 9000 -> "0:09". */
export function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
