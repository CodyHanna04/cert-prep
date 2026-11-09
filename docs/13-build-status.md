# 13 — Build status (updated 2026-11-02)

What exists in the repository now, how to run it, what the build settled, and what is still open. Written after the first build pass; the planning docs (01–12) remain the source for intent.

## Revision 2 (after first review)

Changes made from the first round of feedback:

- **Courses replace the dropdown.** `/courses` is a catalog that presents each pack (weighting ring, stats, domain list, author-written blurb) with Start studying / Continue / Resume course. `/` is now a multi-course dashboard (a resume banner for every open session, a progress card per course, activity across courses, recent sessions). `/course` is the per-course overview. Course pages (overview, map, practice, mock, library, history, settings) share a course bar that names the current course and links to Courses. The current course is still a cookie, set by a button on a card rather than a form field that can drift.
- **The switching bug.** The old dropdown was uncontrolled and React reset it to the previous value after each switch, so choosing the exam it displayed fired no change event and you could not go back. Also: archived exams vanished with no way back, and re-adding one crashed the page. Archiving is now "Pause course" (Settings), paused courses appear on Courses with Resume course, and `enrollInPack` restores the same exam with its progress (tests in `tests/courses.test.js`).
- **History** has a score line chart (practice and mock markers, 3-session average, target line, mode filter) above the sessions table, which now has Resume and Review actions.
- **Dashboard activity bug fixed.** Days were grouped in UTC but labelled in local time, hiding evening answers. Days now use `APP_TIMEZONE` (default: the server's own time zone).
- **Visual pass:** wash and dot backdrop, shadowed cards, display-font titles with an accent rule, domain-weight rings, and new `accent-soft`, `glow` and `shadow` theme tokens.
- **Library stays in the app:** it is per user (rows carry `user_id` under RLS), so imports and edits never reach another account and the admin site cannot see them.

## Revision 3 (question bank tooling)

- **Lint CLI:** `npm run content:lint [-- paths] [--strict]` checks `content/<pack>/questions/**/*.json` against the pack blueprint: everything the importer checks, plus required stable ids across files, `profile.outOfScopeTerms` (services the guide lists as out of scope; new optional pack field), and doc 07 section 5 batch warnings (answer-position imbalance, longest-option-is-correct tell, absolute words, NOT/EXCEPT stems, `lastVerified` over a year old). Exit 1 on errors.
- **Blind verification:** `npm run content:blind -- <batch>` writes a copy with no key or rationales; a separate model answers it; `npm run content:check -- <batch> <answers> --write` flags disagreements with `needsAttention`. The tooling is built and tested. Running the check still needs a second session or a person: nothing in the app calls a model.
- **Prompt kit:** `content/prompts/draft-questions.md` and `verify-blind.md`, a README with the step-by-step flow, and `content/clf-c02/style.md`. DVA-C03 got its style file in Revision 7.
- **Coverage page** (Library, Coverage): approved, draft and target counts per objective with a default target of four exams' worth split by domain weight (then evenly by objective), practice-ready (10 or more approved) and mock-ready (2 exams' worth) indicators, and a Prompt page per objective that fills the drafting prompt with the objective's scope and the questions already in the bank.
- **Export approved** in Library (T-027).
- **Pilot batch:** `content/clf-c02/questions/2.1-2026-11-01.json`, 10 draft questions for objective 2.1 (shared responsibility), grounded in three AWS pages named in each question's `refs`. Lint: 0 errors, 0 warnings. Not yet blind-checked, imported or human-reviewed.
- **Fix:** `.gitignore` and `.dockerignore` listed `coverage`, which also matched the new `library/coverage` route folder (git would have skipped it and Tailwind did not scan it). Both are now anchored to the repo root.
- Exams already added to a database keep the profile they were created with, so an existing exam row does not get `outOfScopeTerms`; the lint CLI reads the blueprint and always applies it.

## Revision 4 (shared bank, homelab, study screens) — 2026-11-02

