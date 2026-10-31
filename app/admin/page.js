import { adminDb } from "@/lib/admin/server.js";
import { listUsers } from "@/lib/admin/store.js";
import { Card, PageHeader } from "@/components/ui/index.js";
import { InviteForm, UserActions } from "./AdminActions.js";

export default async function AdminUsersPage() {
  const users = await listUsers(adminDb());
  return (
    <>
      <PageHeader title="Users" subtitle="Accounts, passkey recovery and invitations. This site never shows anyone's study data." />
      <Card title="Invite someone" className="mb-6">
        <InviteForm />
      </Card>
      <div className="overflow-x-auto rounded-theme border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Passkeys</th>
              <th className="px-3 py-2 font-medium">Active sessions</th>
              <th className="px-3 py-2 font-medium">Last seen</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2">
                  <span className="font-medium">{u.name}</span>
                  <span className="block text-xs text-muted">joined {new Date(u.createdAt).toLocaleDateString()}{u.pending_link ? " · link pending" : ""}</span>
                </td>
                <td className="px-3 py-2">{u.passkeys}</td>
                <td className="px-3 py-2">{u.sessions}</td>
                <td className="px-3 py-2">{u.last_seen ? new Date(u.last_seen).toLocaleString() : "never"}</td>
                <td className="px-3 py-2"><UserActions user={{ id: u.id, name: u.name }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
