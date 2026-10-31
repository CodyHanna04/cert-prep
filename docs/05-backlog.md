# 05 — Backlog

> **Build status (2026-10-31):** most of Slices 1-3 and the admin tickets T-084 to T-086 are built. Per-ticket status is in [13-build-status.md](13-build-status.md). Tickets not built: T-012, T-013, T-027, T-045, T-047, T-053, T-076, T-078, T-079 (dedicated view), T-081 (browser e2e), and the nginx/backup/hardening parts of T-082 and T-083.

Re-baselined 2026-10-31 for a **personal, non-public tool**. Changes from the first draft: dependencies re-checked (no ticket depends on a later slice), merged overlapping tickets, dropped public-product polish, no time estimates. Sizes are relative only: **S** small, **M** medium, **L** large (split if it grows). The stack is decided ([09-stack-options.md](09-stack-options.md)): Next.js + Postgres (row-level security) + Better Auth on the homelab; the auth and isolation design is in [11-auth-and-tenancy.md](11-auth-and-tenancy.md).

**Order of work.** Slices are ordered so each one leaves something usable. Pure-logic tickets (marked ◇) have no I/O and can be built in parallel with the foundation work.

## Slice 1 — Study loop (import → review drafts → practice → results)

| ID | Ticket | Acceptance criteria | Size | Deps |
|---|---|---|---|---|
| T-001 | Scaffold Next.js app | Next.js (App Router) in JavaScript (ES modules), ESLint + Prettier, Vitest, Zod, Tailwind CSS v4; package name `certprep`; `dev`, `test`, `build` work; env handling; a design-token CSS-variable file with light/dark sets ([doc 12](12-design-direction.md); no visual design yet). | M | — |
| T-003 | Postgres + Docker Compose | `docker compose up` runs the app and Postgres locally and on the homelab; the DB is not published outside the compose network; migration runner; separate owner (migrations) and app (runtime) roles. | M | T-001 |
| T-002 | App shell & routes | Global bar and routes from the [sitemap](10-flows-and-structure.md) incl. placeholder pages for Study material and Flashcards; exam switcher stub; dark mode via system setting. | M | T-001 |
| T-004 | Schema & migrations | Tables per [architecture §2](02-architecture.md); **every user-owned table has `user_id`**; migrations include RLS policies and indexes per [doc 11 §3](11-auth-and-tenancy.md). | M | T-003 |
| T-005 | Server-only data layer | `withUser(userId, fn)` transaction helper that sets the RLS context; plain parameterized SQL functions (Zod-validated inputs and outputs) for Exam, Question, Session, Response, Note, Flag; the DB client cannot be imported outside this module (lint rule). | M | T-004 |
| T-006 | Authentication (start with a spike) | **Spike first:** Better Auth + `@better-auth/passkey` from plain JavaScript with a `pg` Pool; passkey-first user without an email; where rpID/origin are set; database-backed rate limits (record results in [doc 11 §7](11-auth-and-tenancy.md); fall back to SimpleWebAuthn if it fails). **Then build:** passkeys only (`residentKey` and `userVerification` required; rpID `study.codycodez.com` from env), invite-only registration via a signed single-use expiring token in `registration.context`/`resolveUser`, first-account token from a server CLI, explicit cookie attributes and `trustedOrigins`, database-backed rate limits, sign-out everywhere, `requireUser()` helper, `auth` schema + `auth_app` role. | L | T-001, T-003 |
| T-007 | Auth UI & account page | Sign-in page (passkey button + conditional-UI autofill), invite acceptance and passkey enrollment, prompt to add a second passkey, my-passkeys list (add/rename/remove), session/device list, theme preference. | M | T-006, T-002 |
| T-008 | Isolation test suite (CI gate) | Two-user tests per [doc 11 §5](11-auth-and-tenancy.md) against real Postgres: cross-read/write denied on every user-owned table, fail-closed with no context, pooled-connection leak test, build fails if a user table lacks RLS. | M | T-005, T-006 |
| T-009 | Theme system | Primitive + semantic token layers exposed to Tailwind v4 via `@theme` with its default palette removed; theme = one CSS file under `[data-theme]` (light/dark); theme picker in the Account menu stored per user; `?theme=` in dev; two stub themes prove swapping; lint/grep check bans raw colors and px font sizes in component styles ([doc 12 §3](12-design-direction.md)). | M | T-002, T-005, T-006 |
| T-014 | Dev-only password login | Enabled only when `NODE_ENV !== "production"`, `ALLOW_DEV_PASSWORD_LOGIN=true` and host is `localhost`; password paths added to `disabledPaths` otherwise; server **refuses to boot** in production if the flag is present; seed script for dev accounts refuses to run against the production DB; test builds the production config and asserts the endpoints are off ([doc 11 §2.4](11-auth-and-tenancy.md)). | S | T-006 |
| T-010 | Exam CRUD & switcher | Create/edit/archive exam (name, vendor, code, pass-mark proxy, **readiness target default 80%**, time limit, question count, exam date); active exam persisted; all lists scoped to it. | M | T-005, T-006, T-002 |
| T-011 | Exam pack loader | Load `content/<code>/blueprint.json` → exam, domains, objectives (with `scope`), sources; idempotent; shows source, version, retrieved date; diff when a pack with the same code already exists. | M | T-010, T-020 |
| T-012 | Domain/objective editor | Edit names, weights (running total vs 100), add/remove objectives; empty-state guidance. | S | T-011 |
| T-015 | Pack tooling | `npm run pack:validate` wraps the existing `scripts/validate-pack.mjs` and runs in CI over every `content/*/blueprint.json` (the template is checked with `--allow-template`); `npm run pack:new -- <code>` copies `content/_template/` to `content/<code>/`. Process: [doc 08](08-exam-pack-onboarding.md). | S | T-001 |
| T-020 ◇ | Content schemas & hash | Zod schemas for [content format v1](04-content-format.md) incl. objectives, review status, provenance; content hash; unit tests per rule. | M | — |
| T-021 ◇ | Import pipeline (pure) | `parseAndValidate(file) → {valid, errors, warnings, stats}`; no storage writes; golden-file tests; exam **profile** rules (CLF-C02: 4 options/1 correct; 5+ options/2+ correct). | L | T-020 |
| T-022 | Import UI | Choose file → preview (counts, errors, warnings, near-dupes, domain/objective mapping) → confirm. Reminder text: only import content you have the right to use. | M | T-021, T-011 |
| T-023 | Import commit | All-or-nothing write; skip/update/keep-both on duplicate; test with simulated failure mid-write. | M | T-022, T-005 |
| T-026 | Safe markdown renderer | Markdown with code blocks, sanitized (no raw HTML); script-injection fixture passes. | S | T-001 |
| T-030 | Review status & provenance | `reviewStatus` (draft/approved/rejected + reject reason), `source`, `generator`, `refs`, `lastVerified`; drafts excluded from selection, sessions and stats (tested). | M | T-004, T-020 |
| T-040 ◇ | Scoring (pure) | Single/true-false/multi (all-or-nothing, optional partial) with truth-table tests. | S | — |
| T-041 ◇ | Question selection (pure) | Filters (exam/domain/objective/flagged/unseen/missed), orders (random/unseen-first/missed-first/weakest-weighted), seeded RNG; excludes non-approved. | M | T-020 |
| T-042 | Session service | Create/resume/complete/abandon; every answer persisted immediately; one open session per exam; refresh-resume tested. | L | T-005, T-040 |
| T-043 | Practice setup screen | Scope (exam/domain/objective/flagged/missed/unseen), count, order; live pool size; clear reason when empty. | M | T-041, T-042 |
| T-044 | Question view | Single/multi inputs, markdown stem, submit → instant feedback with per-option rationale, next; correct/incorrect not color-only. | L | T-026, T-042 |
| T-031 | Draft review queue | Blind-answer-first screen, then reveal key/rationales/refs; approve / edit / reject-with-reason; queue grouped by objective; keyboard-driven; no batch-approve. | L | T-030, T-044, T-025 |
| T-025 | Question editor | Create/edit with markdown preview, options with rationales, correct marking, per-type validation, updates content hash. | L | T-005, T-026 |
| T-050 | Results summary | Score, time, per-domain/objective breakdown for a practice session. | M | T-044 |
| T-051 | Answer review | Your answer vs correct, explanation, rationales; filters (incorrect/flagged/unanswered). | M | T-050 |
| T-028 ◇ | Content lint CLI | Reuses T-021 rules plus [doc 07 §5](07-ai-content-pipeline.md); non-zero exit on errors; fixtures per rule. | M | T-021 |
| T-029 | Draft prompt kit | `content/prompts/`: drafting + independent-verification prompts, hand-written exemplars, README. | S | T-028 |

