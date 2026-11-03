"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Keyboard shortcuts for the practice and mock runners. `handlers` maps a key ("1".."9", "Enter", "f", "?")
 * to a function; keys are ignored while typing in a field or with Ctrl/Alt/Meta held, so browser
 * shortcuts keep working.
 */
export function useShortcuts(handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // Enter on a focused button already presses it; don't press something else as well.
      if (e.key === "Enter" && t instanceof HTMLElement && t.closest("button, a")) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const fn = ref.current[key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Maps 1-9 to "pick option n". */
export function optionKeys(count, pick) {
  const out = {};
  for (let i = 0; i < Math.min(count, 9); i += 1) out[String(i + 1)] = () => pick(i);
  return out;
}

/**
 * Time spent on the current question while the tab is visible. `restart()` when a new question is shown;
 * `elapsed()` reads the total so far in milliseconds.
 */
export function useVisibleTime(initialMs = 0) {
  const total = useRef(initialMs);
  const since = useRef(null);
  useEffect(() => {
    since.current = document.hidden ? null : Date.now();
    const onVis = () => {
      if (document.hidden && since.current != null) {
        total.current += Date.now() - since.current;
        since.current = null;
      } else if (!document.hidden && since.current == null) since.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return {
    restart(base = 0) {
      total.current = base;
      since.current = document.hidden ? null : Date.now();
    },
    elapsed() {
      return Math.round(total.current + (since.current == null ? 0 : Date.now() - since.current));
    },
  };
}

/** The `?` cheat-sheet. */
export function ShortcutHelp({ keys }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "?") setOpen((o) => !o);
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="mt-4 text-xs text-muted">
      <button type="button" className="underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Keyboard shortcuts (?)
      </button>
      {open && (
        <dl className="mt-2 grid max-w-sm grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-theme border border-line bg-surface p-3">
          {keys.map(([k, what]) => (
            <div key={k} className="contents">
              <dt><kbd className="rounded border border-line px-1 font-mono">{k}</kbd></dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
