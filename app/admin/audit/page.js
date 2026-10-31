import { adminDb } from "@/lib/admin/server.js";
import { listAudit } from "@/lib/admin/store.js";
import { EmptyState, PageHeader } from "@/components/ui/index.js";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const rows = await listAudit(adminDb());
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin action, newest first. Append-only." />
      {rows.length === 0 ? (
        <EmptyState title="Nothing yet" />
      ) : (
        <div className="overflow-x-auto rounded-theme border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted"><tr><th className="px-3 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">Who</th><th className="px-3 py-2 font-medium">Action</th><th className="px-3 py-2 font-medium">User</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={i}><td className="px-3 py-2">{new Date(r.at).toLocaleString()}</td><td className="px-3 py-2">{r.actor}</td><td className="px-3 py-2">{r.action}</td><td className="px-3 py-2">{r.target_name ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
