import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui/index.js";
import { QuestionEditor } from "../[id]/QuestionEditor.js";

export const metadata = { title: "New question" };

export default async function NewQuestionPage({ searchParams }) {
  const { objective } = await searchParams;
  const { user, exam: active } = await getAppContext();
  if (!active)
    return (
      <EmptyState
        title="No course selected"
        action={
          <LinkButton href="/courses" variant="primary">
            Choose a course
          </LinkButton>
        }
      />
    );
  const exam = await withUser(user.id, (db) => getExam(db, active.id));
  const objectives = exam.domains.flatMap((d) => d.objectives);
  // Start on the objective the link came from (objective detail), when there is one.

  return (
    <>
      <PageHeader
        title="New question"
        subtitle={`${exam.code} · your own questions are yours to edit, unlike the shared bank's.`}
      />
      <QuestionEditor
        objectives={objectives}
        defaultObjectiveId={objectives.some((o) => o.id === objective) ? objective : undefined}
        profile={exam.profile}
      />
    </>
  );
}
