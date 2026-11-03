import Link from "next/link";
import { DomainRing } from "@/components/DomainRing.js";
import { buttonClass } from "@/components/ui/index.js";

export const metadata = { title: "Page not found" };

/** Shown for unknown URLs and for records that are not yours (which look the same on purpose). */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <DomainRing
        size={72}
        label=""
        segments={[
          { weight: 24, tone: "idle", opacity: 0.5 },
          { weight: 30, tone: "idle", opacity: 0.35 },
          { weight: 34, tone: "idle", opacity: 0.5 },
          { weight: 12, tone: "accent", opacity: 1 },
        ]}
      />
      <h1 className="title-rule mt-6 font-display text-3xl tracking-tight [&::after]:mx-auto">Page not found</h1>
      <p className="mt-4 text-sm text-muted">
        That page doesn&apos;t exist, or it belongs to another account. Nothing on this site is shared between accounts.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className={buttonClass("primary")}>Go to the dashboard</Link>
        <Link href="/courses" className={buttonClass("secondary")}>Browse courses</Link>
      </div>
    </main>
  );
}
