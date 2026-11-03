"use client";
import { useState, useTransition } from "react";
import { importDataAction, deleteAccountAction } from "@/app/actions/account.js";
import { Button, buttonClass, Card, checkClass, Field, fileInputClass, Input, LinkButton } from "@/components/ui/index.js";

export function DataCard({ userName, error }) {
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();

  async function onFile(e) {
    const file = e.target.files?.[0];
    setText(file ? await file.text() : "");
    setMessage(null);
  }

  function runImport() {
    start(async () => {
      const res = await importDataAction(text, confirmed);
      setMessage(res.error ? { error: res.error } : { ok: `Restored ${res.counts.exams} exam(s), ${res.counts.questions} questions, ${res.counts.sessions} sessions.` });
    });
  }

  return (
    <>
      <Card title="Your data">
        <p className="text-sm text-muted">Everything you own on this site (exams, questions, notes, flags, sessions and answers) as one plain JSON file. Nothing is locked in.</p>
        <div className="mt-3"><a className={buttonClass("secondary")} href="/account/export" download>Download my data</a></div>

        <div className="mt-6 border-t border-line pt-4">
          <h3 className="font-medium">Restore from a file</h3>
          <p className="mt-1 text-sm text-muted">This replaces everything you currently have.</p>
          <input type="file" accept=".json,application/json" onChange={onFile} className={`mt-2 ${fileInputClass}`} aria-label="Export file" />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className={checkClass} />
            I understand my current data will be replaced.
          </label>
          <div className="mt-3"><Button onPress={runImport} isDisabled={pending || !text || !confirmed}>Replace my data</Button></div>
          {message?.ok && <p role="status" className="mt-2 text-sm text-ok">{message.ok}</p>}
          {message?.error && <p role="alert" className="mt-2 text-sm text-bad">{message.error}</p>}
        </div>
      </Card>

      <Card title="Delete my account">
        <p className="text-sm text-muted">Removes your sign-in, passkeys and every piece of study data. This cannot be undone. Download your data first if you might want it.</p>
        <form action={deleteAccountAction} className="mt-3 grid max-w-sm gap-3">
          <Field label={`Type "${userName}" to confirm`}>
            <Input name="confirm" autoComplete="off" required />
          </Field>
          {error === "confirm" && <p role="alert" className="text-sm text-bad">That did not match your name.</p>}
          <div><Button type="submit" variant="danger">Delete my account</Button></div>
        </form>
      </Card>
    </>
  );
}
