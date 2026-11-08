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
5. **Review.** Read each question with its `refs` open: is the key right, is exactly one option defensible, does the stem give the answer away? Then check fit: does it use the exam guide's names, and is it at the guide's depth? Where the current docs differ from the guide, the guide wins unless the key itself became wrong (doc 17). Fix what needs fixing in the file. (You can also import the batch into your own account first, *Library → Import*, and use *Library → Drafts* to answer each question blind.)
6. **Publish to the shared bank.** Set `reviewStatus` to `"approved"` and `lastVerified` to the review date, then move the file from `content/<pack>/questions/` to `content/<pack>/bank/`. `npm run content:lint` refuses anything in `bank/` that is not approved, and catches an id or question left in both folders.
7. **Deploy.** Commit, push, and run `sh scripts/deploy.sh` on the server. Every learner's copy of the bank updates the next time they open the app: new questions appear, edited ones change in place, and removed ones are retired (kept for history, out of practice).

## Where things live

- `content/<pack>/questions/`: drafts not yet reviewed (an inbox).
- `content/<pack>/bank/`: the **shared baseline bank**. Every learner gets these questions as approved, read-only rows in their own account. Fix a bank question by editing its file, never in the app.
- Questions a learner imports in the app stay in **their** account only; nobody else sees them. *Export approved* writes them out in the same format (for example, to propose some for the bank).

`*.blind.json` and `*.answers.json` are working files for step 4. They are ignored by the linter and can be deleted after the check.
