import { getAppContext } from "@/lib/app/context.js";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui/index.js";
import { ImportForm } from "./ImportForm.js";

export const metadata = { title: "Import questions" };

export default async function ImportPage() {
  const { exam } = await getAppContext();
  if (!exam) return <EmptyState title="No course selected" action={<LinkButton href="/courses" variant="primary">Choose a course</LinkButton>} />;
  return (
    <>
      <PageHeader
        title="Import questions"
        subtitle={`Into ${exam.code}. A JSON file of questions.`}
        actions={<LinkButton href="/library/import/format">File format and example</LinkButton>}
      />
      <p className="mb-4 max-w-prose rounded-theme border border-line bg-surface p-3 text-sm text-muted">
        Only import material you wrote or have the right to use. Do not import exam dumps or recalled real exam questions: they violate candidate agreements and can cost you the certification.
        Questions marked <code>ai-draft</code> arrive as drafts and stay out of practice and progress until you approve them.
      </p>
      <ImportForm />
    </>
  );
}
