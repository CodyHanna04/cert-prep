# 10 — Structure & Flows

Scope: **structure and flows only** — what screens exist, what each contains, how you move between them, and how progress is computed. Visual design is deliberately out of scope and will be curated later. Wireframe-level boxes only.

## 1. Sitemap

```
Sign in (passkey)           ← shown when signed out; on localhost dev builds a password form also appears
Global bar:  [Exam switcher ▾]   Today · Map · Practice · Mock · Library · History · Settings   [Account ▾]

Today (dashboard)           ← home
Map (blueprint map)         ← domains → objectives, colored by status
  └ Objective detail        ← stats, questions, drills, mistakes, study-material tab (placeholder)
Practice
  ├ Setup → Session → Results → Answer review
Mock exam
  ├ Setup → Runner → Review-before-submit → Results → Answer review
Library
  ├ Questions (list, filter, edit)
  ├ Import / Drafts (review queue)
  ├ Mistakes & Flagged
  ├ Study material      ← PLACEHOLDER (empty state, "coming later")
  └ Flashcards          ← PLACEHOLDER
History
  ├ Sessions list → Session detail
  └ Question history
Settings
  ├ Exams (switch, load pack, edit readiness target, exam date)
  └ Account & data (my passkeys: add/rename/remove, sessions & devices, theme, export/import, delete account)
Admin site (separate, Tailscale-only; not part of the public site)  ← users, reset passkeys, invites, disable/delete, audit log; no study data
```

Every screen is scoped to the active exam. Switching exams changes everything on screen; nothing mixes across exams (except the later "same concept" lookups).

## 2. Core flows

**F-0. Sign in / join.** Signed out → sign-in page: one passkey button (plus browser autofill) → Today. **Joining:** an invite link (single-use, expiring) → enroll a passkey → prompted to add a **second** passkey → Today. The first account is created from a token issued by a CLI on the server, not from a public setup page. Lost every passkey: you issue a re-enrollment link. No public sign-up. Every other screen requires a session.

**F-1. First run / add an exam.** Empty Today → "Add an exam" → pick *Load exam pack* (e.g. CLF-C02) or *Create manually* → shows source, version, retrieved date, readiness target (default 80%), optional exam date → lands on the Map with every tile "not started" and a prompt "Add questions to begin."

**F-2. Get content in.** Library → Import → choose file → **preview** (counts, errors, warnings, near-duplicates, domain/objective mapping) → confirm → questions arrive. Anything `ai-draft` lands as *draft*, which is excluded from practice and stats until approved.

**F-3. Review drafts.** Library → Drafts → queue by objective → question shown *without* the key (you answer first) → reveal key, rationales, `refs` → **Approve / Edit / Reject (with reason)** → next.

**F-4. Practice loop.** Practice → Setup (scope: whole exam / domain / objective / flagged / missed / unseen; count; order) → Session (answer → instant feedback with per-option rationale → next; flag/note any time; resumable) → Results (score, per-domain/objective breakdown) → Answer review → "Retry missed."

**F-5. Mock exam.** Mock → Setup (shows count/time from the pack, domain allocation) → Runner (countdown, navigator with answered/unanswered/flagged, no feedback) → Review-before-submit → Results vs readiness target and pass-mark proxy → Answer review.

**F-6. Daily check-in.** Today shows readiness, **what's left**, and one primary button (**Resume**, or **Practice weakest objective**). One click to start.

**F-7. Find what's left.** Map → filter "Not done" → tap a tile → Objective detail → *Practice this objective* (pre-scoped Setup), *See mistakes*, *Add questions* (shows draft prompt for this objective).

**F-8. Switch exam.** Exam switcher in the global bar; all screens re-scope; last-used screen per exam is remembered.

**F-9. Your data.** Settings → Account & data → Export my data (one JSON file) / Import (replaces after confirmation) / Delete my account. Simple, no versioning. Each user only ever sees their own data.

**F-10. Admin: reset a user's passkeys.** Open the admin site over Tailscale → Users → pick the user → *Reset passkeys* → type the user's name to confirm → the site revokes their passkeys and sessions and shows a single-use re-enrollment link once → you send it out of band → the user opens it on the public site and enrolls a new passkey (then adds a second). Every step is in the audit log.

