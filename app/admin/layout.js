import Link from "next/link";
import { requireAdmin } from "@/lib/admin/server.js";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const login = await requireAdmin();
  return (
    <>
      <header className="border-b border-warn bg-warn-soft">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3 text-sm">
          <strong className="font-display text-lg text-warn">CertPrep admin</strong>
          <Link href="/admin" className="hover:underline">Users</Link>
          <Link href="/admin/audit" className="hover:underline">Audit log</Link>
          <span className="flex-1" />
          <span className="text-muted">Signed in over Tailscale as {login}</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </>
  );
}
