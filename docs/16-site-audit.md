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

## Backlog, by value

**Study experience**
1. **Mock flags are lost on refresh.** Flags in the mock runner are client state only. Store them with the response (`response.flagged` exists) or as a session field.
2. **Trends on History** (T-076): accuracy by domain over time, and time per question. The data is already recorded.
3. **Objective detail:** an attempts-over-time sparkline (F07).
4. **Dashboard activity chart** has no day labels; hovering a bar shows nothing.
5. **"New question" form** in the Library, reusing the editor (T-025).
6. **Auto-unflag** after three correct answers in a row, as a setting (F09).

**Content**
7. **CLF-C02:** 282 approved, reviewed against guide v1.3 (2026-11-08). Next: re-check the guide's revisions page before each content pass.
8. **DVA-C03:** 123 approved questions and a `style.md` (2026-11-08). Next: grow each objective toward its target of about 19 to 26.

**Polish**
9. **Account:** the Sign out button sits loose between cards; put it in the Passkeys or Devices card.
10. **Import page:** it points people to `docs/04-content-format.md`, which users can't see on the site. Link to an in-app format page, or show a short example.
11. **Global bar:** the account link ("Dev User") has no active state on the Account page.
12. **Theme lab** (T-013) and two more themes (Atlas, Soft modern), with design notes.

**Production**
13. **CSP with nonces** in the app. The proxy already sends HSTS (`max-age=63072000; preload`) and a frame/base/form CSP. To join the browser preload list, the header also needs `includeSubDomains`, and every subdomain must serve HTTPS. Otherwise drop `preload`.
14. **Backups:** a nightly `pg_dump` and one restore drill before inviting anyone (doc 15 §6).
15. **Remove the temporary sudo** for `deploy` on the LXC.

Done since the audit (2026-11-02): HSTS at the proxy, and the admin site checked from the tailnet with the admin account created.
