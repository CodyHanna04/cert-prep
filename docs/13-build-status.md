# 13 — Build status (2026-10-31)

What exists in the repository now, how to run it, what the build settled, and what is still open. Written after the first build pass; the planning docs (01–12) remain the source for intent.

## Revision 2 (after first review)

Changes made from the first round of feedback:

- **Courses replace the dropdown.** `/courses` is a catalog that presents each pack (weighting ring, stats, domain list, author-written blurb) with Start studying / Continue / Resume course. `/` is now a multi-course dashboard (a resume banner for every open session, a progress card per course, activity across courses, recent sessions). `/course` is the per-course overview. Course pages (overview, map, practice, mock, library, history, settings) share a course bar that names the current course and links to Courses. The current course is still a cookie, set by a button on a card rather than a form field that can drift.
- **The switching bug.** The old dropdown was uncontrolled and React reset it to the previous value after each switch, so choosing the exam it displayed fired no change event and you could not go back. Also: archived exams vanished with no way back, and re-adding one crashed the page. Archiving is now "Pause course" (Settings), paused courses appear on Courses with Resume course, and `enrollInPack` restores the same exam with its progress (tests in `tests/courses.test.js`).
- **History** has a score line chart (practice and mock markers, 3-session average, target line, mode filter) above the sessions table, which now has Resume and Review actions.
- **Dashboard activity bug fixed.** Days were grouped in UTC but labelled in local time, hiding evening answers. Days now use `APP_TIMEZONE` (default: the server's own time zone).
- **Visual pass:** wash and dot backdrop, shadowed cards, display-font titles with an accent rule, domain-weight rings, and new `accent-soft`, `glow` and `shadow` theme tokens.
- **Library stays in the app:** it is per user (rows carry `user_id` under RLS), so imports and edits never reach another account and the admin site cannot see them.

## Run it

```bash
docker compose up -d db          # Postgres on 127.0.0.1:5432 (first start creates the four roles and both databases)
cp .env.example .env             # already done on this machine
npm install
npm run db:migrate               # applies migrations/*.sql as the owner role
npm run db:seed-dev              # dev user dev@users.invalid / dev-password-123 with CLF-C02 and 5 sample questions
npm run dev                      # http://localhost:3000 (password form shown only here, on localhost)
npm test                         # 99 tests against the throwaway certprep_test database
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
| T-009 Theme system | Partial | Semantic tokens via `@theme inline`, default palette removed, two themes (Ledger, Control room), light/dark by system. Theme is a cookie, not yet stored per user; no lint rule banning raw colors yet |
| T-010 Exams | Mostly | Courses catalog, start/continue/pause/resume, readiness target and exam date. No "create manually" |
| T-011 Pack loader | Done | Reads `content/*/blueprint.json` |
| T-014 Dev password login | Done | Flag lives in `.env.development`; guards and tests in `tests/auth.test.js` |
| T-015 Pack tooling | Done | `npm run pack:validate`, `npm run pack:new -- <code>` |
| T-022/T-023 Import | Done | Preview then commit; server re-validates; all-or-nothing; duplicates skipped; optional update by `id`; 2 MB / 2000-question caps |
| T-025 Question editor | Edit only | Revalidates through the importer, including the exam profile. No "new question" form |
| T-026 Safe markdown | Done | React-element renderer, https links only, no raw HTML |
| T-030/T-031 Review gate and queue | Done | Drafts excluded from pool and stats; blind-answer review; reject needs a reason |
| T-042–T-044, T-050–T-052 Practice loop | Done | Setup, resumable runner with per-option rationales, results, answer review, retry missed |
| T-046 Flag and note | Partial | Flag and note in the runner; no bookmark UI |
| T-061/T-062 Mock exam | Done | Stratified by weight (largest remainder), server-enforced deadline, navigator, review-before-submit, results vs target and pass-mark proxy |
| T-072–T-075 Today, map, objective detail, what's left | Done | Readiness, bank, activity, what's left, weakest 5, mock trend, treemap (map/list, accuracy/coverage/count, filters) |
| T-077 History | Done | Score line chart with mode filter, session table with Resume, results page |
| T-080 Export/import/delete | Done | Id-free JSON; import replaces all-or-nothing; delete requires typing your name |
| T-084–T-086 Admin site | Done in code, Tailscale part unverified | `APP_MODE=admin`: users, invite links, reset passkeys, sign out everywhere, delete, audit log; `proxy.js` makes the modes mutually exclusive; boot guards in `instrumentation.js` |
| T-090 Placeholders | Done | Study material and flashcards pages; `objective.study_notes` column |

## Not built yet

- T-012 domain/objective editor, T-013 theme lab and design notes, T-027 export approved questions, T-045 confidence chip, T-047 keyboard shortcuts, T-053 mistakes page, T-076 trends, T-078 question history, T-079 dedicated coverage view, "create exam manually", "new question" form.
- T-081 browser end-to-end test (the data-layer golden path is tested; the UI was exercised by hand).
- T-082 remainder: adapt and install `docker/nginx-study.conf.example` (untested draft), the Namecheap record, certificates, scheduled `pg_dump` and a restore drill. T-083 remainder: CSP with nonces, nginx rate limits, the pre-exposure checklist run-through.
- Content: no question bank exists beyond the 5-question test fixture. Drafting is the main remaining effort.

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
