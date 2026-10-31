import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { Nav } from "@/components/Nav.js";
import { ExamSwitcher } from "@/components/ExamSwitcher.js";

export default async function AppLayout({ children }) {
  const { user, exams, exam } = await getAppContext();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="font-display text-lg font-semibold">
            CertPrep
          </Link>
          <ExamSwitcher exams={exams} activeId={exam?.id} />
          <div className="flex-1">
            <Nav />
          </div>
          <Link href="/account" className="text-sm text-muted hover:text-text">
            {user.name}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
