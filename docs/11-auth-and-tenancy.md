# 11 — Authentication & Data Isolation

Goal: **as secure as reasonably possible** for a small multi-user app on the public internet, with **no user able to read or write another user's data**. "As secure as possible" has no finish line, so this doc lists concrete controls and tests. It is a design, not an audit.

Production address: **`https://study.codycodez.com`**. Access path: your existing homelab reverse proxy over public HTTPS, DNS at Namecheap ([doc 09](09-stack-options.md)). No Cloudflare.

## 1. Threat model (short)

| Threat | Main defense |
|---|---|
| Stolen or guessed credentials | Passkeys only in production (nothing to phish or guess), user verification required, rate limiting |
| Lost devices → lockout | ≥ 2 passkeys per account; **admin portal** resets a user's passkeys; break-glass CLI on the homelab if the admin is locked out |
| First visitor to a fresh install claims admin | No open setup page; the first account is created with a token issued by a CLI on the server |
| Dev shortcut (password login) reaching production | Triple guard + startup refusal + test (§2.4) |
| Session theft / CSRF | HttpOnly + Secure + SameSite cookies, explicit trusted origins, framework CSRF/origin checks left on |
| One user reading another's data (bug or exploit) | Ownership column on every row + Postgres RLS + role separation + tests (§3, §5) |
| Injection / XSS (imported files, markdown) | Parameterized SQL only, Zod validation, sanitized markdown (no raw HTML), CSP |
| Exposed login page on the internet | Existing reverse proxy hardened (HSTS, headers, rate limits, body limits, trusted `X-Forwarded-For`), only 443 forwarded, app isolated on its own network, passkeys, invite-only registration, database-backed rate limits; **no edge WAF or DDoS absorption (accepted)** |
| Admin access abused or stolen | Tailnet-only admin site, Tailscale identity allowlist, separate database credentials, typed confirmations, audit log. An admin can't read study data but **can take over an account by resetting its passkeys** (inherent to admin-reset recovery; §2.6) |
| Compromised homelab host | Non-root containers, DB not published beyond the compose network, secrets outside the repo, updates; beyond that, out of scope |
| Lost data | Scheduled `pg_dump` to another disk/host; restore tried once |

## 2. Authentication

### 2.1 Technology: Better Auth + its passkey plugin

- **Library:** Better Auth, with `@better-auth/passkey`. Its docs say the plugin is **powered by SimpleWebAuthn**, so we get an established WebAuthn implementation without writing the protocol ourselves. Never hand-roll WebAuthn, sessions or crypto.
- **Database:** Better Auth accepts a plain node-postgres `Pool` (documented), so no ORM is needed and it fits the plain-SQL data layer.
- **JavaScript:** the docs show only `.ts` examples and don't mention plain JS. It is a TypeScript-built npm package, so JS use should work, but **this is verified by the first ticket (T-006 spike), not assumed**. Fallback if it doesn't: use SimpleWebAuthn directly (`@simplewebauthn/server` + browser package) with our own session and passkey tables; more code, same security properties.
- **Alternatives considered and not chosen:** Hanko (passkey-first, self-hostable; aggregator says license terms unclear, smaller project), Authentik and Keycloak (full identity providers; heavier to run than a single app needs), hosted identity (Clerk, Auth0, etc.; moves your users' identities to a third party). SimpleWebAuthn alone is the fallback above.

### 2.2 Passkey configuration

- **Passkeys only in production.** `rpID` = **`study.codycodez.com`** (the exact host), `origin` = `https://study.codycodez.com`, `rpName` = CertPrep. Dev: `rpID` `localhost`, `origin` `http://localhost:3000`. All three come from environment variables, because a leftover `localhost` rpID is the commonly reported cause of "works locally, fails in production" (a community report with Better Auth on Vercel). Passkeys created on localhost won't work in production, by design.
- **Why the exact host and not the parent domain `codycodez.com`:** a parent-scoped rpID lets any other subdomain of `codycodez.com` (other projects, a blog, a forgotten demo) request assertions for these credentials, so one vulnerable subdomain becomes a risk to this app. The cost of the exact host is re-enrolling if you ever move the app to another hostname. The advice to use the most restrictive rpID comes from a practitioner blog; I found no primary source ❓.
- **Discoverable credentials and user verification required:** `residentKey: "required"`, `userVerification: "required"`. The plugin's defaults are `preferred`, so set them explicitly. This allows usernameless sign-in with browser autofill (conditional UI): the sign-in input carries `autocomplete="username webauthn"` and the page starts the passkey request on load, guarded by `PublicKeyCredential.isConditionalMediationAvailable()`.

### 2.3 Registration, invites and recovery

- **Closed registration.** The plugin supports **passkey-first onboarding without an existing session** (`registration.requireSession: false`, `resolveUser`, and a `context` value). We use `context` as a **signed, single-use, expiring invite token**. `resolveUser` verifies the token and creates the user; no valid token, no registration. Open sign-up stays off.
- **First account:** created with a token issued by a **CLI on the homelab** (`npm run auth:first-invite`). There is no setup page reachable from the internet.
- **Recovery without passwords:** (1) after the first passkey the UI requires a **second** one (for example password-manager passkey plus a different device or security key); (2) a user who loses every passkey asks you; you reset them in the **admin portal** (§2.6) after verifying them out of band; (3) if the admin loses everything, the **break-glass CLI** on the homelab issues a new admin token. Email/SMS recovery is rejected: the account would be only as secure as the inbox.
- **TOTP/backup codes are dropped.** Better Auth's docs say passkey sign-in is **not gated by 2FA** by default, and its 2FA/backup-code feature targets password-based sign-in, so it adds complexity without protecting a passkey-only account.
- **Open question:** Better Auth's user model has an email field. Whether a passkey-first user can be created without one (the docs' `resolveUser` example returns only `id` and `name`) is checked in the spike ❓.

