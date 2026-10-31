import Link from "next/link";
import { getAppContext } from "@/lib/app/context.js";
import { withUser } from "@/lib/db/index.js";
import { listSessions } from "@/lib/db/sessions.js";
import { fmtDateTime } from "@/lib/app/view.js";
import { Badge, EmptyState, LinkButton, PageHeader, pct } from "@/components/ui/index.js";

export const metadata = { title: "History" };

export default async function HistoryPage() {
  const { user, exam } = await getAppContext();
  if (!exam) return <EmptyState title="No exam yet" action={<LinkButton href="/settings" variant="primary">Add an exam</LinkButton>} />;
  const sessions = await withUser(user.id, (db) => listSessions(db, exam.id, 100));

  return (
    <>
      <PageHeader title="History" subtitle={`${exam.code} sessions, newest first.`} />
      {sessions.length === 0 ? (
        <EmptyState title="No sessions yet" action={<LinkButton href="/practice" variant="primary">Start practicing</LinkButton>} />
      ) : (
        <div className="overflow-x-auto rounded-theme border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">
                    <Link className="text-accent underline" href={s.status === "in-progress" ? `/practice/${s.id}` : `/history/${s.id}`}>{fmtDateTime(s.startedAt)}</Link>
                  </td>
                  <td className="px-3 py-2 capitalize">{s.mode}</td>
                  <td className="px-3 py-2">
                    <Badge tone={s.status === "completed" ? "ok" : s.status === "in-progress" ? "info" : "idle"}>{s.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {s.status === "in-progress" ? `${s.answered}/${s.total} answered` : `${s.correct}/${s.total} (${pct(s.total ? (s.correct / s.total) * 100 : 0)})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
