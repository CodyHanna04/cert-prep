# 03 — Feature Specs

Each spec: **Purpose · Behavior · Data/edge cases · Phase · Depends on**. User stories use "I" = the learner. Tickets for MVP features live in [05-backlog.md](05-backlog.md); post-MVP features get broken down when their phase starts.

---

## F01 — Exams & blueprint management  *(MVP)*

**Purpose:** The exam blueprint is the spine of the app.

**Behavior**
- Create/edit/archive an exam: name, vendor, exam code, pass mark %, time limit (min), question count, exam date (optional).
- Define domains with weight % (and optional objectives under each). UI shows a running total and warns if ≠ 100.
- Switch the "active exam" from a global selector; all screens scope to it.
- **Exam packs:** load `content/<code>/blueprint.json` (domains, weights, objectives with scope, format, sources, pass-mark proxy, readiness target default 80%). See [doc 08](08-exam-pack-onboarding.md).

**Edge cases:** deleting a domain with questions → force reassign or archive; changing weights doesn't rewrite history; multiple exams concurrently.

**Depends on:** none.

---

## F02 — Question bank & import  *(MVP)*

**Purpose:** Get content in quickly and safely; keep it editable.

**Behavior**
- Import file (JSON; Markdown variant) per [04-content-format.md](04-content-format.md). Flow: choose file → **preview** (counts, warnings, errors by line) → confirm → transactional commit.
- Dedupe by `contentHash`; on collision offer skip / update / keep both.
- Question list view with search, filter (domain, tag, type, flagged, source, status), bulk tag/move domain/delete.
- In-app editor with live markdown preview; add/remove options; mark correct; write rationale per option.
- Every question has `source` (own/imported/licensed/ai-draft); a visible reminder at import: *"Only import content you have the right to use. This app does not provide exam dumps."*

**Edge cases:** missing domain names → map or create; duplicate option text; zero/multiple correct answers for single-choice (error); huge files (limit + progress).

**Depends on:** F01.

---

## F03 — Practice session engine  *(MVP)*

**Purpose:** The core retrieval loop with instant feedback.

**Behavior**
- Start screen: pick scope (all / domain(s) / tag / flagged / unseen / previously missed), count (10/25/50/custom), order (random / unseen-first / missed-first / weak-domain-weighted).
- Question view: stem, options (radio/checkbox by type), submit → immediate result + explanation with per-option rationale; next.
- Optional **confidence** chip (guess / unsure / sure) before submit (setting, default on).
- Flag question; add quick note; "report problem with this question" (stores a note; full loop is F20).
- **Resumable:** session state persisted on every action; closing the tab and returning offers "Resume".
- Keyboard: 1–9 select option, Enter submit/next, F flag, N note.

**Data:** writes Session + Response events; updates QuestionStats.

**Edge cases:** empty pool message with reason; question deleted mid-session (skip + note); time per question measured only while tab is focused.

**Depends on:** F02.

---

## F04 — Timed mock exam simulator  *(MVP)*

**Purpose:** Practice under real conditions.