## 3. Progress model (drives Today, Map, Objective detail)

Definitions, per exam, per objective (and rolled up to domain):

- **Pool:** approved questions only.
- **Coverage** = distinct pool questions answered at least once ÷ pool size.
- **Accuracy** = correct share over the **latest 3 attempts per question** (so an early miss doesn't drag forever).
- **Sample** = number of pool questions with at least one attempt.
- **Readiness target** = per-exam setting, **default 80%**.
- **Status** (one per objective):
  | Status | Rule |
  |---|---|
  | No questions | Pool is empty (content gap) |
  | Not started | Pool > 0, coverage = 0 |
  | In progress | Coverage > 0, but coverage < 80% or sample < 5 |
  | Needs work | Coverage ≥ 80%, sample ≥ 5, accuracy < target |
  | On target | Coverage ≥ 80%, sample ≥ 5, accuracy ≥ target |
- **Done** = status is *On target*. **What's left** = all objectives not Done, sorted by (domain weight × gap to target).
- **Readiness (exam)** = Σ domain weight × domain accuracy, shown only when every domain has sample ≥ 10; otherwise "Not enough data yet" with what's missing. Compared to the exam's readiness target. Mock-exam scores are shown beside it as a separate series.
- These thresholds (80% coverage, sample ≥ 5, last 3 attempts, sample ≥ 10) are starting values in settings, not research-backed. Tune after real use.

## 4. Screen contents

### Today (dashboard)
1. **Readiness card:** score vs target, traffic light, "not enough data" state, days to exam if set.
2. **What's left:** checklist grouped by domain: objectives not Done, each with its status chip and one button *Practice*; plus action rows (*N drafts to review*, *no mock taken yet*, *N objectives with no questions*).
3. **Next action** button.
4. **Weakest 5 objectives** (by weight × gap).
5. **Activity:** last 14 days (sessions/questions per day).
6. **Mock trend:** scores over time with the target line.
7. **Recent sessions:** last 5, each linking to its detail.

### Map (blueprint map)
- **Treemap:** one tile per domain, area ∝ weight; objectives are sub-tiles; color = status (see §3); label shows code + accuracy + coverage.
- **Toggle:** *Map ↔ List*, and a *Show: accuracy | coverage | question count* switch.
- **Filter:** *All | Not done | Needs work | No questions*.
- Click a tile → Objective detail.

### Objective detail
Header (code, title, status) · tabs: **Overview** (accuracy/coverage, attempts over time, scope notes from the pack) · **Questions** (pool, filter, edit) · **Mistakes** (missed/flagged here) · **Study material** (placeholder) · actions: *Practice this objective*, *Add questions*.

### Library → Questions
Search and filters (domain, objective, tag, type, status, source, flagged), list with status chips, open → editor.

### Library → Drafts
Queue grouped by objective with counts; the blind-answer review screen from F-3.

### History
Sessions table (date, mode, score, time) → session detail (same as Answer review). Question history page shows every attempt on one question.

### Settings
Per exam: name, readiness target %, exam date, pass-mark proxy (with the note), blueprint source info. Data: plain export/import.

## 5. States to cover

- **Empty:** no exam; exam with no questions; objective with no questions; no sessions yet; no drafts.
- **In-progress session:** resumable from Today/Practice; at most one open practice or mock session per exam.
- **Draft vs approved:** drafts never appear in practice, mock, stats, or counts that imply progress.
- **Errors:** import file invalid (shows where); session question deleted mid-way (skip with note).

## 6. Content flow (where files and the app meet)

`content/<exam>/drafts/*.json` is an **inbox**: Claude writes files there, you import them, and from that point **the app's database is the source of truth.** Edits you make in the app do not flow back to the files automatically. If you want a git-versioned copy of the approved bank, use *Library → Export approved questions* (writes one JSON file) and commit that. This avoids two-way sync.

## 7. Placeholders (to be implemented later)

- **Study material:** Objective detail tab and Library entry exist as empty states ("Study notes for this objective will live here"); Objective has a reserved nullable `studyNotes` field. No behavior yet.
- **Flashcards:** Library entry and a nav stub only.
