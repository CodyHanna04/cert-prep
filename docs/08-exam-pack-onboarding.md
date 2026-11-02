# 08 — Exam Pack Framework (how to add a certification)

**Purpose:** when you pick another certification, adding it is a short, repeatable process with built-in checks, not a research project. Nothing certification-specific lives in app code; each exam is a **pack** of data built from the vendor's own published material. This doc is the process. It deliberately does **not** plan which exams come next.

## 1. The toolkit (already in the repo)

| Piece | Path | What it does |
|---|---|---|
| Pack template | [content/_template/](../content/_template/blueprint.json) | `blueprint.json` and `scope.md` with every field and a TODO to fill. |
| Onboarding prompt | [content/prompts/onboard-exam.md](../content/prompts/onboard-exam.md) | The instruction to give Claude: you supply the vendor and exam name; it researches and builds the pack. |
| Validator | [scripts/validate-pack.mjs](../scripts/validate-pack.mjs) | `node scripts/validate-pack.mjs content/<code>/blueprint.json` checks structure, weights sum to 100, unique objective codes, non-empty scope, valid dates and sources, supported question types, scored/unscored counts, and refuses leftover TODOs. Exit code 1 on any error. |
| Pack loader (in the app) | ticket T-011 | Loads a validated pack into a user's account and diffs it against an existing pack with the same code. |
| Question drafting | [doc 07](07-ai-content-pipeline.md) | Separate step, run per objective once the pack exists. |

## 2. What a pack contains

```
content/<exam-code>/
  blueprint.json     exam facts, domains with weights, objectives with scope, sources, optional version block
  scope.md           the vendor's in-scope / out-of-scope lists, transcribed
  drafts/            AI-drafted question files (added later, per doc 07)
```

Key `exam` fields: `code, name, vendor`, `questionCount, timeLimitMin` (+ scored/unscored counts if the vendor says), `questionTypes` (what the vendor says; `single`, `multi`, `tf` are supported), `passMarkPct` (a **proxy** when the vendor reports a scaled score, explained in `passMarkNote`), `readinessTargetPct` (your own target, default 80), `domains[]` → `weightPct`, `objectives[]` → `code, title, scope[]`. `sources[]` records title, URL, `retrievedOn` and a note on what was taken and condensed. An optional `profile.outOfScopeTerms` list (services the guide names as out of scope) is enforced by the lint CLI. An optional `content/<code>/style.md` holds exam-specific question style notes for the drafting prompt. An optional `marketing` block (`tagline, level, audience, highlights[]`) is the copy the Courses page shows; write it yourself from the blueprint facts, never paste vendor marketing. An optional `version` block records a pending change (current version, registration-opens date, last day of the old version).

## 3. The process (about an hour of your time, mostly review)

| Step | Who | Gate |
|---|---|---|
| 1. Choose the exam (vendor + exam name). Say which **version** you'll sit if more than one exists. | You | — |
| 2. Run the onboarding prompt: find the vendor's certification page, the **current** guide, and any pending version change; read the guide itself; transcribe format, scoring, domains, weights, objectives; condense scope; cross-check a second vendor page. | Claude | Every fact traceable to a vendor page and recorded in `sources[]`. |
| 3. Validate: `node scripts/validate-pack.mjs …` | Claude (and CI later) | Exit 0, no TODOs. |
| 4. **Review the report**: the table of domains/weights, the list of single-source facts, anything marked "not stated", unsupported question types, version notes. | You | You sign off or send corrections. |
| 5. Triage unsupported question types (§4). | You + Claude | A decision recorded in the pack's notes. |
| 6. Load the pack in the app; set the readiness target and exam date. | You | The map shows every objective as "No questions." |
| 7. Draft questions per objective ([doc 07](07-ai-content-pipeline.md)), review them, approve. | Claude + you | Coverage view shows approved counts approaching targets. |

**A pack is "ready" when:** the validator passes, you've reviewed the onboarding report, the version it covers is the one you'll sit, and unsupported types have a decision.

## 4. Unsupported question types (triage)

The app supports single-answer, multiple-response and true/false. If the vendor's exam also uses ordering, matching, drag-and-drop, hot area, case studies, simulations or labs, pick one per type:

| Choice | When it fits |
|---|---|
| **Skip** | The type is a small share of the exam or can't be represented. Cover the same objective with conceptual single/multi questions. Note it in the pack. |
| **Approximate** | The item reduces cleanly (e.g. "match each service to its purpose" → a multi-response question). |
| **Add the type** | It is a large share of the exam or the vendor gives it extra weight. This is an app ticket: schema, import validation, scoring, question UI, review queue. Decide per exam, not in advance. |

The validator rejects an unsupported type in `questionTypes` until a decision is made and either the type is supported or it is removed from the pack with a note.

## 5. Versions and updates

- **Before transcribing, check for a newer or scheduled version.** The vendor's certification page often links the newest guide and announces a change date before the old guide is retired. Build for the version you will sit.
- **When a new version appears:** build a new pack folder for it (`content/<new-code>/`), record the old/new relationship in both `version` blocks, and keep the old pack until you've finished with it. The loader's diff (T-011) shows what changed in domains, weights and objectives.
- **Re-check cadence:** the `retrievedOn` date is shown on the exam screen with a re-check link. Look again before booking and whenever the vendor announces a revision. Guides typically state how much notice they give before a change takes effect (the AWS guides say at least one month).
- **Questions carry `lastVerified`;** after a pack revision, use the objective codes to find questions to re-check or retire.

## 6. Packs in the repo (reference examples, not a roadmap)

| Pack | Version | Notes |
|---|---|---|
| `content/clf-c02/` | CLF-C02, guide Version 1.0 | First pack; multiple choice + multiple response. |
| `content/dva-c03/` | DVA-C03 (registration opens 2026-12-01; DVA-C02's last day is 2026-11-30) | Second pack; shows the `version` block. |

Both pass the validator. No further packs are planned until you choose one; then run §3.

## 7. What the app must support

- Multiple exams with a per-exam switcher; all progress scoped per exam (T-010).
- Pack loader with a diff view (T-011).
- Pack tooling wired into npm scripts, including a "new pack from template" command (T-015).
- Per-exam question-profile validation driven by the pack, not hard-coded (T-021).
- Per-exam readiness target (default 80%) (T-010).

## 8. Lessons from the first two packs

- **Check the vendor's certification page for the newest guide link first.** The old guide URL I tried for the second exam was the previous version; the certification page already linked the new one.
- **Documentation sites may render as an empty shell** to a text fetch. Look for the PDF version; if the fetch tool saves the raw PDF, read it by page range.
- **Some facts live on only one page** (time limit and price were on the certification page, not in the guide). Record that in `sources[].note`.
- **The validator caught nothing in the real packs but catches every deliberate break** I tried: weights summing to 101, duplicate objective codes, empty scope, unsupported type, scored/unscored mismatch, malformed date.
