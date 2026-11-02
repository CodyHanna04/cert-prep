import Link from "next/link";

const TABS = [
  ["/library", "Questions"],
  ["/library/import", "Import"],
  ["/library/drafts", "Drafts"],
  ["/library/coverage", "Coverage"],
  ["/library/study", "Study material"],
  ["/library/flashcards", "Flashcards"],
];

export default function LibraryLayout({ children }) {
  return (
    <>
      <nav
        aria-label="Library"
        className="mb-6 flex flex-wrap gap-1 border-b border-line pb-2 text-sm"
      >
        {TABS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-theme px-3 py-1.5 text-muted hover:bg-idle-soft hover:text-text"
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
