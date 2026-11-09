/** Lookup helpers for rendering: ids -> names, built once per request from an exam. */
export function indexExam(exam) {
  const domainById = new Map();
  const objectiveById = new Map();
  for (const d of exam.domains) {
    domainById.set(d.id, d);
    for (const o of d.objectives) objectiveById.set(o.id, { ...o, domain: d });
  }
  return { domainById, objectiveById };
}

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const fmtDateTime = (d) =>
  new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** The time zone days are counted in: APP_TIMEZONE if set, else the server's own. */
export const appTimeZone = () =>
  process.env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Whole days from today until an ISO date, or null. */
export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const ms = new Date(`${isoDate}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

/** "Passed on Nov 9, 2026 · 812" or "Finished", or null when the course has no outcome. */
export function outcomeLabel(exam) {
  if (!exam?.outcome) return null;
  const when = exam.outcomeDate
    ? new Date(`${exam.outcomeDate}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const head = exam.outcome === "passed" ? "Passed" : "Finished";
  return [head, when && `on ${when}`, exam.outcomeScore && `· ${exam.outcomeScore}`]
    .filter(Boolean)
    .join(" ");
}

/** Where an in-progress session picks up again. */
export const resumeHref = (s) => (s.mode === "mock" ? `/mock/${s.id}` : `/practice/${s.id}`);
