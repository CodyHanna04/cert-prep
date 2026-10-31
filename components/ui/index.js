import Link from "next/link";
import { Button } from "./Button.js";
import { buttonClass } from "./styles.js";

export { Button, buttonClass };

/**
 * The app's own UI layer. Screens import from here, never from react-aria-components directly,
 * so the behavior library can be swapped without touching screens (docs/12 section 4).
 */

export function LinkButton({ variant = "secondary", className = "", ...props }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Card({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-theme border border-line bg-surface p-4 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="font-display text-lg">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-theme border border-dashed border-line p-8 text-center">
      <p className="font-display text-lg">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-prose text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const STATUS_META = {
  "no-questions": { label: "No questions", tone: "idle" },
  "not-started": { label: "Not started", tone: "idle" },
  "in-progress": { label: "In progress", tone: "info" },
  "needs-work": { label: "Needs work", tone: "warn" },
  "on-target": { label: "On target", tone: "ok" },
};

const TONES = {
  idle: "bg-idle-soft text-idle",
  info: "bg-info-soft text-info",
  warn: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
};

export function Badge({ tone = "idle", children }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META["not-started"];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function Meter({ value, max = 100, label, tone = "accent" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = { accent: "bg-accent", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-idle-soft">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const CONTROL = "w-full rounded-theme border border-line bg-surface px-3 py-2 text-sm text-text";
export const Input = (props) => <input className={CONTROL} {...props} />;
export const Select = (props) => <select className={CONTROL} {...props} />;
export const Textarea = (props) => <textarea className={CONTROL} {...props} />;

export const pct = (n, digits = 0) => (n == null ? "—" : `${n.toFixed(digits)}%`);
