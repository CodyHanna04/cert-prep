# 07 — AI-Assisted Content Pipeline (CLF-C02)

**Decision (2026-10-30):** the first exam is **AWS Certified Cloud Practitioner (CLF-C02)**, and question content will come from AI drafting plus other sources. This doc defines how content gets in *without* the app having any AI features yet: Claude (here in Claude Code, or any LLM) writes import files; the app's review queue is the quality gate.

Exam facts used below are verified against the official guide (see `content/clf-c02/blueprint.json`): 65 questions (50 scored + 15 unscored), 90 min, scaled pass score 700 of 100–1000, multiple choice (1 of 4) and multiple response (2+ of 5+), four domains weighted 24/30/34/12.

> **Update 2026-10-31:** no third-party/purchased banks will be used. The only inputs are the vendor's published exam guide/docs (for grounding) and questions you write; the table below stays as the rule set if that ever changes. The drafting workflow is exam-agnostic — see [doc 08](08-exam-pack-onboarding.md) for onboarding other certifications.

## 1. Source rules (what may go in the bank)

| Source | OK? | How |
|---|---|---|
| **AI-drafted original questions**, grounded in the official exam guide + AWS documentation | ✅ Primary source | Pipeline below. `source: ai-draft` until a human approves. |
| **Your own questions** from your notes/courses | ✅ | Write in the Markdown format ([doc 04](04-content-format.md)). `source: own`. |
| **AWS official free sample/practice question set** (Skill Builder) | ⚠️ Study with it, don't copy it in | It's the best calibration for real style/difficulty. Take it in Skill Builder, then note which *objectives* you missed and draft your own questions on them. AWS content is copyrighted; I haven't read its terms for reuse. |
| **Purchased third-party banks** (Tutorials Dojo, Udemy, etc.) | ⚠️ Only if the license allows personal import | Most licenses forbid copying/redistribution into other tools. Check the terms; if unclear, don't import. I will not build scrapers for third-party question sites. |
| **Exam dumps / "real exam questions" / recalled questions** | ❌ Never | Violates the AWS candidate agreement; can lead to revoked certification; often wrong. |
| **Openly licensed material** (explicitly CC/MIT-style licensed banks) | ✅ | Record license + URL in `refs`; `source: licensed`. |

"Pull other practice questions" in practice means: *import what you're licensed to use*, using the same JSON/Markdown format so everything shares one validation and review path.

## 2. Workflow

```
Blueprint (19 objectives) ──► Drafting batch (LLM) ──► Lint CLI ──► Review queue (app) ──► Approved pool
        ▲                          │ grounded in: AWS docs URLs,        │ approve / edit / reject        │
        │                          │ in-scope service list              ▼                                ▼
   coverage dashboard ◄────────────┴──────────── rejected log (feeds prompt fixes)         practice + mock exams
```

1. **Pick a target** from the coverage dashboard (objective with fewest approved questions relative to weight).
2. **Draft a batch** (10–20 questions for one objective) as an import JSON with `source: "ai-draft"`, `reviewStatus: "draft"`, `refs` (AWS doc URLs the answer is based on), `generator` (model id), and `generatedAt`. Template in §4.
3. **Independent verification pass:** a *second, separate* prompt receives only stem + options (no key) and answers; disagreements with the drafted key are flagged `needsAttention`. This catches some wrong keys. Research found factual or conceptual errors in about 22% of LLM-generated practice questions in one medical study (see [research §8](00-research.md)), so it reduces risk but does not replace your review.
4. **Lint CLI** (`npm run content:lint`) rejects/warns on structural problems (§5) before import.
5. **Import** → items land as drafts, **excluded from practice, mock exams, and progress stats** until approved.
6. **Human review** in the queue: read the stem *without* looking at the key, answer it, then compare. Approve, edit, or reject (with a reason tag: wrong key / ambiguous / out of scope / too easy / trivia / bad distractor). Check each against its `refs`.
7. **Approved** questions join the pool. Rejection reasons feed back into the drafting prompt.
8. **Freshness:** AWS renames/changes services. Each question stores `lastVerified`; a Phase-3 job flags anything older than 12 months or when the guide version changes.

## 3. CLF-C02 style guide for questions

Derived from the official guide's wording (verbs are "identify / recognize / describe / understand / choose", not configure or troubleshoot):

