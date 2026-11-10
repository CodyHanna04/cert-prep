import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { AccountLink, Nav } from "@/components/Nav.js";
import { CourseBar } from "@/components/CourseBar.js";
import { DomainRing } from "@/components/DomainRing.js";

export default async function AppLayout({ children }) {
  const { user, exam } = await getAppContext();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight"
          >
            <DomainRing
              size={28}
              thickness={16}
              label=""
              segments={[{ weight: 4 }, { weight: 3, opacity: 0.65 }, { weight: 2, opacity: 0.4 }]}
            />
            CertPrep
          </Link>
          <div className="flex-1">
            <Nav />
          </div>
          <AccountLink name={user.name} />
        </div>
      </header>
      <CourseBar course={exam ? { code: exam.code, name: exam.name } : null} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