*Slice 1 is done when:* you can load CLF-C02, import a draft file, approve questions, run a practice session scoped to an objective, and see results.

## Slice 2 — Know where you stand (dashboards, map, what's left)

| ID | Ticket | Acceptance criteria | Size | Deps |
|---|---|---|---|---|
| T-048 | Derived question stats | Attempts, correct, last seen/result per question, updated with each response; `rebuild()` from raw responses with an equality test. | M | T-042 |
| T-070 ◇ | Progress calculations (pure) | Coverage, accuracy (latest 3 attempts), sample, status per objective, roll-up to domain, "what's left" sort — exactly as [doc 10 §3](10-flows-and-structure.md); fixture tests with hand-computed values. | M | — |
| T-071 ◇ | Readiness (pure) | Weighted domain accuracy vs per-exam target (default 80%); "not enough data" rule; unit tests. | S | T-070 |
| T-072 | Today dashboard | Widgets per [doc 10 §4](10-flows-and-structure.md): readiness, what's left, next action, weakest 5, activity, mock trend (empty until Slice 3), recent sessions. | L | T-071, T-048, T-043, T-011 |
| T-073 | Blueprint map | Treemap (area ∝ weight), objective tiles colored by status, Map/List toggle, metric switch, filters. | L | T-070, T-011 |
| T-074 | Objective detail | Overview, Questions, Mistakes, **Study material placeholder** tabs; *Practice this objective*, *Add questions* actions. | M | T-073, T-043 |
| T-075 | What's-left checklist | Grouped by domain with status chips and *Practice* buttons; action rows (drafts to review, no mock yet, no-question objectives). | M | T-070, T-043 |
| T-077 | History | Session list and session detail (reuses answer review). | M | T-051 |
| T-079 | Content coverage view | Approved / draft / target count per objective (targets from [doc 07 §6](07-ai-content-pipeline.md), editable); links to the draft prompt for a short objective. | M | T-070, T-030 |
| T-013 | Theme lab & design notes | `/dev/theme-lab` renders the component sheet (buttons, cards, chips, table, question view, sample treemap, dashboard widgets) with real objective names under any theme; split-screen compare; phone-width toggle; dev builds and owner only. `docs/design-notes/` template ready. | M | T-009, T-073 |