### 2.4 Dev-only password login (localhost testing)

You asked for username + password on localhost. It must be **impossible to enable in production**:

1. **Three conditions, all required:** `NODE_ENV !== "production"` **and** `ALLOW_DEV_PASSWORD_LOGIN=true` **and** the request host is `localhost`. The Better Auth `emailAndPassword.enabled` setting is computed from these (the docs treat it as a plain boolean).
2. **Defense in depth:** whenever it isn't enabled, `/sign-in/email` and `/sign-up/email` are also added to `disabledPaths`.
3. **Startup refusal:** if `NODE_ENV === "production"` and the flag is set at all, the server **throws at boot** and doesn't start.
4. **Dev accounts come from a seed script** that refuses to run against the production database (checks `NODE_ENV` and the database host); dev uses its own database (a compose profile).
5. **A test** builds the production configuration and asserts the password endpoints are unavailable and the boot guard fires.

### 2.5 Sessions, cookies, CSRF, rate limits

- **Sessions:** database-backed cookie sessions; Better Auth's documented default lifetime is 7 days with refresh after 1 day; shorten if you want. Cookie cache stays off. "Sign out everywhere" and a device list in the account page.
- **Cookies:** `secure` by default in production per the docs; set `httpOnly` and `sameSite` **explicitly** (the docs show them only in examples and don't state defaults).
- **Origins and CSRF:** set `BETTER_AUTH_URL` and `trustedOrigins` explicitly to `https://study.codycodez.com`; keep CSRF and origin checks **on** (never `disableCSRFCheck`/`disableOriginCheck`).
- **Rate limiting:** enabled by default in production but with **in-memory** storage; use **database** storage so limits survive restarts, with stricter custom rules on sign-in, passkey and invite routes. The reverse proxy adds its own limits. Because the proxy sits in front, **overwrite `X-Forwarded-For` at the proxy and trust only that header in the app**, otherwise a client can spoof its IP and dodge the limits ❓ (verify Better Auth's client-IP setting).

### 2.6 Admin portal (a separate, Tailscale-only deployment)

You asked for the admin side to be reachable only over Tailscale, ideally as a separate site that reads the database. That is what this is, **without a second codebase**: the same code and image deployed a second time in admin mode.

**How it is built**
- **One image, two containers.** The public container runs with `APP_MODE=web`: admin routes return 404 and the container has **no `admin_app` database credentials**, so even a bug can't perform an admin action. The admin container runs with `APP_MODE=admin` and serves only the admin screens.
- **Not on the internet at all.** The admin container sits behind a **Tailscale sidecar** (shared network namespace) that publishes it with `tailscale serve` over tailnet-only HTTPS, with Funnel off. There is no nginx route to it; nginx also returns 404 for `/admin*` as a belt-and-braces rule.
- **Who may use it:** the admin app trusts the identity headers Tailscale Serve adds (`Tailscale-User-Login`), which Serve strips from incoming requests so clients can't forge them, and allowlists **your Tailscale login** (`ADMIN_TAILSCALE_LOGINS`). Tailscale's guidance is that a backend trusting these headers should listen only on localhost, which the sidecar layout provides; the headers aren't populated for tagged devices, so administer from your own untagged devices ❓ verify against Tailscale's current docs.
- **Database access:** its own role, `admin_app` (§3): read/write the `auth` schema and the audit table; no direct access to app tables.
- **Tokens:** invite and re-enrollment tokens are random values stored **hashed** in `auth.invite_token` (our own migration). The admin app inserts them; the public app verifies the hash at registration and marks the token used. No signing secret is shared between the containers.

**What it does**
- **Users list:** display name, created, last sign-in, passkey count, status, role. No exams, questions, responses or notes.
- **Reset passkeys** (one confirmed action): revoke all passkeys and sessions and issue a **single-use, expiring re-enrollment link** shown once, for you to send out of band. A variant, **"add a passkey link,"** keeps existing passkeys for someone replacing a device they still control.
- **Revoke sessions**, **disable / enable** an account, **delete** an account (typed confirmation; the user's app data is removed by foreign-key cascade ❓ verify cascades work with RLS and cover every table; fallback is a `SECURITY DEFINER` delete function; the isolation suite tests it).
- **Invites:** create, copy, revoke; list pending.
- **Audit log:** append-only; records who (Tailscale login), what, to whom, when.

**Protections:** tailnet-only reachability; identity allowlist; separate database credentials; destructive actions need typing the user's name; single-use expiring tokens bound to one user; audit log. A passkey step-up on the admin site is *not* used because the tailnet and identity already gate it; it can be added later ❓. For your own account on the public site, still enroll **two passkeys**.

**Honest limitation:** whoever can reset a user can issue themselves the link and take over that account. That's inherent to admin-reset recovery. The mitigations are the audit log, telling the user out of band when you reset them, and only inviting people you know. The admin still can't read study data without taking over an account, and that is visible in the log.

**Break-glass:** a command-line tool on the homelab issues the very first admin/user token and recovers if the admin site is unreachable.

**Does Better Auth have an admin plugin worth using?** I haven't read its docs for one; the admin app works on our own tables either way, and the spike decides ❓.

## 3. Data isolation (three layers)

1. **Ownership column:** every user-owned table has `user_id NOT NULL` referencing Better Auth's user table. Child tables carry `user_id` themselves so a policy checks one column without joins.
2. **Server-only data layer:** all queries go through one module that needs a `userId` taken from the **server-side session**, never from request input. Route handlers and server actions never run raw queries; a lint rule forbids importing the DB client elsewhere.
3. **Postgres Row-Level Security (backstop):** RLS enabled and **FORCE**d on every user-owned table; policies `USING (user_id = current_setting('app.user_id', true)::uuid)` with matching `WITH CHECK`, so with the setting unset **no rows match** (fails closed). Each request runs in a transaction that first does `set_config('app.user_id', <id>, true)` (transaction-local) via `withUser(userId, fn)`, so context can't leak across pooled connections. Indexes lead with `user_id`.

**Four database roles:**

| Role | Used by | Can |
|---|---|---|
| `owner` | migrations only | Create and alter everything |
| `auth_app` | Better Auth's `Pool` in the public container (via `search_path=auth`, which the docs show for a raw Pool) | Read/write the **`auth` schema only**; no access to app data |
| `app_user` | the data layer | Read/write the **app schema** under RLS; no superuser, not table owner, no `BYPASSRLS`; no access to the `auth` schema |
| `admin_app` | the Tailscale-only admin deployment | Read/write the **`auth` schema** (users, sessions, passkeys, `invite_token`) and the audit table; delete a user (cascade ❓); **no direct access to app tables**. Its credentials exist only in the admin container |

Better Auth must look up users across accounts to sign them in, so it can't run under per-user RLS; keeping it in its own schema and role contains that. App tables reference `auth.user(id)`.

**Shared reference data:** exam packs are files in the repo. Loading one **copies** its exam, domains and objectives into the loading user's account, so every row is user-owned. No shared writable tables.

## 4. Authorization rules for app code

- Never accept `userId` or ownership claims from the client; the session decides, and RLS enforces.
- Every server action and route handler starts with `requireUser()`; unauthenticated requests get 401 before any work.
- IDs are unguessable (UUID/ULID) but not treated as secrets. No admin back door through the normal app role; the admin flag only gates invite and re-enrollment screens.

## 5. Isolation and auth tests (a CI gate, not optional)

Against a real Postgres, with two users:
- A can't read, update or delete B's rows on **every** user-owned table (generated from the schema so new tables can't be forgotten); inserting with B's `user_id` while acting as A is rejected; no `app.user_id` set → zero rows.
- **Pooled-connection leak test:** A then B on the same connection; B never sees A's context.
- A table without RLS enabled fails the build (inspect `pg_class`/`pg_policies`).
- **Role test:** `app_user` cannot read the `auth` schema; `auth_app` cannot read app tables.
- Invite token: reuse fails, expiry fails, tampering fails; registration without a token fails.
- Dev password login: unavailable under the production configuration; boot guard fires when the flag is set in production.
- **Admin separation:** the public container returns 404 for every `/admin*` path and has no `admin_app` credentials; in the admin container a request with no identity header is rejected, and one with a login that isn't on the allowlist is refused; `admin_app` cannot read app tables directly.
- Account deletion by an admin removes every app row for that user and nothing for anyone else.
- Importing a file or loading a pack as A creates nothing visible to B.

## 6. Pre-exposure checklist (applies from the day anyone else uses it)

☐ Only TCP 443 (and 80 if your proxy needs it for certificates) forwarded; the app is on its own Docker network with no route to your other services · ☐ `study.codycodez.com` set as rpID/origin before any real enrollment · ☐ registration closed, invites single-use and expiring · ☐ production env has **no** `ALLOW_DEV_PASSWORD_LOGIN` (boot guard verified) · ☐ ≥ 2 passkeys required per account · ☐ proxy: HTTPS + HSTS, security headers incl. CSP, request-body limits, stricter rate limits on `/api/auth/*` and invite routes, `X-Forwarded-For` overwritten · ☐ app rate limiting on and database-backed · ☐ cookies HttpOnly/Secure/SameSite set explicitly · ☐ four DB roles in place (owner, auth_app, app_user, admin_app), app role not owner/superuser/BYPASSRLS · ☐ isolation and auth tests green, including account-deletion cascade · ☐ Postgres not exposed to any network but the app's · ☐ public container returns 404 for `/admin*` and holds no `admin_app` credentials · ☐ admin container reachable only over the tailnet with Funnel off; a missing or forged identity header is rejected · ☐ audit log working · ☐ image, proxy and dependency updates scheduled · ☐ backup restored once · ☐ break-glass CLI tested · ☐ router/ISP check: no other port forwards to the app host.

## 7. Unverified (checked in the T-006 spike)

Better Auth from plain JavaScript; whether a passkey-first user can exist without an email; where exactly `rpID`/`origin` are configured when using `@better-auth/passkey` (the docs list the options but show no example placing them); database-backed rate-limit storage and per-path rules; migration via the CLI with a raw `Pool`; SimpleWebAuthn's current maintenance status (my search returned nothing on it); Tailscale Serve's identity-header behavior and the Docker sidecar configuration (from third-party summaries of Tailscale's docs); whether foreign-key cascades delete app data correctly under RLS for admin account deletion.