**Behavior**
- Config pulled from exam (count, time limit); stratified sampling by domain weight; no feedback until the end.
- Header: countdown timer, question X of N, progress; **navigator panel** with answered/unanswered/flagged states; flag-for-review; previous/next; **review screen** before submit listing unanswered/flagged.
- Timer persists across refresh (based on `startedAt`, not a ticking counter); auto-submits at zero; optional pause setting (off by default since real exams don't allow it).
- Results → F05; pass/fail vs pass mark; per-domain breakdown; time stats (avg per question, slowest).

**Edge cases:** device sleep (timer derived from timestamps); user submits with unanswered (warn).

**Depends on:** F02, F03 (shares question view).

---

## F05 — Results & review  *(MVP)*

**Purpose:** Turn every session into learning.

**Behavior**
- Summary: score, pass/fail (mock), time, domain breakdown bar chart, confidence calibration (if used).
- Question-by-question review: your answer vs correct, full explanation, all rationales; filters: incorrect / flagged / unanswered / slow.
- Actions per question: flag, note, "add to mistake notebook" (becomes automatic in F11), jump to question history.
- "Retry missed questions" button → new practice session seeded with the misses.

**Depends on:** F03/F04.

---

## F06 — Today dashboard  *(MVP — core)*

**Purpose:** Answer "where am I, what's left, what next?" in ten seconds. Structure and definitions live in [doc 10](10-flows-and-structure.md) §3–§4.

**Widgets (in order)**
1. **Readiness:** weighted domain accuracy vs the exam's readiness target (default 80%), traffic light, "not enough data yet" state naming what's missing; days to exam if set.
2. **What's left:** objectives not On target grouped by domain with status chips and a *Practice* button each; action rows (*N drafts to review*, *no mock taken yet*, *N objectives with no questions*).
3. **Next action:** *Resume session* or *Practice weakest objective*.
4. **Weakest 5 objectives** by weight × gap to target.
5. **Activity:** questions answered per day, last 14 days.
6. **Mock trend:** mock scores over time with the target line.
7. **Recent sessions:** last 5.

**Depends on:** F03–F05, F07 progress logic.

---

## F07 — Blueprint map, objective detail & coverage  *(MVP — core)*

**Purpose:** See the whole exam as a map, and see what's left at a glance.

**Blueprint map:** treemap, one tile per domain with area proportional to weight, objective sub-tiles colored by status (No questions / Not started / In progress / Needs work / On target); label shows code, accuracy, coverage. Toggle Map ↔ List; metric switch (accuracy | coverage | question count); filter All / Not done / Needs work / No questions. Click a tile → objective detail.

**Objective detail:** header with status; tabs **Overview** (accuracy and coverage, attempts over time, the pack's scope notes), **Questions**, **Mistakes**, **Study material (placeholder)**; actions *Practice this objective* and *Add questions*.

**Content coverage view:** per objective, approved / draft / target count (targets from doc 07 §6, editable), so you know where to draft next.

**Depends on:** F01, F02, progress logic (T-070).

---

## F08 — History & analytics  *(MVP)*

**Purpose:** Past records, searchable and trustworthy.

**Behavior**
- Session list (date, mode, score, duration, exam) with filters; open any session in review (F05).
- **Per-question history page:** every attempt, result, time, confidence, notes.
- Charts: score over time, accuracy by domain over time, time per question distribution.
- CSV export of responses.

**Depends on:** F03–F05.

---

## F09 — Flags, bookmarks & notes  *(MVP)*

**Behavior:** Flag = "revisit/uncertain"; bookmark = "keep for reference". One personal note per question (markdown). Lists with filters; flagged pool is a practice scope. Unflag automatically when answered correctly N times in a row (setting).

---

## F10 — Flashcards & spaced repetition (FSRS)  *(placeholder in MVP; first feature after it)*

**MVP:** Library entry and nav stub with an empty state only.

**Later:** card types (basic, cloze, question card), daily review queue, `ts-fsrs` scheduling (verify current API), desired-retention setting, leech detection, auto-cards from missed questions, retention stats. Details are intentionally not frozen until the MVP is in use.

---

## F11 — Mistake notebook & error tagging  *(later — not frozen)*

**Behavior:** Every wrong (or lucky-guess, i.e. correct with "guess" confidence) answer enters a notebook. After review, tag **why**: *knowledge gap / misread question / confused similar concepts / careless / guessed*. Notebook views by tag, domain, recurrence. "Re-test" button schedules the question via FSRS. Weekly summary: "You lose most points to *confused similar concepts* in Domain 3" — turns the pattern into an action.

**Depends on:** F05, F10.

---

## F12 — Readiness  *(MVP — simple version, part of F06)*

**Behavior:** Readiness = Σ domain weight × domain accuracy, shown only when every domain has ≥ 10 answered pool questions; otherwise "not enough data yet" naming the domains that need more. Compared to the **per-exam readiness target (default 80%)**. The vendor's pass mark is stored separately as a proxy and shown on mock results only.

**Not building:** probability-of-passing claims or interval models. The weighted average is transparent and tunable. A statistical model can come later if the simple one proves misleading.

---

## F13 — Study plan & goals  *(later — not frozen)*

**Behavior:** Input exam date, hours/week, available days. Generates a schedule: per-day targets (new flashcards, practice questions by domain, one mock per week-ish, final-week review). Re-plans automatically when behind (shows "you're 2 days behind; here's the adjusted plan"). Today view = checklist with the plan items auto-checked as you complete them. Plans are suggestions — drag to reschedule.

**Depends on:** F12, F10, F14.

---

## F14 — Study time tracker, heatmap & streaks  *(later — not frozen)*

**Behavior:** Auto-tracks active time in sessions/reviews; manual log for off-app study (video, labs, reading). Pomodoro timer. GitHub-style heatmap, weekly goal ring, streak with a **freeze day** (avoid punishing life). No leaderboards/confetti spam — motivation by visibility.

---

## F15 — Resource tracker  *(later — not frozen)*

**Behavior:** Add resources (course, video playlist, book, lab, doc link) mapped to domains/objectives with progress (% or checklist). Dashboard shows "resources not started" for weak domains; recommended order per domain. Optional links to official exam guides and objectives PDFs.

---

## F16 — Accounts & data  *(MVP)*

Passkey-only sign-in (a dev-only password login on localhost), invite-only registration, recovery via a second passkey or an admin-issued link and strict per-user data isolation (app layer + Postgres row-level security + a CI isolation test suite) per [doc 11](11-auth-and-tenancy.md). Per-user JSON export/import (import replaces after confirmation) and delete-my-account. Deliberately **no** versioned migrations, checksums or backup reminders; server backups are a scheduled `pg_dump`.

---

## F17 — AI assistant  *(drafting workflow + review gate in MVP; in-app generation and tutor later)*

Drafting happens outside the app: Claude writes import files per [doc 07](07-ai-content-pipeline.md); the app provides the draft/approved/rejected gate and the blind-answer review queue. In-app "generate" and the tutor come later and reuse the same prompt, lint and review path.

---

## F18 — Certification lifecycle  *(not planned for a personal tool)*

**Behavior:** Track earned certs (date, expiry, credential ID), renewal requirements (CEUs/continuing-ed), reminders at 90/30 days, log CEU activities, link to renewal exam practice. Makes the app useful after passing.

---

## F19 — Basics: responsive layout, dark mode, keyboard  *(MVP, minimal)*

Phone-width layouts for session screens, dark mode following the system setting, keyboard shortcuts in sessions with a cheat-sheet (`?`). Always-online app, so no offline mode; an installable PWA only if HTTPS works over the chosen access path. No formal accessibility program. Look-and-feel constraints: [doc 12](12-design-direction.md).

---

## F20 — Question quality loop  *(not planned for a personal tool)*

**Behavior:** "Report problem" types (wrong key, ambiguous, outdated, typo) → inbox; edit-in-place with history; per-question stats (percent correct across your attempts, average time) to surface suspects: questions you *always* miss despite studying (maybe wrong key) or never miss (too easy). Exam-version tagging so out-of-date questions can be filtered out when the vendor revises the exam.

---

## F21 — Reports & export  *(not planned for a personal tool)*

PDF score report for a mock exam (domain breakdown, missed topics list), study-summary PDF/CSV, printable exam-day checklist (ID, arrival time, allowed items — editable template, vendor policies change so mark as "confirm with the test provider").

---

## Cross-cutting requirements

- **Usability:** keyboard-usable session screens; color never the only signal.
- **Privacy:** no tracking or telemetry.
- **Not planned:** i18n framework, formal accessibility program, performance harness, observability tooling (personal tool).

---

## F22 — Study material  *(placeholder only)*

**MVP:** an empty-state tab on each objective and a Library entry ("Study notes for this objective will live here"), plus a reserved nullable `studyNotes` field on Objective. No behavior.

**Later (not frozen):** per-objective notes drafted from the pack's `scope` and official docs with citations, linked to questions and flashcards, and a "learn → test" path for objectives not yet started.

---

## F23 — Admin site  *(MVP, owner only; separate Tailscale-only deployment)*

**Purpose:** recovery and user management without database access, blind to study data, and **not reachable from the internet**. Design, protections and the honest limitation (an admin can take over an account by resetting it) are in [doc 11 §2.6](11-auth-and-tenancy.md).

**Screens:** Users (name, created, last sign-in, passkey count, status, role) · user actions (*Reset passkeys*, *Add a passkey link*, *Revoke sessions*, *Disable/Enable*, *Delete account*) · Invites (create, copy, revoke, pending) · Audit log.

**Rules:** only your Tailscale login is allowed; destructive actions need typing the user's name; links are single-use, expiring and bound to one user; no access to exams, questions, responses or notes; the public site has no admin routes.
