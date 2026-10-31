"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Today"],
  ["/map", "Map"],
  ["/practice", "Practice"],
  ["/mock", "Mock"],
  ["/library", "Library"],
  ["/history", "History"],
  ["/settings", "Settings"],
];

export function Nav() {
  const path = usePathname();
  const active = (href) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1">
      {LINKS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={`rounded-theme px-3 py-1.5 text-sm ${active(href) ? "bg-accent text-on-accent" : "text-muted hover:bg-idle-soft hover:text-text"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
