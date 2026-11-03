# 14 — Plan: question bank, homelab, study screens, themes (2026-11-02)

Follows the gap assessment of 2026-11-02. Four tracks; track 3 can start now, tracks 1 and 2 need answers from you (section 5). Homelab setup steps are in [15-homelab-lxc-setup.md](15-homelab-lxc-setup.md).

## 1. Question bank, hosted on the homelab

**The problem to solve first.** Questions are per user today: every row carries `user_id` under RLS, so a bank you approve in your account is invisible to anyone you invite. Moving to the homelab doesn't change that by itself. Before scaling content, we pick how other users get the bank.

| Option | How it works | Trade-off |
|---|---|---|
| **A. Pack bank in git (recommended)** | Approved questions live in `content/<pack>/bank/*.json`, committed. On *Start studying*, and on each deploy for enrolled users, the app copies the pack's bank into the user's exam, matching on the question `id` (insert new, update changed, retire removed). Each user's copy stays per user, so RLS, stats and isolation are untouched. | Git is the master copy; the homelab DB holds each user's copy. Fixing a question means edit, export, commit, redeploy. |
| B. Shared bank in the DB | New `bank_question` table readable by every user, writable only by the owner; practice and stats reference shared ids. | Real schema change: new RLS rules, every query that joins questions changes, and the isolation suite grows. More machinery than a personal tool needs. |

With A, your workflow is: draft (Prompt page) → `content:lint` → blind check → import into **your** account (local or homelab) → review in Drafts → *Export approved* → save the file into `content/<pack>/bank/` → commit → deploy. Everyone enrolled gets it.

**Steps (A):**
1. You review the pilot batch (`content/clf-c02/questions/2.1-2026-11-01.json`) and tell me what to change in style or format. I update the prompt and lint rules.
2. Build pack-bank sync: `lib/db/bank.js` (`syncPackBank(db, examId, bank)`), called from `enrollInPack` and from a `npm run bank:sync` step in the deploy (runs per user through `withUser`). Questions removed from the bank become `rejected` with reason "retired from bank", so answer history stays. Tests: insert, update, retire, user isolation, your own private imports untouched.
3. Mark bank questions as `source: bank` (read-only in the editor for other users; you edit the file, not the row).
4. Scale up one objective at a time, highest-weight domains first (Domain 3, Cloud Technology and Services, 34%). About 10 per batch. Target order: 10 approved in every objective (practice-ready), then 130 in total (mock-ready), then 260.
5. Blind check each batch with a separate agent before you review it.

## 2. Production on the homelab

Full instructions: [doc 15](15-homelab-lxc-setup.md). Summary:

- **One unprivileged Debian 13 LXC** on Proxmox (2 cores, 4 GB RAM, 512 MB swap, 32 GB disk, static IP), running Docker and the existing `docker-compose.yml` (db, web, admin + Tailscale sidecar).
- **Your existing nginx** keeps terminating HTTPS for `study.codycodez.com` and proxies to `<LXC IP>:3000`. Nothing else in the homelab can reach the LXC; the LXC can reach nothing in the homelab.
- **Firewall at the Proxmox level** (Docker bypasses ufw for published ports): inbound only 3000 from the nginx host and 22 from your admin machine.
- **Admin site** over Tailscale only, from the sidecar container.
- **Backups:** nightly `pg_dump` with 14-day retention onto a disk outside the LXC, plus a Proxmox backup of the container; one restore drill before inviting anyone.

App work in this track (I do this):
1. **Deploy scripts:** `scripts/deploy.sh` (pull, build, migrate, bank sync, restart, health check) and `scripts/backup.sh` + systemd timer files under `deploy/`.
2. **Health endpoint** `/api/health` (DB reachable, no data) for the deploy check.
3. **CSP with nonces** in `proxy.js` and remaining security headers in the app (nginx keeps HSTS and rate limits).
4. **CI:** a GitHub Actions workflow running lint, tests (with a Postgres service), `pack:validate` and `content:lint` on every push.
5. **Pre-exposure checklist** ([doc 11 §6](11-auth-and-tenancy.md)) run on the live box, with results recorded in doc 13.
6. **First real account** via `create-user.mjs`, real passkeys on your devices (two each), then the admin site check over Tailscale.

## 3. Study-screen gaps (can start now)

In this order:
1. **Keyboard shortcuts** in practice and mock runners: 1–9 pick, Enter submit/next, F flag, N note, `?` cheat-sheet.
2. **Bookmarks** (the table already allows them) next to the flag in runners and question pages.
3. **Mistakes & Flagged** page in Library: missed (last attempt wrong), flagged, bookmarked; filters by domain/objective; *Practice these*.
4. **Answer review filters** (incorrect / flagged / unanswered / slow) and mock time stats (average and slowest per question).
5. **Confidence chip** (guess / unsure / sure) before submit, setting to hide; stored on responses; shown in review.
6. **Question history** page: every attempt on one question, linked from review and the library.
7. **Library filters**: type, source, tag, flagged; **New question** form (reuses the editor).
8. **Objective detail:** attempts-over-time sparkline. **Trends** on History: accuracy by domain over time.
9. Smaller items: auto-unflag after 3 correct in a row (setting), time counted only while the tab is visible, "keep both" on duplicate import, pack-reload diff (T-011).

Left out on purpose: manual exam creation and the domain/objective editor (packs are the framework), Markdown import format, CSV export.

## 4. Theme and design system

1. **Theme preference stored per user in the DB** (new `user_pref` row, RLS like every other table). The cookie remains as a cache so the first paint is right; signing in on a new device picks up your choice. Done after the homelab is live, so the migration runs there once.
2. Lint rule banning raw colors (`bg-[#…]`, `text-[13px]`) in components.
3. `/dev/theme-lab` (dev builds only) with real objective names and a phone-width toggle.
4. Atlas and Soft modern themes, then design notes per theme in `docs/design-notes/`.

## 5. What I need from you

Answered 2026-11-02:

- **Bank:** option A. Approved questions in git are a baseline for every user; a user's own uploads stay theirs. Built (doc 13, revision 4).
- **Review:** Claude reviews and approves batches after checking the sources and running a blind check with a separate agent.
- **Hosting:** Proxmox. CT 104 at `192.168.86.227` runs the app. nginx runs in a different LXC on the same host, and you'll configure it. The LAN and firewall are already set up on your side. No backups for now. Time zone: Eastern (`America/New_York`).
- **Code:** GitHub `CodyHanna04/cert-prep` (public), cloned to `/srv/certprep` on the LXC.
- **Access:** Claude has SSH to the LXC only (`deploy` user, a dedicated key, temporary sudo) and must ask before touching the Proxmox host.
- **Tailscale:** you sign in to the sidecar from the login link it prints.

## Order

Track 3 now → you review the pilot → track 1 step 2 (bank sync) → track 2 once the LXC exists → scale content → track 4.
