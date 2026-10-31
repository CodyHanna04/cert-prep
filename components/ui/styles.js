// Shared class recipes. Plain module (no "use client") so server and client components can both use it.
const BTN =
  "inline-flex items-center justify-center gap-2 rounded-theme px-4 py-2 text-sm font-medium transition-colors " +
  "disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
const VARIANTS = {
  primary: "bg-accent text-on-accent hover:opacity-90",
  secondary: "border border-line bg-surface text-text hover:bg-raised",
  danger: "border border-bad text-bad bg-surface hover:bg-bad-soft",
  ghost: "text-muted hover:text-text hover:bg-idle-soft",
};
export const buttonClass = (variant = "secondary", extra = "") => `${BTN} ${VARIANTS[variant]} ${extra}`;
