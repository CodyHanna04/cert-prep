# 09 — Stack Decision

**Status: decided 2026-10-31, updated with your latest answers (no Cloudflare; Namecheap DNS; existing homelab reverse proxy; admin portal for resets).** Rejected options are summarized at the bottom so the reasoning isn't lost.

## Your inputs

- **JavaScript, not TypeScript.** Desktop primary, mobile nice; always online.
- Homelab always on, **already running nginx** as the reverse proxy for your other services; your home IP is static most of the time (you'll handle a change if it happens). **React with Next.js**, its server side as the backend.
- **Production domain `study.codycodez.com`; DNS is at Namecheap. No Cloudflare.**
- **Passkeys only** in production; **username + password on localhost only** for testing; **an admin side reachable only over Tailscale** to reset users' passkeys and manage invites.
- **Tailwind CSS** and **React Aria Components** for UI.
- Strong security and strict per-user data separation ([11-auth-and-tenancy.md](11-auth-and-tenancy.md)).
- Several themes to try and take notes on ([12-design-direction.md](12-design-direction.md)).
- A framework for adding certifications, not a pile of packs ([08-exam-pack-onboarding.md](08-exam-pack-onboarding.md)).

## The decision

| Layer | Choice | Why |
|---|---|---|
| **Language** | **JavaScript (ES modules)**; **Zod** validates data at every boundary; JSDoc comments for function contracts (comments only) | Without static types, runtime schemas and tests are the safety net. |
| **App** | **Next.js (App Router)**, server code in route handlers/server actions; pure-JavaScript domain logic with no I/O | One codebase for UI and backend. |
| **Database** | **PostgreSQL in Docker on the homelab** | Real SQL for dashboard aggregates plus **row-level security** so the database enforces per-user isolation. |
| **Data access** | **Plain parameterized SQL** via the `postgres` or `pg` driver; one server-only query layer; schema changes through numbered SQL migration files (see "Why migrations" below) | Drizzle's main benefit is TypeScript types; RLS wants explicit SQL and transactions anyway. |
| **Auth** | **Better Auth + `@better-auth/passkey`** (built on SimpleWebAuthn), users in your Postgres via a `pg` Pool; a **Tailscale-only admin deployment** for invites and passkey resets. [doc 11](11-auth-and-tenancy.md) | Documented passkey-first onboarding without a session (used for invite-only registration), autofill sign-in, raw `pg` Pool. **Plain-JS use isn't shown in its docs; a first spike verifies it.** Fallback: SimpleWebAuthn directly. |
| **Dev login** | Password sign-in only when `NODE_ENV !== "production"` **and** `ALLOW_DEV_PASSWORD_LOGIN=true` **and** host is `localhost`; the server refuses to boot in production if the flag exists | [doc 11 §2.4](11-auth-and-tenancy.md) |
| **UI** | **Tailwind CSS v4** with tokens mapped into its theme; **React Aria Components** for accessible behavior, wrapped in our own `ui/` layer; **D3** for the map and charts | Comparison in [doc 12 §4](12-design-direction.md). |
| **Hosting** | **Docker Compose on the homelab:** Next.js (standalone build) + Postgres on an internal network | Fewest moving parts; the database never leaves your network. |
| **Public access** | **Your existing nginx** terminates HTTPS for `study.codycodez.com` and forwards to the public Next.js container; port 443 forwarded; Namecheap DNS `A` record for `study` pointing at your static home IP | Reuses what you run. No Dynamic DNS work planned. Details below. |
| **Admin access** | The **same image run a second time in admin mode**, behind a **Tailscale sidecar** with `tailscale serve` (tailnet-only HTTPS, Funnel off), authenticated by Tailscale identity headers and an allowlist of your login, using its own database role. **No nginx route, nothing public.** | [doc 11 §2.6](11-auth-and-tenancy.md). Needs HTTPS certificates and MagicDNS enabled in your tailnet and an auth key for the sidecar. |
| **Your own use of the study site** | The same public URL | Tailscale is needed only for the admin site. |
| **Mobile** | Responsive web; installable PWA over HTTPS if you want it | No offline mode. |

## Public access without Cloudflare (what changes)

**How it works:** Namecheap DNS `A` record `study` → your static home IP; your router forwards TCP 443 (and 80 if your nginx obtains certificates over HTTP-01) to nginx; nginx obtains and renews a Let's Encrypt certificate (certbot or your existing method) and proxies to the public app container over a Docker network. DNS-01 through Namecheap's API is an alternative for certificates (the API has access requirements ❓ verify). If your IP ever changes, you'll update the Namecheap record yourself.

**What you give up vs. a tunnel service, and what replaces it:**

| Lost | Replacement |
|---|---|
| Home IP hidden; no inbound ports | The IP is public and 443 is open. The app must be treated as internet-facing from day one. |
| Edge WAF, rate limiting, DDoS absorption | Rate limits and request-size limits **at your reverse proxy** and in the app (database-backed); optional CrowdSec/fail2ban on proxy logs ❓; accept that a determined flood isn't absorbed. |
| Cloudflare Access on admin routes | **No admin routes on the public site at all**: the admin side is a separate deployment reachable only over Tailscale |
| Blast-radius containment | Your proxy already fronts other services, so **isolate the app**: its own Docker network with no route to other services, the database reachable only by the app, ideally a separate VLAN/DMZ if your router supports it. A compromise of this app must not reach your other services. |

**nginx checklist (I'll write the config in T-082):**
- HTTPS with HSTS (`add_header ... always`), TLS settings per current Mozilla guidance, OCSP stapling optional.
- **Overwrite the client IP, don't append to it:** `proxy_set_header X-Forwarded-For $remote_addr;` so a client can't spoof its address and dodge rate limits; the app trusts only nginx.
- `limit_req_zone` / `limit_req` with strict rules on `/api/auth/` and the invite-acceptance routes, a laxer general limit, `limit_conn`.
- `client_max_body_size` set for question-file imports (a few MB at most), plus sensible timeouts.
- Security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame protection) set at nginx and/or in Next.js.
- `location /admin { return 404; }` as belt-and-braces (the public app also 404s on admin paths).
- A dedicated `server` block for `study.codycodez.com`; the default server returns 444/404 for unknown hosts.
- Logs rotated; optional fail2ban or CrowdSec reading the access log ❓.

## Why a migration mechanism (not necessarily a tool)

A **migration** is a numbered SQL file (for example `0007_add_notes_table.sql`) that moves the database from one schema version to the next. A runner applies, in order, only the files not yet applied, and records each in a `schema_migrations` table.

Why this app needs it:

1. **Your databases must match.** Development, the throwaway test database, and production all have to end up with the same tables. Hand-typing SQL against production is how drift and mistakes happen.
2. **Security lives in the schema.** `user_id NOT NULL`, `FORCE ROW LEVEL SECURITY`, the policies, the three database roles and their grants must be created identically every time. The isolation test suite builds a fresh database by running every migration, so it tests the real schema, not a lookalike.
3. **Safe deploys.** Pending migrations run once at deploy, with a lock so two containers can't run them at the same time.
4. **History and recovery.** Git shows how the schema evolved; a new machine or a disaster recovery rebuilds the schema in seconds.
5. **One system for everything.** Better Auth's tables should be created by the same mechanism: its CLI can *generate* the SQL (documented `generate` command), which we commit as a normal migration rather than running a second, separate migrator ❓ verify the output for a raw `Pool`.

You need the **mechanism**, not a heavy tool. Options: **a tiny in-repo runner** (~60 lines of JavaScript: read `migrations/*.sql` in order, apply each unapplied file in a transaction under an advisory lock, record it; no dependency; we control it), **dbmate** (standalone binary, plain SQL files, tracks applied versions), or **node-pg-migrate** (JavaScript, SQL or JS migrations). ORM migrators (Drizzle Kit, Prisma Migrate) assume an ORM, which we dropped. **Decided: the tiny runner**, with one rule: never edit a migration that has been applied; add a new one. Switch to dbmate later only if you want rollbacks or its CLI niceties.

## Public hosting options (argued)

| Option | For | Against |
|---|---|---|
| **A. Existing reverse proxy + forwarded 443 + Namecheap DNS (chosen)** | Reuses what you run; data stays home; no third party | Home IP and a port exposed; no edge DDoS/WAF; you own proxy hardening and the blast radius |
| B. Cloudflare Tunnel | Hides IP, no open ports, edge protections | You ruled it out |
| C. Vercel + hosted Postgres (Neon, Supabase, …) | Nothing exposed at home | Data leaves the homelab; serverless connection pooling (RLS with transaction-local settings through a pooler ❓ verify); free-tier limits and terms unchecked |
| D. Small VPS reverse proxy + WireGuard to homelab | Hides home IP; keeps data home | More ops than A for modest gain |

Keep the app **host-agnostic** (standard Next.js features, config via environment variables) so moving to C stays a connection-string change plus a data migration.

## ❓ Still open

1. **Better Auth spike results** (plain JavaScript, passkey-first user without an email, rpID/origin placement, database-backed rate limits, `generate` output for a raw `Pool`). Settled in the first auth ticket.
2. **Tailscale Serve identity headers and the Docker sidecar** behave as described in third-party summaries of Tailscale's docs ❓.
3. **Admin site: typed confirmation or a passkey tap for destructive actions** (recommended: typed confirmation; passkey step-up later if you want it).
4. **FK cascades under RLS** for admin account deletion ❓ (isolation suite checks it).
5. **Tailwind v4 specifics** from memory, unchecked ❓.
6. **Email:** not required; invite links are shared manually.

## Rejected options (short)

- **Browser-only / local-first / sync:** single device, evictable storage; offline not needed.
- **Firebase:** NoSQL fights aggregate dashboards, lock-in, nothing like RLS.
- **PocketBase / custom SQLite:** no RLS. **Self-hosted Supabase:** RLS and auth but many containers.
- **Hosted identity (Clerk, Auth0, …), Hanko, Authentik, Keycloak:** see [doc 11 §2.1](11-auth-and-tenancy.md).
- **Separate API server:** unnecessary with Next.js.
- **Drizzle/Prisma, TypeScript:** not needed; Zod + tests instead.
- **Full UI kits, CSS-in-JS:** see [doc 12](12-design-direction.md).
