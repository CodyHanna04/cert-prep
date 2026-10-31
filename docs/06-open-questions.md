# 06 — Decisions & Open Questions

## Decided

| # | Decision | Date |
|---|---|---|
| D2 | First exam **CLF-C02**; second **DVA-C03** (you won't test before December). Both packs exist as reference examples; **no more packs are planned**. | 2026-10-31 |
| D3 | Content = AI-drafted questions (from vendor objectives) + your own. No third-party banks, no exam dumps; drafts need a review gate. | 2026-10-31 |
| D14 | Multiple certifications over time; **the deliverable is the framework and process** ([doc 08](08-exam-pack-onboarding.md)), not a library of packs. | 2026-10-31 |
| D16 | Not a public product; kept simple. | 2026-10-31 |
| D17 | Study material: placeholders only for now. | 2026-10-31 |
| D19 | Dashboards, blueprint map and "what's left" are core. | 2026-10-31 |
| D20 | Readiness target per exam, default 80%; vendor pass mark is a separate proxy. | 2026-10-31 |
| D21 | Backup versioning is not a priority. | 2026-10-31 |
| D22 | Build in slices; no exam-date deadline shapes the plan. | 2026-10-31 |
| D8 | **Stack:** Next.js + PostgreSQL (RLS) + Better Auth, Docker Compose on the homelab ([doc 09](09-stack-options.md)). | 2026-10-31 |
| D25 | Multi-user with strict per-user isolation ([doc 11](11-auth-and-tenancy.md)). | 2026-10-31 |
| D26 | Local-first, sync and offline dropped (always online). | 2026-10-31 |
| D34 | **JavaScript, not TypeScript**; Zod for runtime validation; plain SQL. | 2026-10-31 |
| D35 | Others connect over **public HTTPS** (not Tailscale); app doesn't depend on Tailscale. | 2026-10-31 |
| D37 | **Multiple themes** to test and take notes on: theme system, theme lab, design-notes template ([doc 12](12-design-direction.md)). | 2026-10-31 |
| D12 | Git repository initialized (`main`); no commits yet. | 2026-10-31 |
| D13 | Project name **CertPrep**. | 2026-10-31 |
| **D38** | **Domain: `study.codycodez.com`.** rpID is this exact host (not the parent domain). | 2026-10-31 |
| **D33** | **UI styling: Tailwind CSS** (v4), tokens mapped into its theme; **D3** for the map and charts; behavior library still open (D44). | 2026-10-31 |
| **D39** | **Passkeys only in production.** **Dev-only username + password on localhost**, guarded so it can't run in production. | 2026-10-31 |
| **D42** | **Passkey technology: Better Auth + `@better-auth/passkey` (built on SimpleWebAuthn).** Fallback: SimpleWebAuthn directly. Recovery = ≥ 2 passkeys + admin re-enrollment link + break-glass CLI; **TOTP/backup codes dropped.** | 2026-10-31 |
| **D46** | **No Cloudflare.** DNS stays at **Namecheap**; the **existing homelab reverse proxy** terminates HTTPS and forwards to the app; 443 forwarded; the app is isolated on its own Docker network ([doc 09](09-stack-options.md)). | 2026-10-31 |
| **D47** | **Admin = a separate deployment of the same codebase, reachable only over Tailscale** (sidecar + `tailscale serve`), allowlisted to your Tailscale login, own DB role, audit log. The public site has no admin routes. Replaces the earlier in-app `/admin` idea. ([doc 11 §2.6](11-auth-and-tenancy.md)) | 2026-10-31 |
| **D48** | **Reverse proxy is nginx**; IP is static most of the time and you'll handle changes, so no Dynamic DNS work. | 2026-10-31 |
| **D49** | **React Aria Components** is the behavior library. | 2026-10-31 |
| **D50** | **Migrations: a tiny in-repo runner**, with the rule that applied migrations are never edited. | 2026-10-31 |

## Open

| # | Question | Recommendation | Where |
|---|---|---|---|
| D51 | **Admin site: typed confirmation or a passkey tap** for destructive actions? | Typed confirmation (tailnet + identity already gate it); add a passkey step-up later if you want it. | [11](11-auth-and-tenancy.md) |
| D52 | **Admin deployment: same codebase, second container** (recommended) or a fully separate app/repo? | Same codebase; credentials and routes are separated at runtime. | [11](11-auth-and-tenancy.md) |
| D53 | **Commit the planning docs?** The repo has no commits yet. | Yes, as one initial commit. | — |

## Things I haven't verified

- **Better Auth** from plain JavaScript (its docs show only TypeScript), passkey-first users without an email, where `rpID`/`origin` are configured with `@better-auth/passkey`, database-backed rate limits, and CLI migration with a raw `Pool`. The first auth ticket (T-006) is a spike to settle these.
- **SimpleWebAuthn's** current maintenance status (my search returned nothing on it); relevant only to the fallback.
- **The argument for the exact-host rpID** over the parent domain comes from one practitioner blog and my own reasoning; no primary source found.
- **Tailwind v4** details: resetting default colors, `@theme` mapping, `inline` behavior, Next.js integration. From memory.
- **Tailscale Serve identity headers and Docker sidecar configuration**, including that headers aren't populated for tagged devices (from third-party summaries of Tailscale's docs); your tailnet needs HTTPS certificates and MagicDNS enabled.
- **Namecheap API** access for DNS-01 certificate renewal (only if you choose that route); **your nginx's** current rate-limit and header hardening; **Vercel** terms (only if option C is ever used).
- **Whether Postgres foreign-key cascades work under RLS** for admin account deletion (tested in the isolation suite).
- **Whether Better Auth has an admin plugin** worth using, or whether the admin portal is built on our own tables.
- **Behavior-library facts** (maintenance status, versions, accessibility test coverage) come from third-party comparison blogs.
- **Postgres RLS pattern** (`set_config(..., true)` in a transaction) comes from one third-party write-up; the isolation tests are how we verify it.
- **DVA-C03:** the 130-minute limit and 150 USD price come from AWS's certification page, not the guide. Question formats listed in the guide: multiple choice and multiple response only.
- `ts-fsrs` (a TypeScript library, usable from JavaScript) API and FSRS benchmark claims, needed for flashcards later.
- Whether AWS revises CLF-C02 or DVA-C03 after the versions I read.
