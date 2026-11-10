"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Dashboard"],
  ["/courses", "Courses"],
];

export function Nav() {
  const path = usePathname();
  const active = (href) =>
    href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
  return (
    <nav aria-label="Main" className="flex gap-1">
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

/** The signed-in name in the top bar; it links to Account and is marked while you are there. */
export function AccountLink({ name }) {
  const on = usePathname().startsWith("/account");
  return (
    <Link
      href="/account"
      aria-current={on ? "page" : undefined}
      className={`rounded-theme px-3 py-1.5 text-sm ${on ? "bg-accent-soft font-medium text-text" : "text-muted hover:bg-idle-soft hover:text-text"}`}
    >
      {name}
    </Link>
  );
}
