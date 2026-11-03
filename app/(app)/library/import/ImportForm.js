"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { commitImportAction, previewImportAction } from "@/app/actions/library.js";
import { Badge, Button, Card, checkClass, fileInputClass } from "@/components/ui/index.js";

export function ImportForm() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [updateMatching, setUpdateMatching] = useState(false);
  const [pending, start] = useTransition();

  async function onFile(e) {
    const file = e.target.files?.[0];
    setPreview(null);
    setResult(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    const content = await file.text();
    setText(content);
    start(async () => {
      const res = await previewImportAction(content);
      if (res.error) setError(res.error);
      else setPreview(res);
    });
  }

  function commit(validOnly) {
    start(async () => {
      const res = await commitImportAction(text, { validOnly, updateMatching });
      if (res.error) setError(res.error);
      else {
        setResult(res.counts);
        setPreview(null);
        setError(null);
      }
    });
  }

  const s = preview?.summary;
  const problems = preview?.questions.filter((q) => !q.ok || q.warnings.length || q.duplicate) ?? [];

  return (
    <div className="space-y-4">
      <Card title="1. Choose a file">
        <label className="block text-sm">
          <span className="sr-only">JSON file</span>
          <input type="file" accept=".json,application/json" onChange={onFile} className={fileInputClass} />
        </label>
        {fileName && <p className="mt-2 text-sm text-muted">{fileName}</p>}
      </Card>

      {error && <p role="alert" className="rounded-theme border border-bad bg-bad-soft p-3 text-sm text-bad">{error}</p>}
      {pending && !preview && <p className="text-sm text-muted">Checking…</p>}

      {s && (
        <Card title="2. Preview">
          <ul className="mb-3 flex flex-wrap gap-2 text-sm">
            <Badge tone="ok">{s.valid} ready to import</Badge>
            {s.invalid > 0 && <Badge tone="bad">{s.invalid} with errors</Badge>}
            {s.duplicates > 0 && <Badge tone="idle">{s.duplicates} duplicates (skipped)</Badge>}
            {s.withWarnings > 0 && <Badge tone="warn">{s.withWarnings} with warnings</Badge>}
          </ul>
          {problems.length > 0 && (
            <ul className="mb-4 max-h-80 space-y-2 overflow-auto text-sm">
              {problems.map((q) => (
                <li key={q.index} className="rounded-theme border border-line p-2">
                  <span className="font-medium">Question {q.index + 1}{q.id ? ` (${q.id})` : ""}</span>{" "}
                  {q.duplicate && <Badge tone="idle">duplicate of {q.duplicate === "existing" ? "an existing question" : "an earlier one in this file"}</Badge>}
                  {q.errors.map((m) => <p key={m} className="text-bad">Error: {m}</p>)}
                  {q.warnings.map((m) => <p key={m} className="text-warn">Warning: {m}</p>)}
                </li>
              ))}
            </ul>
          )}
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={updateMatching} onChange={(e) => setUpdateMatching(e.target.checked)} className={checkClass} />
            Update existing questions that have the same <code>id</code> but changed content
          </label>
          <div className="flex flex-wrap gap-2">
            {s.invalid === 0 ? (
              <Button variant="primary" onPress={() => commit(false)} isDisabled={pending || s.valid === 0}>Import {s.valid} questions</Button>
            ) : (
              <Button variant="primary" onPress={() => commit(true)} isDisabled={pending || s.valid === 0}>Import the {s.valid} valid ones only</Button>
            )}
          </div>
        </Card>
      )}

      {result && (
        <Card title="Done">
          <p className="text-sm" role="status">
            Added {result.inserted}, updated {result.updated}, skipped {result.skipped}.{" "}
            <Link className="text-accent underline" href="/library/drafts">Review drafts</Link> or{" "}
            <Link className="text-accent underline" href="/library">see all questions</Link>.
          </p>
        </Card>
      )}
    </div>
  );
}
