# 01 — Vision & MVP

## Problem

Studying for certification exams is scattered: videos in one place, practice questions in another, notes somewhere else, and no honest answer to "what's left, and am I ready?"

## Vision

A **personal** study tool, usable for any certification (CLF-C02 first), built around the vendor's published exam blueprint. For each exam it answers:

1. **Where am I?** — accuracy and coverage per domain and objective, shown on a blueprint map.
2. **What's left?** — a checklist of objectives not yet at target, sorted by exam weight × gap.
3. **What did I do?** — session history and trends.
4. **Am I ready?** — a simple readiness number against a per-exam target (default 80%).

**Scope reality check (2026-10-31):** this is not a public product. It is **multi-user capable** with secure sign-in (closed registration) and strict per-user data isolation ([doc 11](11-auth-and-tenancy.md)), but there is no public launch, billing, legal pages or compliance program. Always online, so no offline mode. Keep it simple; add machinery only when you hit a real need.

## Principles

- **The vendor's blueprint is the spine.** Questions, progress and the map all hang off domains/objectives from the exam pack.
- **Retrieval first:** questions and (later) flashcards, not rereading.
- **Honest numbers:** thresholds are labeled as starting values; small samples say "not enough data."
- **Own your data:** plain export/import; nothing locked in a service.
- **Content is original:** AI-drafted from the vendor's published objectives, reviewed by you before use. No exam dumps, no third-party banks.
- **Structure over polish:** flows and information design first; visual design curated later.

## MVP scope

The MVP is delivered as four slices (see [05-backlog.md](05-backlog.md)): **1 Study loop → 2 Dashboards, map & what's left → 3 Exam rehearsal → 4 Everything else.**

### In

| Area | What ships | Spec |
|---|---|---|
| Exams & packs | Load an exam pack (blueprint, objectives, pass-mark proxy, readiness target); multiple exams, switcher | F01, [doc 08](08-exam-pack-onboarding.md) |
| Content in | JSON import with preview; question editor; draft/approved gate with blind-answer review queue | F02, F17-slice |
| Practice | Scoped practice (exam/domain/objective/flagged/missed/unseen), instant feedback with per-option rationales, resumable | F03 |
| Mock exam | Timed, pack-driven length, stratified by domain weight, review-before-submit, results | F04 |
| Results & history | Session results, answer review, retry missed, history | F05, F08 |
| **Dashboards & map** | **Today dashboard** (readiness, what's left, next action, weakest objectives, activity, mock trend); **blueprint map** (treemap colored by status); **objective detail**; content coverage view | F06, F07 |
| Marks & notes | Flag, bookmark, note on a question | F09 |
| Accounts & data | Passkey-only sign-in (dev-only password on localhost), invite-only registration, strict per-user isolation, a separate Tailscale-only admin site for passkey resets and invites, per-user JSON export/import, delete account | F16, [doc 11](11-auth-and-tenancy.md) |
| Placeholders | Study material and flashcards: empty-state pages and a reserved field only | F22, F10 |

### Out (for now)

Flashcards/FSRS · real study material · mistake notebook · study planner · time tracker · sync/multi-device features · in-app AI generation/tutor · everything in the backlog's "Cut" list.

### Done when

- Load CLF-C02, import a draft file, approve questions, practice a chosen objective, and see the map and "what's left" update.
- The Today dashboard's numbers match a hand-computed fixture (progress/readiness logic is unit-tested).
- A timed mock runs for the configured length, survives a refresh, and reports against the exam's readiness target.
- Plain export → clear → import restores everything.
- The two-user isolation test suite passes: one user can never read or write another's data.
- Session screens work at phone width and with the keyboard.

## Roadmap (order, not dates)

| Stage | Contents |
|---|---|
| **MVP** | Slices 1–4 above |
| **Next** | Flashcards with FSRS · mistake notebook · real study material · study plan and time tracker |
| **Later** | In-app AI drafting/tutor · more question types · Anki import · cross-exam concept tags |

Stack (decided 2026-10-31): Next.js + Postgres with row-level security + Better Auth, on the homelab. See [09-stack-options.md](09-stack-options.md); a few sub-choices are still open there. Design direction constraints: [12-design-direction.md](12-design-direction.md).
