# 16 — Site audit (2026-11-02)

A walk through every page on the local dev build: desktop, phone width (375 px), and light and dark modes. Each finding below is either fixed in this pass or ranked in the backlog.

## Fixed in this pass

| Where | Problem | Fix |
|---|---|---|
| Library → Questions | The search box had no outline. `Input`, `Select` and `Textarea` replaced their base styles whenever a page passed a `className` (here a grid span), so the border vanished. | The base classes always apply, and a passed class adds to them. All controls also gained a hover border and a visible focus ring. |
| Library → Questions | "Flagged only" was a bare browser checkbox. | New `CheckChip`: a real checkbox styled as a toggle chip with a custom checkmark. Its accent border and fill follow the checked state, with a focus ring. |
| Library tabs | Nothing showed which tab you were on. | `LibraryTabs` (client) highlights the current tab. Question pages count as Questions, and prompt pages count as Coverage. |
| Import, Account → restore | The file pickers used the browser default ("Choose File / No file chosen"). | Shared `fileInputClass` styles the picker button like a secondary button. |
| Account | Theme radios and the confidence checkbox were plain browser controls. | Shared `optionCardClass` highlights the selected card; `checkClass` colors the boxes with the theme accent. The download link uses the standard button style; it had referenced a `bg-raised` hover by hand. |
| Practice setup | You couldn't tell how many questions a scope had until you started, and empty scopes failed with an error. | Every scope shows its count of approved questions. Flagged, missed, unseen and empty objectives are disabled when they have none. |
| Courses | "65 questions" was the exam's length, which read like the practice bank. | The stats are now "65 on the exam", minutes, objectives and the shared bank's size ("Soon" when a pack has no bank). |
| Unknown URLs | The default Next.js 404 (black page, white text). | A themed `app/not-found.js` with links to the dashboard and courses. It also explains that another account's records look the same as missing ones. |

## Done since (2026-11-10)

- **Mock exam flags** are saved on the session (`session.config.reviewFlags`), so they survive a refresh, and the results page's Flagged filter includes them.
- **Trends on History:** weekly accuracy per domain (sparklines on a shared, data-fitted range), the time-per-question distribution, and the median time per week.
- **Objective detail:** weekly accuracy for the objective over the last 8 weeks.
- **Dashboard activity chart:** a weekday letter under each bar, the start date and Today, and a tooltip per day on hover or keyboard focus.
- **New question form** (Library → New question, and Write a question on objective pages). It reuses the editor, follows the exam's option rules and runs the import checks.
- **Polish:** Sign out moved into the Devices card; the import page links to an in-app format page with an example built from the course's own codes; the account link is marked on the Account page.
- **CSP with nonces:** `proxy.js` sends a per-request script nonce with `'strict-dynamic'`; everything else is same-origin.
- **Content:** CLF-C02 is still on guide v1.3 (checked 2026-11-10). DVA-C03 is at its coverage target on every objective.

## Backlog, by value

**Study experience**
1. **Auto-unflag** after three correct answers in a row, as a setting (F09).

**Polish**
2. **Theme lab** (T-013) and two more themes (Atlas, Soft modern), with design notes.

**Production**
3. **HSTS preload:** to join the browser preload list, the header also needs `includeSubDomains`, and every subdomain must serve HTTPS. Otherwise drop `preload`.
4. **Backups:** a nightly `pg_dump` and one restore drill before inviting anyone (doc 15 §6).
5. **Remove the temporary sudo** for `deploy` on the LXC.

**Content**
6. **SAA-C03:** the blueprint is in (guide v1.1); draft the first questions, about 260 to reach the target.
7. **Every pack:** re-check each guide's revisions page before every content pass (CLF-C02 v1.3, DVA-C03 unrevised and SAA-C03 v1.1 as of 2026-11-10).

Done since the audit (2026-11-02): HSTS at the proxy, and the admin site checked from the tailnet with the admin account created.
