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

export const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const fmtDateTime = (d) =>
  new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Whole days from today until an ISO date, or null. */
export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const ms = new Date(`${isoDate}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}
