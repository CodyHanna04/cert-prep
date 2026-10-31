import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { nextDraft, countsByObjective } from "@/lib/db/questions.js";
import { isUuid } from "@/lib/app/feedback.js";
import { indexExam } from "@/lib/app/view.js";
import { EmptyState, LinkButton } from "@/components/ui/index.js";
import { ReviewCard } from "./ReviewCard.js";

export const metadata = { title: "Review drafts" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }) {
  const sp = await searchParams;
  const objectiveId = isUuid(sp.objective) ? sp.objective : null;
  const { user, exam: active } = await getAppContext();
  if (!active) return <EmptyState title="No exam yet" />;
  const { exam, draft, remaining } = await withUser(user.id, async (db) => {
    const counts = await countsByObjective(db, active.id);
    const left = counts.filter((c) => c.reviewStatus === "draft" && (!objectiveId || c.objectiveId === objectiveId)).reduce((n, c) => n + c.n, 0);
    return { exam: await getExam(db, active.id), draft: await nextDraft(db, active.id, objectiveId), remaining: left };
  });
  if (!draft) {
    return (
      <EmptyState title="All caught up" action={<LinkButton href="/library/drafts">Back to the queue</LinkButton>}>
        No drafts left to review{objectiveId ? " in this objective" : ""}.
      </EmptyState>
    );
  }
  const ob = indexExam(exam).objectiveById.get(draft.objectiveId);
  return (
    <ReviewCard
      key={draft.id}
      remaining={remaining}
      objective={`${ob.code} ${ob.title}`}
      editHref={`/library/questions/${draft.id}`}
      question={{
        id: draft.id,
        type: draft.type,
        stem: draft.stem,
        options: draft.options,
        explanation: draft.explanation,
        refs: draft.refs,
        generator: draft.generator,
        needsAttention: draft.needsAttention,
      }}
    />
  );
}