- **Shared baseline bank.** Approved questions in `content/<pack>/bank/*.json` are copied into every learner's own exam (still per-user rows under RLS, so isolation is unchanged). Each exam records the bank version it last synced (`exam.bank_version`, a hash of the files); `getAppContext` re-syncs when a deploy changes the bank. Matching is by question `id`, or by identical content for a copy the learner imported earlier. Bank rows (`question.from_bank`) are approved and read-only in the app; questions dropped from the bank are rejected with "Retired from the shared question bank", so answer history stays. A learner's own imports never leave their account. `content:lint` now also checks `bank/` and rejects anything there that is not approved. Tests: `tests/bank.test.js`.
- **First bank content:** the 10-question pilot for objective 2.1 (`content/clf-c02/bank/2.1-shared-responsibility.json`). Blind check: 10 of 10 matched the key. Every claim was checked against the three AWS pages in `refs`. Three edits were made in review: #08 no longer says "abstracted" in the right option (it hinted at the answer), #10's correct-option rationale now explains why, and #07's IAM rationale cites the RDS page.
- **Homelab production is running** on Proxmox CT 104 (Debian 13, 2 cores, 4 GB, 40 GB on Ceph RBD) at `192.168.86.227`. It has key-only SSH (`deploy` user), unattended upgrades, Docker 29 and Compose v5. The `web` container is published only on `192.168.86.227:3000`, and Postgres is not published. `.env` was generated on the box (mode 600). `scripts/deploy.sh` pulls, builds (including the `tools` profile, so migrations ship), migrates, restarts and checks `/sign-in`. Migrations 0001–0005 are applied. nginx, DNS, certificates and the first account are still to do.
- **Study screens:**
  - **Keyboard shortcuts** in practice and mock (T-047): 1–9, Enter, ← →, F, B, N, `?`.
  - **Bookmarks** (T-046).
  - **Confidence chip** (T-045): guess, unsure or sure, stored on `response.confidence`, with a setting on the Account page.
  - **Time** is counted only while the tab is visible; mock answers now record it too.
  - **Session results:** a Time card (average, median, slowest, total) and answer-review filters (all, incorrect, flagged, unanswered, slow, guessed).
  - **Library → Mistakes & flagged** (T-053): last missed, correct guesses, flagged and bookmarked, with an objective filter and Practice buttons.
  - **Question history** (T-078): an attempts table on each question page.
  - **Library filters** for type, origin (shared bank or mine) and flagged (T-024).
- **Theme saved with the account** (T-009): `app.user_pref` (theme, show_confidence) under RLS. The cookie remains a cache, and a new device falls back to the saved theme.
- **CI:** `.github/workflows/ci.yml` runs lint, `pack:validate`, `content:lint` and the tests against Postgres 17 on every push.
- 139 tests pass (12 files).

## Revision 5 (question bank, 2026-11-02)

- **184 new CLF-C02 questions**, 10 or more for each of the 18 objectives that had none, so the bank is now 194 (19 multiple-response). They were drafted in a compact form and expanded to the content format with the correct option's position rotated. Lint gives 0 errors and 0 warnings.
- **Checked before publishing:**
  - **Blind answers:** a separate agent answered all 184 without the key and agreed on every one. Its file had one letter mistyped for a question where its written reasoning chose the keyed option.
  - **Source checks:** four agents, one per domain, fetched every cited AWS page. No key was wrong. They found stale pages (marketing pages that changed or redirected, and whitepapers that are now empty shells), so refs moved to the docs pages that state the fact.
  - **Outdated facts found and fixed:**
    - AWS Audit Manager closed to new customers on 2026-04-30, so its question was replaced.
    - Two Well-Architected principle names changed ("Maintain traceability", and "Safely automate where possible" for operational excellence).
    - Amazon SageMaker is now "SageMaker AI" and AppStream 2.0 is now "WorkSpaces Applications". The explanations name both, since the exam guide uses the old names.
    - Amazon Kendra is closed to new customers. It is kept because the guide lists it.
    - **Support plans were restructured:** Basic, Business Support+, Enterprise Support and Unified Operations. Developer, Business and Enterprise On-Ramp end on 2027-01-01. Support questions now have answers that are correct under both the current plans and the guide's names. The "lowest-cost plan with 24/7 access" question was replaced, because its answer differs between the two.
- `scripts/deploy.sh` no longer deletes the tracked `docker-compose.override.yml`. Every command names `docker-compose.yml` explicitly, so the override was never loaded anyway.

## Revision 6 (audit and second content batch, 2026-11-02)

- **Site audit:** findings and backlog are in [16-site-audit.md](16-site-audit.md). Fixed in this pass:
  - Form controls lost their border when a page passed a `className` (the Library search box). Controls now merge classes and have focus rings.
  - "Flagged only" is now a `CheckChip`.
  - Library tabs show the current tab.
  - The file pickers, account radios and checkboxes are styled.
  - Practice setup shows question counts per scope and disables empty scopes.
  - Course cards show the shared bank's size next to the exam's length.
  - There is a themed 404 page.