## Slice 3 — Exam rehearsal

| ID | Ticket | Acceptance criteria | Size | Deps |
|---|---|---|---|---|
| T-060 ◇ | Stratified sampler (pure) | Largest-remainder allocation matching domain weights summing exactly to N; small-pool handling; property tests. | M | T-041 |
| T-061 | Mock runner | Pack-driven count/time; countdown derived from `startedAt` (survives refresh/sleep); navigator (answered/unanswered/flagged); no feedback until end. | L | T-044, T-060, T-042 |
| T-062 | Submit flow & mock results | Review-before-submit, auto-submit at zero, results vs readiness target and pass-mark proxy, per-domain breakdown; feeds the mock-trend widget. | M | T-061, T-050 |

## Slice 4 — Everything else (any order after Slice 1)

| ID | Ticket | Acceptance criteria | Size | Deps |
|---|---|---|---|---|
| T-024 | Question list & filters | Search; filter by domain/objective/tag/type/status/source/flagged. | M | T-005 |
| T-027 | Export approved questions | Writes the content-format JSON for git versioning. | S | T-005 |
| T-045 | Confidence chip | Guess/unsure/sure stored on responses; setting to hide. | S | T-044 |
| T-046 | Flag, bookmark & note | Toggles in session and lists; one markdown note per question; flagged filter in setup. | M | T-044 |
| T-047 | Keyboard shortcuts | 1–9, Enter, F, N; cheat-sheet. | S | T-044 |
| T-052 | Retry missed | New session from a session's misses. | S | T-051 |
| T-053 | Mistakes & flagged lists | Library view of missed/flagged questions with filters. | M | T-046, T-048 |
| T-076 | Trends | Accuracy by domain over time; time-per-question distribution. | M | T-070 |
| T-078 | Question history | Every attempt on a question. | S | T-048 |
| T-080 | Per-user export/import & account deletion | One JSON file with *your* data; import replaces after confirmation; "delete my account" removes every row you own. **No versioning, migration, checksum or reminders** (deliberately). | M | T-005 |
| T-081 | Golden-path e2e test | Load pack → import → approve → practice → results → map/dashboard shows the right numbers. | M | Slice 1–2 |
| T-082 | Homelab deploy | Compose file: public app container + Postgres on internal networks (DB not published, no route to your other services); env/secret docs; **nginx server block** for `study.codycodez.com` per the checklist in [doc 09](09-stack-options.md) (HSTS, headers, body limit, rate limits, `X-Forwarded-For` overwrite, `/admin` 404); Namecheap `A` record; certificate setup; scheduled `pg_dump` to another disk; restore tried once. | M | T-003, T-006 |
| T-090 | Study material & flashcards placeholders | Reserved nullable `studyNotes` on Objective; empty-state pages; nothing else. | S | T-002, T-074 |
| T-083 | **Before sharing:** public exposure hardening | `study.codycodez.com` set as the passkey rpID/origin before any real enrollment; only 443 (and 80 if needed) forwarded; the app's network isolated from your other services; security headers incl. CSP and HSTS; trusted-proxy client-IP handling so rate limits can't be spoofed; every item in the [doc 11 §6](11-auth-and-tenancy.md) checklist ticked; required before any other user is invited. | M | T-082, T-008 |
| T-084 | **Admin site: mode switch and Tailscale deployment** | `APP_MODE` is `web` or `admin`: in web mode every `/admin*` path returns 404 and no `admin_app` credentials are present; second compose service from the same image in admin mode behind a Tailscale sidecar with `tailscale serve` (tailnet-only HTTPS, Funnel off); identity-header allowlist (`ADMIN_TAILSCALE_LOGINS`): missing or non-allowlisted login rejected; `admin_app` DB role; tests for all of this ([doc 11 §2.6](11-auth-and-tenancy.md)). | M | T-003, T-006 |
| T-085 | **Admin site: users, invites, passkey reset** | Users list (no study data); create/revoke single-use expiring invite tokens stored hashed in `auth.invite_token` and verified by the public app; *Reset passkeys* (revoke passkeys and sessions, issue a re-enrollment link shown once), *add a passkey link*, revoke sessions, disable/enable, delete with typed confirmation (FK cascade under RLS verified and added to the isolation suite). | L | T-084, T-007 |
| T-086 | **Admin site: audit log and break-glass CLI** | Append-only audit log of every admin action (records the Tailscale login) shown in the site; a server CLI that issues the first account's token and recovers from admin lockout. | S | T-085 |

