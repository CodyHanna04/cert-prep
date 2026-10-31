import { EmptyState, PageHeader } from "@/components/ui/index.js";

export const metadata = { title: "Flashcards" };

export default function FlashcardsPage() {
  return (
    <>
      <PageHeader title="Flashcards" />
      <EmptyState title="Coming later">Spaced-repetition flashcards are planned after the core study loop.</EmptyState>
    </>
  );
}
