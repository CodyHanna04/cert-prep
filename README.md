# CertPrep

A study tool for certification exams: question practice, timed mocks, and dashboards that show where you stand on each exam domain, what's left, and whether you're ready. Built around each vendor's published exam blueprint, with a repeatable process for adding any certification.

**Production address (planned):** `https://study.codycodez.com`

**Status:** Slice 1-3 built and tested (see [docs/13](docs/13-build-status.md)); the admin site is built but its Tailscale deployment is unverified; the homelab deploy and public-exposure hardening are not done. Stack: **Next.js (JavaScript) + PostgreSQL (row-level security) + Better Auth with passkeys + Tailwind CSS, on the homelab, shared over public HTTPS** ([docs/09](docs/09-stack-options.md)).

## Doc index

| Doc | What's in it |
|---|---|
| [docs/13-build-status.md](docs/13-build-status.md) | **What is built, how to run it, findings from the build, what is still open.** |
| [docs/01-vision-and-mvp.md](docs/01-vision-and-mvp.md) | Vision, principles, MVP scope (in/out), roadmap. Start here. |
| [docs/10-flows-and-structure.md](docs/10-flows-and-structure.md) | Sitemap, core flows, how progress/status/readiness are computed, dashboard and blueprint-map contents. |
| [docs/08-exam-pack-onboarding.md](docs/08-exam-pack-onboarding.md) | **The framework for adding a certification:** template, prompt, validator, process, question-type triage, version handling. |
| [docs/09-stack-options.md](docs/09-stack-options.md) | Stack decision, public-hosting options, what's still open. |
| [docs/11-auth-and-tenancy.md](docs/11-auth-and-tenancy.md) | Passkey technology, dev-only password login, recovery, three-layer data isolation, tests, pre-exposure checklist. |
| [docs/12-design-direction.md](docs/12-design-direction.md) | Look-and-feel constraints, the Tailwind-based theme system, starter themes, UI toolkit. |
| [docs/design-notes/](docs/design-notes/README.md) | Template and index for notes on each theme you try. |
| [docs/05-backlog.md](docs/05-backlog.md) | Tickets in four slices with dependencies, plus "Later" and "Cut" lists. |
| [docs/03-feature-specs.md](docs/03-feature-specs.md) | One spec per feature (F01–F22). |
| [docs/02-architecture.md](docs/02-architecture.md) | Structure, data model, core logic. |
| [docs/04-content-format.md](docs/04-content-format.md) | Question/exam import format. |
| [docs/07-ai-content-pipeline.md](docs/07-ai-content-pipeline.md) | How AI-drafted questions are made, linted, reviewed and approved. |
| [docs/06-open-questions.md](docs/06-open-questions.md) | Decisions made, open questions, what's unverified. |
| [docs/00-research.md](docs/00-research.md) | Background research. Only §11 (CLF-C02 facts) is verified from a primary source. |

## Exam pack toolkit

| Path | Purpose |
|---|---|
| [content/_template/](content/_template/blueprint.json) | Blank pack to copy |
| [content/prompts/onboard-exam.md](content/prompts/onboard-exam.md) | Instruction for Claude to research and build a pack from the vendor's own guide |
| [scripts/validate-pack.mjs](scripts/validate-pack.mjs) | `node scripts/validate-pack.mjs content/<code>/blueprint.json` |
| [content/clf-c02/](content/clf-c02/), [content/dva-c03/](content/dva-c03/) | Two reference packs built with the process (no more are planned until you choose one) |

## Decisions so far

- **Framework over content:** the deliverable is the process for adding certifications; CLF-C02 and DVA-C03 exist as reference packs.
- **JavaScript** (no TypeScript); Zod; plain SQL; Postgres with RLS; Better Auth + passkey plugin; Tailwind v4; Docker Compose on the homelab; your existing reverse proxy for public HTTPS (DNS at Namecheap; no Cloudflare).
- **Passkeys only in production;** username + password **only on localhost**, with guards that make it impossible in production. Invite-only registration; recovery via a second passkey, the admin portal, or a break-glass CLI.
- **Multi-user with strict per-user isolation.** Always online; no offline/sync.
- Not a public launch; keep it simple. Dashboards, blueprint map and "what's left" are core; readiness target per exam (default 80%).
- Content: AI-drafted from vendor objectives + your own, reviewed before use; no dumps, no third-party banks.
- Study material and flashcards: placeholders only. **Several themes** to try and take notes on; no generic "AI slop" look.
- **Admin is a separate site, reachable only over Tailscale** (same codebase, second container, Tailscale identity allowlist, own DB role); the public site has no admin routes. It resets users' passkeys, issues invites, and keeps an audit log; blind to study data.
- Public site: your **nginx** on a static IP, Namecheap DNS, no Cloudflare. **React Aria Components** for behavior; **tiny in-repo SQL migration runner.**

## Quick start

```bash
docker compose up -d db && npm install && npm run db:migrate && npm run db:seed-dev && npm run dev
```

Open http://localhost:3000 and sign in with the dev account shown by `db:seed-dev`. `npm test` runs the suite (needs the db container). Details in [docs/13](docs/13-build-status.md).

## What's left

**Built:** the study loop (import, review gate, practice, results), dashboards and blueprint map, timed mock exams, passkey auth with invite links, per-user isolation with a 16-test suite, personal export/import/delete, and the admin site. 90 tests pass; lint is clean.

**Next, in order of value:**
1. **Content:** draft and approve a real question bank per exam ([docs/07](docs/07-ai-content-pipeline.md)). Only a 5-question test fixture exists.
2. **Try real passkeys in a browser** and, if you intend to share the site, finish **T-082/T-083**: nginx server block, certificates, rate limits, backups with a restore drill, the pre-exposure checklist ([docs/11 §6](docs/11-auth-and-tenancy.md)). Verify the Tailscale sidecar for the admin site.
3. **Small gaps:** domain/objective editor (T-012), theme lab (T-013), mistakes page, trends, question history, keyboard shortcuts, "new question" form, theme stored per user.

**Later (not planned in detail):** flashcards with spaced repetition, real study material, study plan and time tracker, in-app AI drafting, more question types.