## Later (broken down when you start them)

- **Flashcards with spaced repetition (FSRS)** and leech handling — first after the core slices.
- **Study material** (per-objective notes, AI-drafted and sourced, linked to flashcards) — placeholder only now.
- **Mistake notebook with "why I missed it" tags.**
- **Study plan** from exam date and hours/week; study-time tracker/heatmap.
- **Account extras:** invite management UI, device/session list polish, email-based recovery.
- **In-app AI drafting and tutor**, reusing the doc 07 prompt/lint/review path.
- **Markdown authoring format, bulk edit, ordering/matching/fill-in question types, Anki import, cross-exam concept tags.**

## Cut (not planned for a personal tool)

Open public sign-up, billing and legal pages · offline/PWA caching, local-first storage and sync (always online) · i18n framework · WCAG compliance program and axe-in-CI (keep sane keyboard use and contrast) · performance test harness with synthetic 500k responses · multi-tab exam guard · backup versioning/migrations/reminders · certification lifecycle (renewal/CEU) · question-quality reporting loop · PDF reports · preview-deploy pipeline.

## Definition of Done (lightweight)

Acceptance criteria met · pure logic has unit tests · lint clean, inputs validated with Zod · works on phone-width and with keyboard for session screens · docs updated if a contract (content format, data model, progress rules) changed.

## Dependency check (done 2026-10-31)

Every ticket's dependencies are in the same or an earlier slice. T-025 (question editor) sits in Slice 1 because the draft review queue (T-031) needs it; the question list (T-024) stays in Slice 4. Pure-logic tickets (◇) have no dependency on storage. The first draft of this backlog failed this check (its "quick study" slice depended on the mock runner and on editors that were not in it); this version was re-checked ticket by ticket.
