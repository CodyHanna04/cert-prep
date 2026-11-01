"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/course", "Overview"],
  ["/map", "Map"],
  ["/practice", "Practice"],
  ["/mock", "Mock exam"],
  ["/library", "Library"],
  ["/history", "History"],
  ["/settings", "Settings"],
];

const inCourse = (path) => TABS.some(([href]) => path === href || path.startsWith(`${href}/`));

/**
 * Second bar, shown only on pages that belong to one course. It always names the current course and links to
 * the Courses page, so there is no hidden "active exam" state and nothing to get stuck on.
 */
export function CourseBar({ course }) {
  const path = usePathname();
  if (!course || !inCourse(path)) return null;
  const active = (href) => path === href || path.startsWith(`${href}/`);
  return (
    <div className="border-b border-line bg-accent-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="shrink-0 whitespace-nowrap rounded-theme bg-accent px-2 py-0.5 font-display text-xs font-semibold text-on-accent">
            {course.code}
          </span>
          <span className="truncate font-medium">{course.name}</span>
          <Link
            href="/courses"
            className="ml-1 shrink-0 text-xs text-muted underline hover:text-text"
          >
            Switch course
          </Link>
        </div>
        <nav aria-label="Course" className="flex flex-1 flex-wrap justify-end gap-1">
          {TABS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`rounded-theme px-3 py-1 text-sm ${active(href) ? "bg-surface font-medium text-text shadow-card" : "text-muted hover:text-text"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