- **81 more CLF-C02 questions**, bringing the bank to 275. Most went to domain 2, plus extras across domain 3. The blind check agreed on 81 of 81. The source checks found no wrong keys, but did find:
  - **Renamed:** AWS Application Migration Service is now AWS Transform MGN.
  - **Closed to new customers:** AWS Application Discovery Service, and the AMS Advanced model (AMS Accelerate continues).
  - **Changed guidance:** Parameter Store's docs now steer secrets to Secrets Manager.
  - **Weak citations:** several, now replaced with docs pages.

  Explanations name both old and new names wherever the exam guide still uses the old one.

## Revision 7 (question quality and DVA-C03 bank, 2026-11-08)

- **Quality review:** the learner found CLF-C02 questions too hard, wrong or more up to date than the exam. The cause and the new rules are in [17-question-quality-review.md](17-question-quality-review.md): the exam guide sets names, scope and depth. The rules are now in `content/prompts/draft-questions.md` and the review step of the prompt README. (The diagnosis was refined in Revision 8.)
- **DVA-C03:**
  - The pack now has `style.md`, calibrated against AWS's official sample questions.
  - Its blueprint has a lint profile, including the guide's out-of-scope services.
  - The guide now says registration opened on October 27, 2026.
- **123 DVA-C03 questions** are in the shared bank: 10 or 11 per objective (every objective is practice-ready), 17 of them multiple-response (style.md aims for about 25 percent, so later batches should add more).
  - The blind check agreed on 123 of 123.
  - The source checks found no wrong keys, but did find:
    - outdated rationales (ACM public certificates can now be exported; API Gateway integration timeouts can be raised; Lambda recommends ClaimedAccountConcurrency for account-limit alarms);
    - out-of-scope distractors (AWS Config, Trusted Advisor);
    - a CodeArtifact term ("external connection", not "upstream");
    - a Kiro detail (file hooks fire on the agent's edits);
    - weak refs.

    All are fixed.
  - The correct answer was the longest option in 74 of the first draft's single-answer questions. It is now 2 of 99.

## Revision 8 (both banks reviewed against the current guides, 2026-11-08)

- **CLF-C02 is on guide v1.3.** AWS revises the CLF-C02 guide in place (1.0 June 2026 to 1.3 on October 29, 2026). The pack had been built from an older PDF. Changed:
  - Rebuilt from the live HTML guide: blueprint sources and objective scopes, `in-scope-services.md`, `style.md`, and a lint profile covering the v1.3 out-of-scope list.
  - Corrected doc 17. Its first diagnosis said "use the old names"; the current guide uses the new ones.
  - Added a rule: check the guide's revisions page before every content pass.
- **CLF-C02 bank review:** five reviewers covered all 275 questions against v1.3.
  - Changes: 150 edited, 13 retired (out of scope), 20 added, giving 282 questions, 27 of them multiple-response.
  - Names and support plans: v1.3 names everywhere; support plans are now Basic, Business Support+, Enterprise and Unified Operations.
  - Out-of-scope services removed, as questions or as distractors: Billing Conductor, Activate, AMS, Wavelength, Local Zones, Kendra, MemoryDB, CodeDeploy, AppConfig, CloudShell, CodeArtifact, Greengrass, Network Firewall, Transfer Family, DataSync, Audit Manager.
  - Topics added to cover what the v1.3 task statements name: Amazon Quick, Amazon Q, DocumentDB, WorkSpaces Secure Browser, AppStream 2.0, CodeBuild, Inspector, the Health API, Unified Operations, and partners and the Marketplace.
  - Well-Architected questions moved from principle wording to pillar level.
  - Explanations now name the clue and the nearest distractor.
  - Weak or silly distractors replaced, and the longest-option giveaway removed.
- **DVA-C03 quality pass:** 53 questions edited, with clearer explanations, realistic distractors and balanced option lengths. 10 were converted to "(Select TWO.)", so 27 of 123 are now multiple-response.
- **Checks:**
  - Blind checks agreed with the key on all 170 changed CLF questions and all 53 changed DVA questions.
  - Lint passes with 0 errors and 0 warnings.
  - The 139 tests pass (run on the homelab LXC).

## Run it

```bash
docker compose up -d db          # Postgres on 127.0.0.1:5432 (first start creates the four roles and both databases)
cp .env.example .env             # already done on this machine
npm install
npm run db:migrate               # applies migrations/*.sql as the owner role
npm run db:seed-dev              # dev user dev@users.invalid / dev-password-123 with CLF-C02 and 5 sample questions
npm run dev                      # http://localhost:3000 (password form shown only here, on localhost)
npm test                         # 139 tests against the throwaway certprep_test database
npm run lint
npm run pack:validate
```

First real account (no public sign-up): `npm run user:create -- "Your Name"` prints a single-use enrollment link; open it, create a passkey, then add a second one on the Account page.

## Done (by ticket)

| Ticket | State | Notes |
|---|---|---|
| T-001 Scaffold | Done | Next.js 16 App Router, JavaScript, Tailwind v4, Zod, Vitest, ESLint flat config, Prettier |
| T-002 App shell | Done | Global bar (Dashboard, Courses), per-course bar, all sitemap routes, placeholder pages |
| T-003 Postgres + Compose | Done, image build verified separately | `docker-compose.yml`: db, migrate (one-off), web, optional Tailscale-fronted admin |
| T-004 Schema | Done | `migrations/0001–0003`; every app table has `user_id`, RLS enabled and forced |
| T-005 Data layer | Done | `lib/db/*`: `withUser()` is the only entry; lint rule bans `pg` and `with-user.js` imports in app code |
| T-006 Authentication | Done | Better Auth + `@better-auth/passkey` in plain JavaScript; see "Findings" |
| T-007 Auth UI | Done | Sign-in (button + conditional-UI autofill), join link, passkey list/add/rename/remove, devices/sessions |
| T-008 Isolation suite | Done | `tests/isolation.test.js` (16 tests): cross-read/write/insert/reassign, fail-closed, pooled-connection leak, role separation, schema guard, account-deletion cascade |
| T-009 Theme system | Mostly | Semantic tokens via `@theme inline`, default palette removed, two themes (Ledger, Control room), light/dark by system. Theme stored per user (`user_pref`), cookie as cache. No lint rule banning raw colors yet |
| T-010 Exams | Mostly | Courses catalog, start/continue/pause/resume, readiness target and exam date. No "create manually" |
| T-011 Pack loader | Done | Reads `content/*/blueprint.json` |
| T-014 Dev password login | Done | Flag lives in `.env.development`; guards and tests in `tests/auth.test.js` |
| T-015 Pack tooling | Done | `npm run pack:validate`, `npm run pack:new -- <code>` |
| T-022/T-023 Import | Done | Preview then commit; server re-validates; all-or-nothing; duplicates skipped; optional update by `id`; 2 MB / 2000-question caps |
| T-024 Question list & filters | Done | Search, status, objective, type, origin (shared bank / mine), flagged |
| T-025 Question editor | Edit only | Revalidates through the importer, including the exam profile. Shared-bank questions are read-only. No "new question" form |
| T-026 Safe markdown | Done | React-element renderer, https links only, no raw HTML |
| T-027 Export approved | Done | Library, Export approved: content-format JSON, round-trip tested |
| T-028 Content lint CLI | Done | `npm run content:lint` (see Revision 3) |
| T-029 Draft prompt kit | Done | `content/prompts/`: drafting and blind-verification prompts, README, per-pack `style.md` |
| T-079 Coverage view | Done | Library, Coverage: approved/draft/target per objective, prompt link per objective |
| T-030/T-031 Review gate and queue | Done | Drafts excluded from pool and stats; blind-answer review; reject needs a reason |
| T-042–T-044, T-050–T-052 Practice loop | Done | Setup, resumable runner with per-option rationales, results, answer review, retry missed |
| T-045 Confidence chip | Done | Guess / unsure / sure before checking; Account setting to hide; shown in review |
| T-046 Flag, bookmark and note | Done | F / B / N in the runner; lists on Mistakes & flagged |
| T-047 Keyboard shortcuts | Done | Practice and mock runners, `?` cheat-sheet |
| T-053 Mistakes & flagged | Done | Library tab: last missed, correct guesses, flagged, bookmarked |
| T-078 Question history | Done | Attempts table on the question page |
| T-061/T-062 Mock exam | Done | Stratified by weight (largest remainder), server-enforced deadline, navigator, review-before-submit, results vs target and pass-mark proxy |
| T-072–T-075 Today, map, objective detail, what's left | Done | Readiness, bank, activity, what's left, weakest 5, mock trend, treemap (map/list, accuracy/coverage/count, filters) |
| T-077 History | Done | Score line chart with mode filter, session table with Resume, results page |
| T-080 Export/import/delete | Done | Id-free JSON; import replaces all-or-nothing; delete requires typing your name |
| T-084–T-086 Admin site | Done in code, Tailscale part unverified | `APP_MODE=admin`: users, invite links, reset passkeys, sign out everywhere, delete, audit log; `proxy.js` makes the modes mutually exclusive; boot guards in `instrumentation.js` |
| T-090 Placeholders | Done | Study material and flashcards pages; `objective.study_notes` column |

## Not built yet

- T-012 domain/objective editor, T-013 theme lab and design notes, T-076 trends, "create exam manually", "new question" form, pack-reload diff (part of T-011).
- T-081 browser end-to-end test (the data-layer golden path is tested; the UI was exercised by hand).
- T-082 remainder: adapt and install `docker/nginx-study.conf.example` (untested draft), the Namecheap record, certificates, scheduled `pg_dump` and a restore drill. T-083 remainder: CSP with nonces, nginx rate limits, the pre-exposure checklist run-through.
- Content: the CLF-C02 shared bank has 282 approved questions (27 multiple-response) on guide v1.3, above the 260 coverage target; every objective is practice-ready. DVA-C03 has 123 approved questions (27 multiple-response, 10 or 11 per objective) toward its 260 target.

## Findings that changed the plan

1. **Better Auth works from plain JavaScript with no email.** Passkey-first onboarding uses `registration.requireSession: false`, `resolveUser`, and `context` = our invite token. The user row exists before the first passkey (placeholder email `<uuid>@users.invalid`, never used). The unverified item in doc 11 §7 is resolved.
2. **User verification is not enforced by the plugin.** It asks for `preferred` on sign-in and verifies with `requireUserVerification: false`. We enforce it ourselves in `afterVerification` for both registration and sign-in, and tests cover an authenticator that skips it.
3. **Token consumption is atomic.** `consumeToken` is a single `UPDATE ... WHERE used_at IS NULL`; two simultaneous enrollments with one link create exactly one passkey (tested).
4. **Rate limiting in Postgres works** (`storage: "database"`, table `auth."rateLimit"`); a hammered endpoint returns 429 (tested).
5. **The last passkey cannot be removed:** a `hooks.before` rule on `/passkey/delete-passkey`.
6. **Foreign-key cascades work under forced RLS.** Deleting `auth."user"` as `admin_app` (which cannot read app tables) removes every owned app row (tested). The doc 11 §7 "verify during build" item is resolved.
7. **`withUser` needs `set_config(..., true)` inside a transaction** and policies go through `app.current_user_id()` returning NULL when unset, so a missing context returns zero rows instead of raising an error.
8. **Next.js 16 differences:** `proxy.js` replaces `middleware.js`; `next lint` is gone (`eslint .` instead); `next build` loads `.env`, which is why the dev-login flag lives in `.env.development` and the production boot guard runs in `instrumentation.js` rather than at import time.
9. **Derived `QuestionStats` table dropped.** Accuracy and history are computed from `response` on read; at personal scale that is fast enough and removes the rebuild-vs-incremental consistency problem.

## Decisions made during the build

- Practice: the first answer to a question sticks (feedback is immediate). Mock: answers can change until submit; clearing an answer deletes the row so it counts as unanswered. Unanswered counts as incorrect in the score but is not recorded as a response in progress stats.
- Mock time is scaled when the approved bank is smaller than the real question count, so pace matches the real exam.
- Admin destructive actions use typed confirmation (D51), admin is the same codebase run twice (D52).
- Per-user isolation also covers `exam` rows: each user gets their own copy of an exam's domains and objectives when they add a pack.

## Still unverified

- Tailscale Serve identity headers through the sidecar with `network_mode: service:` and `TS_SERVE_CONFIG`; the compose file follows Tailscale's documented shape but was not run here.
- nginx rate-limit and header configuration on the homelab.
- Real passkeys in a real browser (tests use a software authenticator against the same endpoints; the browser UI for registering and signing in with a platform authenticator has not been exercised).
- Tailwind theme swap across a large number of components; only two themes exist.
