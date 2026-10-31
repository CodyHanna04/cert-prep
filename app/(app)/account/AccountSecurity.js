"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client.js";
import { Badge, Button, Card } from "@/components/ui/index.js";

export function AccountSecurity({ welcome }) {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [current, setCurrent] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, s, me] = await Promise.all([authClient.passkey.listUserPasskeys(), authClient.listSessions(), authClient.getSession()]);
    setPasskeys(p.data ?? []);
    setSessions(s.data ?? []);
    setCurrent(me.data?.session?.token ?? null);
  }, []);
  useEffect(() => {
    // Fetch on mount: the lists come from the auth API, not from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function run(fn, okText) {
    setBusy(true);
    setMessage(null);
    const res = await fn();
    setBusy(false);
    if (res?.error) setMessage({ error: res.error.message || "That did not work." });
    else if (okText) setMessage({ ok: okText });
    await load();
  }

  const add = () =>
    run(() => authClient.passkey.addPasskey({ name: `Passkey ${new Date().toLocaleDateString()}` }), "Passkey added.");
  const remove = (id) => run(() => authClient.passkey.deletePasskey({ id }), "Passkey removed.");
  const rename = (id, current) => {
    const name = window.prompt("Name this passkey", current ?? "");
    if (name?.trim()) run(() => authClient.passkey.updatePasskey({ id, name: name.trim() }));
  };
  const signOut = async () => {
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  };

  const needSecond = passkeys && passkeys.length < 2;

  return (
    <>
      {(welcome || needSecond) && passkeys && (
        <p role="status" className="rounded-theme border border-info bg-info-soft p-4 text-sm text-info">
          {welcome ? "You're in. " : ""}Add a second passkey (a phone, a security key, or another computer) so losing one device never locks you out.
        </p>
      )}
      <Card title="Passkeys" action={<Button variant="primary" onPress={add} isDisabled={busy}>Add a passkey</Button>}>
        {!passkeys ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="flex-1">
                  <span className="font-medium">{p.name || "Unnamed passkey"}</span>
                  <span className="block text-xs text-muted">
                    Added {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                    {p.backedUp ? " · synced" : ""}
                  </span>
                </span>
                <Button variant="ghost" onPress={() => rename(p.id, p.name)} isDisabled={busy}>Rename</Button>
                <Button variant="ghost" onPress={() => remove(p.id)} isDisabled={busy || passkeys.length < 2}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
        {message?.ok && <p role="status" className="mt-3 text-sm text-ok">{message.ok}</p>}
        {message?.error && <p role="alert" className="mt-3 text-sm text-bad">{message.error}</p>}
      </Card>

      <Card title="Devices and sessions" action={<Button variant="secondary" onPress={() => run(() => authClient.revokeOtherSessions(), "Signed out of your other devices.")} isDisabled={busy}>Sign out other devices</Button>}>
        {!sessions ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="flex-1">
                  {s.userAgent ? s.userAgent.slice(0, 70) : "Unknown device"}
                  <span className="block text-xs text-muted">Last active {new Date(s.updatedAt).toLocaleString()}</span>
                </span>
                {s.token === current ? <Badge tone="ok">This device</Badge> : <Button variant="ghost" onPress={() => run(() => authClient.revokeSession({ token: s.token }))} isDisabled={busy}>Sign out</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div><Button variant="secondary" onPress={signOut}>Sign out</Button></div>
    </>
  );
}
