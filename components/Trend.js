/**
 * Small trend charts drawn on the server: a sparkline for a value per period, and a bar strip for counts.
 * Each period is a full-height column that shows a tooltip on hover or keyboard focus (no client JS), so the hit
 * target is bigger than the mark. One series per chart, in the accent color; the text around it names the series.
 */

const tipPlace = (i, n) =>
  i < n / 3 ? "left-0" : i >= (2 * n) / 3 ? "right-0" : "left-1/2 -translate-x-1/2";

function Tip({ i, n, children }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute bottom-full z-10 mb-1.5 hidden whitespace-nowrap rounded-theme border border-line bg-raised px-2 py-1 text-xs text-text shadow-card group-hover:block group-focus-visible:block ${tipPlace(i, n)}`}
    >
      {children}
    </span>
  );
}

/**
 * @param {{
 *   points: { key: string, value: number | null, tip: string }[],
 *   min?: number, max?: number, target?: number | null,
 *   label: string, height?: number, className?: string,
 * }} props
 * A null value is a period with no data: no dot, and the line breaks there rather than implying data.
 */
export function Sparkline({ points, min = 0, max = 100, target = null, label, height = 40, className = "" }) {
  const n = points.length;
  if (n === 0) return null;
  const span = max - min || 1;
  const x = (i) => ((i + 0.5) / n) * 100;
  const y = (v) => 8 + (1 - (Math.min(max, Math.max(min, v)) - min) / span) * 84; // 8% padding top and bottom

  // Line segments between neighbouring periods that both have data.
  const segments = [];
  let run = [];
  points.forEach((p, i) => {
    if (p.value == null) {
      if (run.length > 1) segments.push(run);
      run = [];
    } else run.push(`${x(i)},${y(p.value)}`);
  });
  if (run.length > 1) segments.push(run);

  return (
    <div role="group" aria-label={label} className={`relative ${className}`} style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        {target != null && (
          <line
            x1="0"
            x2="100"
            y1={y(target)}
            y2={y(target)}
            stroke="var(--c-ok)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            opacity="0.8"
          />
        )}
        {segments.map((s, i) => (
          <polyline
            key={i}
            points={s.join(" ")}
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {points.map((p, i) =>
        p.value == null ? null : (
          <span
            key={p.key}
            aria-hidden
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface"
            style={{ left: `${x(i)}%`, top: `${y(p.value)}%` }}
          />
        ),
      )}
      <div className="absolute inset-0 flex">
        {points.map((p, i) => (
          <span
            key={p.key}
            tabIndex={0}
            aria-label={p.tip}
            className="group relative flex-1 rounded-sm outline-none hover:bg-idle-soft/60 focus-visible:bg-idle-soft/60 focus-visible:outline-2 focus-visible:outline-focus"
          >
            <Tip i={i} n={n}>{p.tip}</Tip>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Vertical bars, one per period, with an optional label under each.
 * @param {{
 *   bars: { key: string, value: number, tip: string, label?: string, strong?: boolean }[],
 *   label: string, height?: string, className?: string,
 * }} props
 */
export function BarStrip({ bars, label, height = "h-28", className = "" }) {
  const n = bars.length;
  const top = Math.max(1, ...bars.map((b) => b.value));
  const labelled = bars.some((b) => b.label);
  return (
    <div role="group" aria-label={label} className={className}>
      <div className={`flex items-end gap-1.5 ${height}`}>
        {bars.map((b, i) => (
          <span
            key={b.key}
            tabIndex={0}
            aria-label={b.tip}
            className="group relative flex h-full flex-1 items-end rounded-sm outline-none hover:bg-idle-soft/60 focus-visible:bg-idle-soft/60 focus-visible:outline-2 focus-visible:outline-focus"
          >
            <span
              aria-hidden
              className="block w-full rounded-t-[4px] bg-accent"
              style={{ height: `${Math.max(3, (b.value / top) * 100)}%`, opacity: b.value ? 1 : 0.18 }}
            />
            <Tip i={i} n={n}>{b.tip}</Tip>
          </span>
        ))}
      </div>
      {labelled && (
        <div aria-hidden className="mt-1 flex gap-1.5 text-[0.65rem] leading-tight text-muted">
          {bars.map((b) => (
            <span key={b.key} className={`flex-1 text-center tabular-nums ${b.strong ? "font-semibold text-text" : ""}`}>
              {b.label ?? ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
