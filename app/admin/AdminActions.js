"use client";
import { useState, useTransition } from "react";
import { deleteUserAction, inviteUserAction, resetPasskeysAction, revokeSessionsAction } from "@/app/actions/admin.js";
import { Button, Field, Input } from "@/components/ui/index.js";

function LinkBox({ link, note }) {
  return (
    <div role="status" className="mt-3 rounded-theme border border-ok bg-ok-soft p-3 text-sm">
      <p className="font-medium text-ok">{note}</p>
      <p className="mt-1 break-all font-mono text-xs text-text">{link}</p>
      <p className="mt-2 text-xs text-muted">Shown once. It works a single time and expires in 72 hours. Send it to the person yourself.</p>
      <Button variant="secondary" className="mt-2" onPress={() => navigator.clipboard?.writeText(link)}>Copy</Button>
    </div>
  );
}

export function InviteForm() {
  const [name, setName] = useState("");
  const [result, setResult] = useState(null);
  const [pending, start] = useTransition();
  const submit = (e) => {
    e.preventDefault();
    start(async () => {
      const r = await inviteUserAction(name);
      setResult(r);
      if (r.link) setName("");
    });
  };
  return (
    <form onSubmit={submit} className="max-w-md">
      <Field label="Display name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </Field>
      <div className="mt-3"><Button type="submit" variant="primary" isDisabled={pending || !name.trim()}>Create invite link</Button></div>
      {result?.error && <p role="alert" className="mt-2 text-sm text-bad">{result.error}</p>}
      {result?.link && <LinkBox link={result.link} note="Invite link created." />}
    </form>
  );
}

export function UserActions({ user }) {
  const [mode, setMode] = useState(null); // "reset" | "delete"
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setMode(null);
    setTyped("");
  };
  const run = (fn) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (!r.error) reset();
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <Button variant="secondary" className="px-2 py-1 text-xs" onPress={() => { setMode("reset"); setResult(null); }}>Reset passkeys</Button>
        <Button variant="secondary" className="px-2 py-1 text-xs" isDisabled={pending} onPress={() => run(() => revokeSessionsAction(user.id))}>Sign out everywhere</Button>
        <Button variant="danger" className="px-2 py-1 text-xs" onPress={() => { setMode("delete"); setResult(null); }}>Delete</Button>
      </div>
      {mode && (
        <div className="rounded-theme border border-line p-2">
          <p className="text-xs text-muted">
            {mode === "reset"
              ? "Removes every passkey and session for this user and creates a one-time re-enrollment link."
              : "Permanently deletes the account and all of the user's study data."}{" "}
            Type <strong>{user.name}</strong> to confirm.
          </p>
          <div className="mt-2 flex gap-2">
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the user's name to confirm" autoComplete="off" />
            <Button
              variant={mode === "delete" ? "danger" : "primary"}
              isDisabled={pending || typed.trim() !== user.name}
              onPress={() => run(() => (mode === "reset" ? resetPasskeysAction(user.id, typed) : deleteUserAction(user.id, typed)))}
            >
              Confirm
            </Button>
            <Button variant="ghost" onPress={reset}>Cancel</Button>
          </div>
        </div>
      )}
      {result?.error && <p role="alert" className="text-xs text-bad">{result.error}</p>}
      {result?.link && <LinkBox link={result.link} note={`Re-enrollment link for ${user.name}.`} />}
    </div>
  );
}
