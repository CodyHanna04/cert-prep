import Link from "next/link";
import { Button } from "./Button.js";
import { buttonClass } from "./styles.js";
import { outcomeLabel } from "../../lib/app/view.js";

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
    <section
      className={`rounded-theme border border-line bg-surface p-5 shadow-card min-w-0 ${className}`}
    >
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          {title && <h2 className="font-display text-lg tracking-tight">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="title-rule font-display text-3xl tracking-tight">{title}</h1>
        {subtitle && <p className="mt-3 text-sm text-muted">{subtitle}</p>}
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
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META["not-started"];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/** Passed or finished, with the date and score when known. Renders nothing for a course still in progress. */
export function OutcomeBadge({ exam }) {
  const label = outcomeLabel(exam);
  if (!label) return null;
  return <Badge tone={exam.outcome === "passed" ? "ok" : "info"}>{label}</Badge>;
}

export function Meter({ value, max = 100, label, tone = "accent" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = { accent: "bg-accent", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-idle-soft"
    >
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

// A className passed in adds to these (layout such as grid spans); it never replaces the border or focus ring.
const CONTROL =
  "w-full rounded-theme border border-line bg-surface px-3 py-2 text-sm text-text placeholder:text-muted hover:border-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";
export const Input = ({ className = "", ...props }) => <input className={`${CONTROL} ${className}`} {...props} />;
export const Select = ({ className = "", ...props }) => <select className={`${CONTROL} ${className}`} {...props} />;
export const Textarea = ({ className = "", ...props }) => <textarea className={`${CONTROL} ${className}`} {...props} />;

/** Native checkboxes and radios in the theme's accent color, with a visible focus ring. */
export const checkClass =
  "size-4 shrink-0 cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Native file picker with its button styled like a secondary button. */
export const fileInputClass =
  "block w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-theme file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text hover:file:border-muted";

/** A label that wraps a radio or checkbox and highlights when its input is checked (option cards). */
export const optionCardClass =
  "flex cursor-pointer items-start gap-3 rounded-theme border border-line p-3 text-sm transition-colors hover:border-muted has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-focus";

/**
 * A checkbox styled as a toggle chip, for filter forms. It is a real <input type="checkbox">, so it submits with
 * plain GET forms and works with the keyboard; the box, checkmark and chip colors follow the checked state.
 */
export function CheckChip({ name, value = "1", defaultChecked, children }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-theme border border-line bg-surface px-3 py-2 text-sm text-muted transition-colors hover:border-muted hover:text-text has-checked:border-accent has-checked:bg-accent-soft has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-focus">
      <span className="relative inline-flex size-4 shrink-0">
        <input
          type="checkbox"
          name={name}
          value={value}
          defaultChecked={defaultChecked}
          className="peer size-4 appearance-none rounded border border-muted bg-surface transition-colors checked:border-accent checked:bg-accent focus-visible:outline-none"
        />
        <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute inset-0 m-auto size-3 text-on-accent opacity-0 transition-opacity peer-checked:opacity-100">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {children}
    </label>
  );
}

export const pct = (n, digits = 0) => (n == null ? "—" : `${n.toFixed(digits)}%`);
