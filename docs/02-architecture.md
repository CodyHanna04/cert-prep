# 02 — Architecture

Stack (decided 2026-10-31, see [09-stack-options.md](09-stack-options.md)): **Next.js (JavaScript) + PostgreSQL on the homelab (Docker) with row-level security and plain SQL, Better Auth with passkeys for sign-in.** Runtime validation with Zod stands in for static types. Always-online and multi-user with strict per-user isolation ([11-auth-and-tenancy.md](11-auth-and-tenancy.md)). The **server database is the single source of truth**: no local-first storage, sync or offline layer. Scope otherwise stays small: a non-public tool.

## 1. Structure

```
UI (screens from doc 10)
   │
App logic (hooks / handlers per feature)
   │
Domain logic — pure JavaScript, no I/O: scoring, selection, sampling, progress, readiness
   │
Server-only data layer  ← typed functions; each needs the session user and runs in a transaction that sets the RLS context
```

- **Domain logic never imports storage or UI.** It's where the correctness lives (progress status, readiness, stratified sampling) and the easiest thing to unit-test. It can be built before the stack is chosen.
- **UI and route handlers never touch the database client directly**, only the server-only data layer (enforced by a lint/import rule). That layer is where per-user isolation lives; see [doc 11](11-auth-and-tenancy.md). Don't add extra layers (adapters, sync engines).
- All exam-specific behavior comes from the **exam pack** (data): format, profile rules, domains/weights, objectives, readiness target. No code branches on an exam code ([doc 08](08-exam-pack-onboarding.md)).

## 2. Data model

IDs are UUIDs/ULIDs generated server-side. All records have `createdAt`/`updatedAt`. **Every user-owned table also has `userId` (NOT NULL)**, including child tables (domains, objectives, questions, sessions, responses…), so row-level-security policies can check one column. The users, sessions and passkeys tables belong to Better Auth and live in a separate `auth` schema with their own database role; app `user_id` columns reference `auth.user(id)` ([doc 11 §3](11-auth-and-tenancy.md)).

**Content (editable)**
- **Exam:** `id, code, name, vendor, passMarkPct (proxy), passMarkNote, readinessTargetPct (default 80), timeLimitMin, questionCount, examDate?, profile (question-type rules), sources[], archived`
- **Domain:** `id, examId, key, name, weightPct, order`
- **Objective:** `id, domainId, code, title, scope[] (condensed vendor bullets), studyNotes? (reserved, null for now)`
- **Question:** `id, examId, domainId, objectiveId, type (single|multi|tf), stem (markdown), options[{id,text,isCorrect,rationale}], explanation, difficulty?, tags[], source (own|ai-draft|licensed|imported), reviewStatus (draft|approved|rejected), rejectReason?, generator?, generatedAt?, lastVerified?, refs[], contentHash`
- **Note / Flag:** `id, questionId, body | kind (flag|bookmark)`

**History (append-only; the source of truth for progress)**
- **Session:** `id, examId, mode (practice|mock), config, startedAt, endedAt?, status (in-progress|completed|abandoned), timeLimitSec?`
- **Response:** `id, sessionId, questionId, selectedOptionIds[], isCorrect, timeMs, confidence?, flagged, answeredAt`

**Derived (rebuildable, never authoritative)**
- **QuestionStats:** attempts, correct, lastSeenAt, lastResult, recent results (last 3). Recomputed from Responses by a `rebuild()` that's tested against the incremental updates.

Editing a question's wording keeps its history. Changing its correct answer changes `contentHash`; the history stays but flags a mismatch so you can decide whether to discount older answers.

## 3. Core logic (all pure functions)

**Scoring.** Single/true-false: correct iff the selected option is the correct one. Multi: all-or-nothing by default, optional partial credit (`correct picks − wrong picks`, floor 0). Mock result is raw % against the pack's pass-mark proxy *and* the exam's readiness target; vendor scaled scores can't be derived, so none are shown.

**Progress** (per exam; definitions are in [doc 10 §3](10-flows-and-structure.md), summarized here): pool = approved questions only; coverage = distinct pool questions answered ÷ pool; accuracy = correct share over each question's latest 3 attempts; sample = pool questions with ≥ 1 attempt; per-objective status ∈ {No questions, Not started, In progress, Needs work, On target}; roll up to domain with the same rules; "what's left" = objectives not On target sorted by weight × gap.

**Readiness.** `Σ domainWeight × domainAccuracy`, only when every domain has sample ≥ 10, otherwise "not enough data" with what's missing. Compared to `readinessTargetPct`. This is a transparent weighted average, not a statistical model; the earlier draft's Bayesian interval was over-built for a personal tool and has been dropped. Thresholds (80% coverage, sample ≥ 5, last 3 attempts) are starting values in settings.

**Selection (practice).** Filter the approved pool by scope; order random / unseen-first / missed-first / weakest-weighted; seeded RNG for tests.

**Stratified sampling (mock).** Allocate `questionCount` across domains by weight with largest-remainder rounding so the total is exactly N; no repeats; prefer least-recently seen; if a domain pool is short, warn and redistribute.

## 4. Testing (kept light)

- Unit tests for every pure function above with hand-computed fixtures (the progress/readiness fixture is the most important one).
- Importer golden-file tests (valid, each error rule, a script-injection stem).
- One end-to-end golden path: load pack → import → approve → practice → results → map/dashboard numbers correct.
- No coverage targets, no performance harness, no accessibility program beyond keyboard-usable session screens and readable contrast.

## 5. Security (personal scale)

- Imported files are untrusted: validate with the schema before writing, render markdown through a sanitizer (no raw HTML), cap file size.
- Authentication, per-user isolation (RLS), the isolation test suite and the pre-exposure checklist are in [doc 11](11-auth-and-tenancy.md). Never hand-roll auth or crypto.
- AI API keys, when in-app AI arrives, never live in client code.

## 6. Explicitly not planned

Local-first storage, sync engines and offline caching (always online) · backup versioning and migrations · telemetry · i18n framework · public sign-up and public-product hardening.
