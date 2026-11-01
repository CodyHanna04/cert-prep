import Link from "next/link";
import { movingAverage, scoreAxis } from "@/lib/domain/trend.js";
import { fmtDate } from "@/lib/app/view.js";

const W = 720;
const H = 300;
const M = { l: 44, r: 20, t: 16, b: 40 };
const AVG_WINDOW = 3;

/**
 * Score of every completed session as a line chart, oldest to newest.
 * Sessions are spaced evenly (a burst of sessions on one day would otherwise pile up), with dates on the axis.
 * Marker size follows question count, so a 5-question drill does not read like a 65-question mock. The thick
 * line is a 3-session moving average; the dashed line is the readiness target.
 * @param {{ points: { id: string, pct: number, mode: string, total: number, correct: number, startedAt: string | Date, href: string }[], targetPct: number }} props
 */
export function ScoreChart({ points, targetPct }) {
  if (points.length === 0) return null;
  const { lo, hi } = scoreAxis([...points.map((p) => p.pct), targetPct]);
  const x = (i) =>
    points.length === 1 ? (M.l + W - M.r) / 2 : M.l + (i * (W - M.l - M.r)) / (points.length - 1);
  const y = (v) => M.t + ((hi - v) / (hi - lo)) * (H - M.t - M.b);
  const avg = movingAverage(
    points.map((p) => p.pct),
    AVG_WINDOW,
  );
  const ticks = [];
  const step = hi - lo <= 40 ? 10 : 20;
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== hi) ticks.push(hi);
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const radius = (p) => 3.5 + Math.min(5, Math.sqrt(p.total) / 1.6);
  const desc = points
    .map((p) => `${fmtDate(p.startedAt)} ${p.mode} ${Math.round(p.pct)} percent`)
    .join("; ");

  return (
    <figure>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="min-w-[34rem] w-full"
          role="img"
          aria-label={`Session scores over time. ${desc}. Target ${targetPct} percent.`}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={M.l}
                x2={W - M.r}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--c-line)"
                strokeWidth="1"
                opacity={v === lo ? 1 : 0.6}
              />
              <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--c-muted)">
                {v}%
              </text>
            </g>
          ))}

          <line
            x1={M.l}
            x2={W - M.r}
            y1={y(targetPct)}
            y2={y(targetPct)}
            stroke="var(--c-ok)"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
          <text x={W - M.r} y={y(targetPct) - 6} textAnchor="end" fontSize="12" fill="var(--c-ok)">
            Target {targetPct}%
          </text>

          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="var(--c-muted)"
              strokeOpacity="0.45"
              strokeWidth="1"
              points={points.map((p, i) => `${x(i)},${y(p.pct)}`).join(" ")}
            />
          )}
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="var(--c-accent)"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={avg.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
          )}

          {points.map((p, i) => (
            <Link key={p.id} href={p.href}>
              <g className="cursor-pointer">
                <title>{`${fmtDate(p.startedAt)} · ${p.mode} · ${p.correct}/${p.total} (${Math.round(p.pct)}%)`}</title>
                {p.mode === "mock" ? (
                  <rect
                    x={x(i) - radius(p)}
                    y={y(p.pct) - radius(p)}
                    width={radius(p) * 2}
                    height={radius(p) * 2}
                    transform={`rotate(45 ${x(i)} ${y(p.pct)})`}
                    fill="var(--c-info)"
                    stroke="var(--c-surface)"
                    strokeWidth="2"
                  />
                ) : (
                  <circle
                    cx={x(i)}
                    cy={y(p.pct)}
                    r={radius(p)}
                    fill="var(--c-accent)"
                    stroke="var(--c-surface)"
                    strokeWidth="2"
                  />
                )}
              </g>
            </Link>
          ))}

          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text
                key={p.id}
                x={x(i)}
                y={H - 14}
                textAnchor="middle"
                fontSize="12"
                fill="var(--c-muted)"
              >
                {fmtDate(p.startedAt)}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-full bg-accent" /> Practice
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rotate-45 bg-info" /> Mock exam
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-5 bg-accent" /> {AVG_WINDOW}-session
          average
        </span>
        <span>Bigger marker = more questions</span>
      </figcaption>
    </figure>
  );
}
