import Link from "next/link";
import { hierarchy, treemap } from "d3-hierarchy";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExamProgress } from "@/lib/db/progress.js";
import { indexExam } from "@/lib/app/view.js";
import { EmptyState, LinkButton, PageHeader, STATUS_META, StatusBadge, pct } from "@/components/ui/index.js";

export const metadata = { title: "Map" };

const TILE = {
  idle: "bg-idle-soft text-idle border-line",
  info: "bg-info-soft text-info border-info",
  warn: "bg-warn-soft text-warn border-warn",
  ok: "bg-ok-soft text-ok border-ok",
};
const FILTERS = [
  ["all", "All"],
  ["not-done", "Not done"],
  ["needs-work", "Needs work"],
  ["no-questions", "No questions"],
];
const SHOWS = [
  ["accuracy", "Accuracy"],
  ["coverage", "Coverage"],
  ["count", "Questions"],
];

const W = 1000;
const H = 620;

export default async function MapPage({ searchParams }) {
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.filter) ? sp.filter : "all";
  const show = SHOWS.some(([k]) => k === sp.show) ? sp.show : "accuracy";
  const view = sp.view === "list" ? "list" : "map";

  const { user, exam: active } = await getAppContext();
  if (!active) return <EmptyState title="No exam yet" action={<LinkButton href="/settings" variant="primary">Add an exam</LinkButton>} />;
  const { exam, progress } = await withUser(user.id, (db) => getExamProgress(db, active.id));
  const { objectiveById } = indexExam(exam);
  const rows = new Map(progress.objectives.map((o) => [o.objectiveId, o]));
  const domainRows = new Map(progress.domains.map((d) => [d.domainId, d]));

  const matches = (o) =>
    filter === "all" ||
    (filter === "not-done" && o.status !== "on-target") ||
    o.status === filter;

  const qs = (patch) => {
    const p = new URLSearchParams({ filter, show, view, ...patch });
    return `/map?${p}`;
  };

  const metric = (o) =>
    show === "accuracy" ? pct(o.accuracy) : show === "coverage" ? pct(o.coverage * 100) : `${o.poolSize} q`;

  // Treemap: domain area proportional to exam weight, objectives share their domain equally.
  const root = hierarchy({
    children: exam.domains.map((d) => ({ id: d.id, children: d.objectives.map((o) => ({ id: o.id, value: 1 })) })),
  })
    .sum((n) => n.value ?? 0);
  // Re-weight so each domain's total equals its blueprint weight.
  for (const dn of root.children) {
    const d = exam.domains.find((x) => x.id === dn.data.id);
    const share = d.weightPct / dn.children.length;
    for (const c of dn.children) c.value = share;
    dn.value = d.weightPct;
  }
  root.value = exam.domains.reduce((s, d) => s + d.weightPct, 0);
  treemap().size([W, H]).paddingInner(3).paddingTop((n) => (n.depth === 1 ? 22 : 0)).round(false)(root);

  return (
    <>
      <PageHeader title="Blueprint map" subtitle={`${exam.code}. Area is proportional to exam weight. Colors show status.`} />

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Toolbar label="View" items={[["map", "Map"], ["list", "List"]]} current={view} href={(k) => qs({ view: k })} />
        <Toolbar label="Show" items={SHOWS} current={show} href={(k) => qs({ show: k })} />
        <Toolbar label="Filter" items={FILTERS} current={filter} href={(k) => qs({ filter: k })} />
      </div>

      <ul className="mb-4 flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className={`inline-block size-3 rounded-sm border ${TILE[m.tone]}`} /> {m.label}
          </li>
        ))}
      </ul>

      {view === "map" && (
        <div className="relative hidden w-full md:block" style={{ aspectRatio: `${W} / ${H}` }} role="group" aria-label="Blueprint treemap">
          {root.children.map((dn) => {
            const d = domainRows.get(dn.data.id);
            const dom = exam.domains.find((x) => x.id === dn.data.id);
            return (
              <div key={dn.data.id}>
                <div
                  className="absolute overflow-hidden rounded-theme border border-line bg-surface"
                  style={{ left: `${(dn.x0 / W) * 100}%`, top: `${(dn.y0 / H) * 100}%`, width: `${((dn.x1 - dn.x0) / W) * 100}%`, height: `${((dn.y1 - dn.y0) / H) * 100}%` }}
                >
                  <div className="truncate px-2 pt-0.5 text-xs font-medium text-muted">
                    {dom.name} · {dom.weightPct}% · {metric(d)}
                  </div>
                </div>
                {dn.children.map((cn) => {
                  const o = rows.get(cn.data.id);
                  const ob = objectiveById.get(cn.data.id);
                  const tone = STATUS_META[o.status].tone;
                  const dim = !matches(o);
                  return (
                    <Link
                      key={cn.data.id}
                      href={`/map/${cn.data.id}`}
                      title={`${ob.code} ${ob.title} — ${STATUS_META[o.status].label}`}
                      className={`absolute flex flex-col overflow-hidden rounded-theme border p-2 text-xs leading-tight transition-opacity hover:ring-2 hover:ring-focus ${TILE[tone]} ${dim ? "opacity-25" : ""}`}
                      style={{ left: `${(cn.x0 / W) * 100}%`, top: `${(cn.y0 / H) * 100}%`, width: `${((cn.x1 - cn.x0) / W) * 100}%`, height: `${((cn.y1 - cn.y0) / H) * 100}%` }}
                    >
                      <span className="font-semibold">{ob.code}</span>
                      <span className="line-clamp-3 opacity-90">{ob.title}</span>
                      <span className="mt-auto font-medium">{metric(o)}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div className={view === "map" ? "md:hidden" : ""}>
        {exam.domains.map((d) => {
          const items = d.objectives.filter((o) => matches(rows.get(o.id)));
          if (items.length === 0) return null;
          const dr = domainRows.get(d.id);
          return (
            <section key={d.id} className="mb-5">
              <h2 className="mb-1 flex flex-wrap items-baseline gap-x-2 font-display text-lg">
                {d.name} <span className="text-sm text-muted">{d.weightPct}% of exam · {metric(dr)}</span>
              </h2>
              <ul className="divide-y divide-line rounded-theme border border-line bg-surface">
                {items.map((o) => {
                  const r = rows.get(o.id);
                  return (
                    <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                      <Link href={`/map/${o.id}`} className="min-w-0 flex-1 hover:underline">
                        <span className="font-medium">{o.code}</span> {o.title}
                      </Link>
                      <span className="text-muted">{metric(r)}</span>
                      <StatusBadge status={r.status} />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Toolbar({ label, items, current, href }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted">{label}</span>
      <div className="flex overflow-hidden rounded-theme border border-line">
        {items.map(([k, text]) => (
          <Link key={k} href={href(k)} aria-current={k === current ? "true" : undefined} className={`px-3 py-1 ${k === current ? "bg-accent text-on-accent" : "bg-surface hover:bg-idle-soft"}`}>
            {text}
          </Link>
        ))}
      </div>
    </div>
  );
}
