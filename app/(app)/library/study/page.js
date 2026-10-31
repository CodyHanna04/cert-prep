import { EmptyState, PageHeader } from "@/components/ui/index.js";

export const metadata = { title: "Study material" };

export default function StudyPage() {
  return (
    <>
      <PageHeader title="Study material" />
      <EmptyState title="Coming later">
        Study notes for each objective will live here and on the objective pages. For now, practice questions carry the learning through their explanations.
      </EmptyState>
    </>
  );
}
