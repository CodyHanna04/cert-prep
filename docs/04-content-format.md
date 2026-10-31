# 04 — Content Format (import/export)

Importing content is the only way data gets in at MVP, so the format is a first-class contract. It is versioned (`formatVersion`) and validated with Zod; the same schema powers export.

> **Legal reminder shown at import:** only import material you wrote or have the right to use. Do not import exam dumps/recalled real exam questions — they violate candidate agreements and can cost you the certification.

## JSON format (v1)

```json
{
  "formatVersion": 1,
  "exam": {
    "code": "EXAMPLE-101",
    "name": "Example Exam (illustrative only; see content/clf-c02/blueprint.json for the real CLF-C02 pack)",
    "vendor": "Example Vendor",
    "passMarkPct": 70,
    "timeLimitMin": 90,
    "questionCount": 65,
    "domains": [
      { "key": "d1", "name": "Cloud Concepts", "weightPct": 24 },
      { "key": "d2", "name": "Security and Compliance", "weightPct": 30 },
      { "key": "d3", "name": "Technology", "weightPct": 34 },
      { "key": "d4", "name": "Billing and Support", "weightPct": 12 }
    ]
  },
  "questions": [
    {
      "id": "q-0001",
      "domain": "d2",
      "objective": "2.1",
      "type": "single",
      "stem": "Which principle says users should have only the permissions they need?",
      "options": [
        { "text": "Least privilege", "correct": true,  "rationale": "Grants the minimum access required for a task." },
        { "text": "Separation of duties", "correct": false, "rationale": "Splits critical tasks among people; different from limiting permissions." },
        { "text": "Defense in depth", "correct": false, "rationale": "Layering controls; doesn't specifically limit a user's permission set." },
        { "text": "Shared responsibility", "correct": false, "rationale": "Divides security duties between provider and customer." }
      ],
      "explanation": "Least privilege reduces blast radius if credentials are compromised.",
      "difficulty": 2,
      "tags": ["iam", "principles"],
      "refs": ["https://example.com/docs/least-privilege"],
      "source": "own"
    }
  ]
}
```

### Field rules

| Field | Required | Rules |
|---|---|---|
| `formatVersion` | yes | Integer; importer rejects unknown major versions with a helpful message. |
| `exam` | yes (or target exam chosen at import) | If it matches an existing exam by `code`, domains are merged by `key`/name. |
| `questions[].id` | no | Stable id for re-import updates; if absent, `contentHash` is used. |
| `questions[].domain` | yes | Must match a domain `key` (or name). |
| `questions[].type` | yes | `single` \| `multi` \| `tf` (MVP). Later: `ordering`, `matching`, `fill`. |
| `questions[].stem` | yes | Markdown (sanitized; images by URL or data URI ≤ size limit). Code blocks supported. |
| `options` | yes | 2–8 options. `single`/`tf`: exactly one `correct`. `multi`: ≥ 1 correct; stem should state how many to choose. |
| `options[].rationale` | strongly recommended | Importer *warns* (not errors) when missing — rationales for every option are the main learning value. |
| `explanation` | no | General explanation shown after answering. |
| `difficulty` | no | 1–5. |
| `tags` | no | Lowercase kebab strings. |
| `source` | no | `own` \| `licensed` \| `imported` \| `ai-draft`; defaults to `imported`. `ai-draft` lands in the review queue. |

### Additions for objectives, drafts and provenance (added 2026-10-30)

- `exam.domains[].objectives`: array of `{ "code": "2.3", "title": "…" }`. Question `objective` must match a code (error if not). See `content/clf-c02/blueprint.json` for a full real example.
- `exam` may also carry `scoredQuestionCount`, `unscoredQuestionCount`, `scaledPassScore`, `questionTypes`, `sources[]`, and notes. Unknown `exam` fields are preserved but ignored by the app.
- `questions[].reviewStatus`: `draft` \| `approved` \| `rejected` (default: `approved` for `own`/`licensed`, `draft` for `ai-draft`/`imported`). Drafts are excluded from sessions and stats.
- Provenance (optional but required by lint for `ai-draft`): `generator` (model id), `generatedAt` (ISO date), `lastVerified` (ISO date), `refs` (doc URLs supporting the answer), `needsAttention` (bool, set by the verification pass).

### Per-exam question profiles

An exam may declare a `profile` the validator enforces on top of the generic rules. **CLF-C02 profile:** `single` ⇒ exactly 4 options with 1 correct; `multi` ⇒ ≥ 5 options with ≥ 2 correct and a stem that states how many to choose; no "all/none of the above". (Matches the official guide's description of response types.)

### Validation outcomes

Errors (block that question): missing stem, unknown domain, wrong correct-count for type, duplicate option text. Warnings (import anyway): missing rationales, missing explanation, no difficulty, similar-to-existing (near-duplicate by normalized text). The preview screen shows totals and a downloadable error report. Import is **all-or-nothing per confirm** unless the user picks "import valid rows only."

## Markdown authoring format (convenience)

For hand-writing in an editor. One file → many questions, separated by `---`. Parsed into the JSON model above.

```markdown
---
exam: EXAMPLE-101
---

## q-0001
domain: d2 | objective: 2.1 | type: single | difficulty: 2 | tags: iam, principles

Which principle says users should have only the permissions they need?

- [x] Least privilege :: Grants the minimum access required for a task.
- [ ] Separation of duties :: Splits critical tasks among people; different concept.
- [ ] Defense in depth :: Layering controls; doesn't limit a user's permission set.
- [ ] Shared responsibility :: Divides duties between provider and customer.

> Least privilege reduces blast radius if credentials are compromised.
```

Conventions: `- [x]`/`- [ ]` marks correctness; text after ` :: ` is the rationale; the trailing blockquote is the explanation; the line starting `domain:` holds metadata.

## Export formats

- **Personal data export** (`certprep-export-YYYYMMDD.json`): *your* exams, domains, objectives, questions, notes, flags, sessions and responses (later: cards, review logs). Import replaces your data after confirmation. Deliberately plain: no schema migrations, checksum or merge mode.
- **Content-only export:** same as the import format above → share a question bank with a study partner.
- **CSV of responses** for external analysis.

## Test fixtures to create with F02

`valid-small.json` (5 questions), `valid-all-types.json`, `invalid-*.json` (one per error rule), `warnings-only.json`, `large-5000.json` (generated), `markdown-basic.md`, `xss-attempt.json` (script tags in stems/options).
