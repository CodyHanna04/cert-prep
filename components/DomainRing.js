const TONE = {
  accent: "var(--c-accent)",
  ok: "var(--c-ok)",
  warn: "var(--c-warn)",
  info: "var(--c-info)",
  idle: "var(--c-idle)",
};

/**
 * A donut with one arc per exam domain, sized by its blueprint weight. On the catalog every arc is the accent
 * colour in a different strength; on the dashboard each arc takes the tone of that domain's status.
 * @param {{ segments: { weight: number, tone?: keyof typeof TONE, opacity?: number, title?: string }[], size?: number, thickness?: number, label: string, children?: import("react").ReactNode }} props
 */
export function DomainRing({ segments, size = 112, thickness = 11, label, children }) {
  const r = 50 - thickness / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((n, s) => n + s.weight, 0) || 1;
  const gap = segments.length > 1 ? 1.8 : 0;
  const arcs = segments.map((s, i) => ({
    ...s,
    len: (s.weight / total) * c,
    start: segments.slice(0, i).reduce((n, p) => n + (p.weight / total) * c, 0),
  }));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role={label ? "img" : undefined}
        aria-label={label || undefined}
        aria-hidden={label ? undefined : true}
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--c-idle-soft)"
          strokeWidth={thickness}
        />
        {arcs.map((s, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={TONE[s.tone ?? "accent"]}
            strokeOpacity={s.opacity ?? 1}
            strokeWidth={thickness}
            strokeDasharray={`${Math.max(s.len - gap, 0.5)} ${c}`}
            strokeDashoffset={-s.start}
            transform="rotate(-90 50 50)"
          >
            {s.title && <title>{s.title}</title>}
          </circle>
        ))}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}
