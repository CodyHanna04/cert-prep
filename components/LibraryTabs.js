"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/library", "Questions", ["/library/questions"]],
  ["/library/import", "Import", []],
  ["/library/drafts", "Drafts", []],
  ["/library/mistakes", "Mistakes & flagged", []],
  ["/library/coverage", "Coverage", ["/library/prompt"]],
  ["/library/study", "Study material", []],
  ["/library/flashcards", "Flashcards", []],
];

/** Library sub-navigation; the current tab is marked (question pages count as Questions, prompts as Coverage). */
export function LibraryTabs() {
  const path = usePathname();
  const active = (href, also) =>
    href === "/library" ? path === "/library" || also.some((p) => path.startsWith(p)) : path.startsWith(href) || also.some((p) => path.startsWith(p));
  return (
    <nav aria-label="Library" className="mb-6 flex flex-wrap gap-1 border-b border-line pb-2 text-sm">
      {TABS.map(([href, label, also]) => {
        const on = active(href, also);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`rounded-theme px-3 py-1.5 ${on ? "bg-accent-soft font-medium text-text" : "text-muted hover:bg-idle-soft hover:text-text"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
