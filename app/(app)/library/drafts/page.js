import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { countsByObjective } from "@/lib/db/questions.js";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui/index.js";

export const metadata = { title: "Drafts" };

export default async function DraftsPage() {
  const { user, exam: active } = await getAppContext();
  if (!active) return <EmptyState title="No course selected" action={<LinkButton href="/courses" variant="primary">Choose a course</LinkButton>} />;
  const { exam, counts } = await withUser(user.id, async (db) => ({ exam: await getExam(db, active.id), counts: await countsByObjective(db, active.id) }));
  const drafts = new Map(counts.filter((c) => c.reviewStatus === "draft").map((c) => [c.objectiveId, c.n]));
  const total = [...drafts.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Draft review queue"
        subtitle={`${total} draft${total === 1 ? "" : "s"} waiting. You answer first, then see the key, then approve, edit or reject.`}
        actions={total > 0 && <LinkButton href="/library/drafts/review" variant="primary">Start reviewing</LinkButton>}
      />
      {total === 0 ? (
        <EmptyState title="Nothing to review" action={<LinkButton href="/library/import">Import questions</LinkButton>}>
          AI-drafted questions land here as drafts. They never count toward practice or progress until approved.
        </EmptyState>
      ) : (
        exam.domains.map((d) => {
          const items = d.objectives.filter((o) => drafts.get(o.id));
          if (!items.length) return null;
          return (
            <section key={d.id} className="mb-5">
              <h2 className="mb-1 font-display text-lg">{d.name}</h2>
              <ul className="divide-y divide-line rounded-theme border border-line bg-surface">
                {items.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1"><span className="font-medium">{o.code}</span> {o.title}</span>
                    <span className="text-muted">{drafts.get(o.id)} drafts</span>
                    <Link className="text-accent underline" href={`/library/drafts/review?objective=${o.id}`}>Review</Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
