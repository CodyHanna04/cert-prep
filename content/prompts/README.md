# Prompt kit and content workflow

How questions get into the bank. Background and the reasoning are in `docs/07-ai-content-pipeline.md`; this is the working checklist.

| File | Use |
|---|---|
| `onboard-exam.md` | Build a new exam pack (blueprint only, no questions) |
| `draft-questions.md` | Draft a batch for one objective |
| `verify-blind.md` | Independent check of a batch, without the key |
| `../<pack>/style.md` | Exam-specific style notes the drafting prompt includes (optional) |

## One batch, end to end

1. **Pick an objective.** The app's *Library → Coverage* page shows approved, draft and target counts per objective; each row has a *Prompt* link that fills in `draft-questions.md` for you.
2. **Draft.** Give the filled prompt, plus `content/<pack>/in-scope-services.md`, to a model that can open the vendor's documentation. It writes `content/<pack>/questions/<objective>-<date>.json`.
3. **Lint.** `npm run content:lint` checks structure, the exam profile (option counts, banned phrases, out-of-scope services), duplicates, and the batch checks from doc 07 section 5 (answer position, longest-option tell, absolute words, stale `lastVerified`). Fix every error. `--strict` makes warnings fail too.
4. **Blind check.** `npm run content:blind -- <batch.json>` writes `<batch>.blind.json` (no key, no rationales). Run `verify-blind.md` on it in a different session, save the reply as `<batch>.answers.json`, then `npm run content:check -- <batch.json> <batch>.answers.json --write`. Disagreements get `needsAttention: true`.
5. **Import.** In the app: *Library → Import*. Drafts land excluded from practice, mocks and stats.
6. **Review.** *Library → Drafts*: answer each question blind, then compare with the key and the `refs`. Approve, edit, or reject with a reason. Read the `needsAttention` ones slowly.
7. **Export.** *Library → Questions → Export approved* writes the approved bank back to a file in the same format, so approvals can be committed to git or loaded into another database.

## Where things live

Question files in `content/<pack>/questions/` are the source of truth for *drafts* and are versioned in git. Approval happens in the app, so the database holds the approved bank; the export keeps a copy outside the database. Each user imports into their own account: there is no shared bank.

`*.blind.json` and `*.answers.json` are working files for step 4. They are ignored by the linter and can be deleted after the check.
