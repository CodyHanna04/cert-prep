import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { reviewList } from "@/lib/db/questions.js";
import { isUuid } from "@/lib/app/feedback.js";
import { fmtDate, indexExam } from "@/lib/app/view.js";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui/index.js";

export const metadata = { title: "Mistakes & flagged" };

const LISTS = [
  ["missed", "Last missed", (q) => q.missed],
  ["guessed", "Correct guesses", (q) => q.guessed],
  ["flagged", "Flagged", (q) => q.flagged],
  ["bookmarked", "Bookmarked", (q) => q.bookmarked],
];

export default async function MistakesPage({ searchParams }) {
  const sp = await searchParams;
  const { user, exam: active } = await getAppContext();
  if (!active) {
    return <EmptyState title="No course selected" action={<LinkButton href="/courses" variant="primary">Choose a course</LinkButton>} />;
  }
  const { exam, items } = await withUser(user.id, async (db) => ({
    exam: await getExam(db, active.id),
    items: await reviewList(db, active.id),
  }));
  const { objectiveById } = indexExam(exam);
  const list = LISTS.find(([k]) => k === sp.list) ?? LISTS[0];
  const objectiveId = isUuid(sp.objective) ? sp.objective : null;
  const inScope = objectiveId ? items.filter((q) => q.objectiveId === objectiveId) : items;
  const shown = inScope.filter(list[2]);
  const href = (k, o = objectiveId) => `/library/mistakes?list=${k}${o ? `&objective=${o}` : ""}`;
  const objectivesHere = [...new Set(items.filter(list[2]).map((q) => q.objectiveId))]
    .map((id) => objectiveById.get(id))
    .filter(Boolean)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return (
    <>
      <PageHeader
        title="Mistakes & flagged"
        subtitle={`${exam.code}. Questions to look at again, from your answers and marks.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {items.some((q) => q.missed) && <LinkButton href="/practice?scope=missed" variant="primary">Practice missed</LinkButton>}
            {items.some((q) => q.flagged) && <LinkButton href="/practice?scope=flagged">Practice flagged</LinkButton>}
          </div>
        }
      />

      <nav aria-label="Lists" className="mb-4 flex flex-wrap gap-1 text-sm">
        {LISTS.map(([k, label, test]) => (
          <Link
            key={k}
            href={href(k)}
            aria-current={list[0] === k ? "page" : undefined}
            className={`rounded-full border px-3 py-0.5 ${list[0] === k ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-idle-soft"}`}
          >
            {label} <span className="tabular-nums opacity-75">{inScope.filter(test).length}</span>
          </Link>
        ))}
      </nav>

      {objectivesHere.length > 1 && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Objective:</span>
          <Link href={href(list[0], null)} className={objectiveId ? "hover:underline" : "font-medium text-text"}>All</Link>
          {objectivesHere.map((o) => (
            <Link key={o.id} href={href(list[0], o.id)} title={o.title} className={objectiveId === o.id ? "font-medium text-text" : "hover:underline"}>
              {o.code}
            </Link>
          ))}
        </p>
      )}

      {shown.length === 0 ? (
        <EmptyState title="Nothing here">
          {list[0] === "missed" && "Questions you get wrong show up here until you answer them correctly."}
          {list[0] === "guessed" && "Correct answers you marked as a guess show up here."}
          {list[0] === "flagged" && "Flag a question during practice (F) to come back to it."}
          {list[0] === "bookmarked" && "Bookmark a question during practice (B) to keep it for reference."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-theme border border-line bg-surface">
          {shown.map((q) => {
            const ob = objectiveById.get(q.objectiveId);
            return (
              <li key={q.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <Link href={`/library/questions/${q.id}#attempts`} className="min-w-0 flex-1 hover:underline">
                  {q.stem.length > 140 ? `${q.stem.slice(0, 140)}…` : q.stem}
                </Link>
                <span className="text-xs text-muted" title={ob?.title}>{ob?.code}</span>
                {q.misses > 0 && <Badge tone="bad">missed {q.misses}×</Badge>}
                {q.flagged && <Badge tone="warn">flagged</Badge>}
                {q.bookmarked && <Badge tone="info">bookmarked</Badge>}
                {q.lastAt && <span className="text-xs text-muted">{fmtDate(q.lastAt)}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