- **Level:** recognition and matching a *need* to a *service or concept* — "which service…", "which is the customer's responsibility…", "most cost-effective purchasing option…". Out-of-scope job tasks (coding, architecture design, troubleshooting, implementation, load testing) → no CLI syntax, no config steps, no deep architecture trade-offs.
- **Formats:** `single` = 4 options, 1 correct, 3 plausible distractors. `multi` = 5+ options, 2+ correct, and the stem states exactly how many to choose ("Choose TWO"). Roughly 85–90% single / 10–15% multi (AWS doesn't publish the mix — treat as a guess; adjust after taking AWS's official sample set).
- **Stems:** one problem, short scenario (1–3 sentences) when it helps; positively phrased; avoid "NOT/EXCEPT" unless the format demands it.
- **Distractors:** real, *in-scope* AWS services/concepts that a half-informed candidate might choose (check [in-scope-services.md](../content/clf-c02/in-scope-services.md)); never joke options, "all/none of the above", or absolute words as the only tell. Similar-sounding pairs are good (Shield vs WAF, Inspector vs GuardDuty, Artifact vs Audit Manager).
- **Rationales:** every option gets one — why it's right, or *what it actually is* if wrong. That's where the learning is.
- **Stable facts only:** avoid prices, quotas, and version numbers that change. Where the objective needs them (S3 storage classes, support plan tiers), cite the doc in `refs` and set `lastVerified`.
- **Tag with the objective** (`"objective": "2.3"`) and relevant services (`tags: ["iam", "mfa"]`).

## 4. Drafting prompt template

> You are writing original practice questions for the AWS Certified Cloud Practitioner (CLF-C02) exam.
> **Objective:** {code} — {title}. **Knowledge/skills (from the official guide):** {bullets}.
> **Write {N} questions**: ~{N×0.85} single-answer (4 options, 1 correct) and the rest multiple-response (5–6 options, state "Choose TWO/THREE").
> **Rules:** Use only in-scope services (list provided). Test recognition/identification, not configuration or troubleshooting. Do not recall or imitate any real exam question. Each question needs: stem, options with a one-sentence rationale each, a short explanation, difficulty 1–5, tags, and `refs` = official AWS documentation URLs supporting the correct answer. If you aren't sure of a fact, don't write the question. Vary which option position is correct.
> **Output:** JSON conforming to content format v1 with `source: "ai-draft"`, `reviewStatus: "draft"`, `generator`, `generatedAt`.
> Inputs attached: blueprint objective text, in-scope service list, the style guide (§3), 2 example questions I wrote.

Notes: provide 2–3 human-written exemplars per objective (few-shot) for tone; run batches per objective, not "write 200 questions"; ask for *distinct sub-topics* inside the objective to avoid near-duplicates (lint also checks).

## 5. Lint rules (`content:lint`)

Errors: key count ≠ 1 for `single`; `multi` with <2 correct or <5 options; `single` without exactly 4 options (CLF-C02 profile); missing rationale; missing `refs` for `ai-draft`; objective not in blueprint; service named that is on the out-of-scope list; option text duplicated within a question. Warnings: correct-answer position imbalance in a batch (>50% same index); longest option is correct in >60% of items (classic tell); stem contains "all of the above"/"none of the above"; absolute words ("always", "never") in options; near-duplicate of an existing question (normalized stem similarity); `lastVerified` missing.

## 6. Coverage targets for the starter bank

Aim for **~260 approved questions (4× one exam)** distributed by weight so mocks can sample without repeats:

| Domain | Weight | Target Qs | Objectives (≈ per objective) |
|---|---|---|---|
| 1 Cloud Concepts | 24% | 62 | 1.1–1.4 (≈15 each) |
| 2 Security and Compliance | 30% | 78 | 2.1–2.4 (≈20 each; 2.1 shared responsibility and 2.3 IAM deserve extra) |
| 3 Cloud Technology and Services | 34% | 88 | 3.1–3.8 (≈11 each; 3.3 compute, 3.6 storage, 3.5 network bigger) |
| 4 Billing, Pricing, and Support | 12% | 31 | 4.1–4.3 (≈10 each) |

Minimum to start using mocks meaningfully: ~130 approved (2× exam). Minimum to start practice drills: ~10 per objective.

## 7. App changes this adds to the MVP

- `reviewStatus` (`draft` | `approved` | `rejected`) with reject-reason tags; drafts excluded from sessions and stats.
- Review queue screen (approve/edit/reject, keyboard-driven, blind-answer-first mode).
- Exam pack loader that reads `content/<code>/blueprint.json` (objectives are first-class).
- `content:lint` CLI sharing the importer's schema.
- Content coverage view (approved count vs target per objective).

Tickets: T-011, T-021, T-025, T-028, T-029, T-030, T-031, T-079 in [05-backlog.md](05-backlog.md). In-app generation and the AI tutor come later (F17), reusing this same prompt/lint/review path.

## 8. Calibration against the real exam

- Take the **AWS official free practice question set** early and note your score and the *feel* (length, wording, difficulty). Adjust style-guide §3 and difficulty tags accordingly.
- Track your results on AI-drafted vs. any other-source questions separately; a big gap suggests the drafts are easier/harder than the real thing.
- Real passing is a **scaled** 700/1000 with an unpublished raw equivalent; the app's `passMarkPct` is only a proxy. Your own **readiness target (default 80%, per exam)** is what the dashboard and map measure against; use trends across all four domains rather than one number.
