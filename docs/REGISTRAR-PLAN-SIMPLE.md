# Registrar Desk — Simple Plan & Solution

**E-zentra | Mati School of Arts and Trades**
**For:** Registrar, school staff, and anyone non-technical
**Date:** October 5, 2026
**Scope:** Registrar pages on the website (Overview, Accounts, Final Grades, SF10, Adviser Access, Subjects & Sections)

---

## TL;DR (read this in 30 seconds)

The registrar pages will soon **update by themselves — no refresh needed**.

- Approve a student and they disappear from Pending instantly.
- When something needs you (new sign-up, adviser request, finals ready, SF10 to validate), a **clear pop-up appears in about 5 seconds** and the bell count goes up.
- Every list shows **15 rows per page**, the same everywhere.
- Messages are **specific**, never just "New notification".

Example: instead of "New notification", you will see **"New G11 sign-up: Juan Dela Cruz — awaiting approval."**

---

## 1. The problems we are fixing

| # | What you feel today | Why it happens |
|---|---|---|
| 1 | You have to refresh to see new data. | Registrar pages have no live listener yet. Other desks (teacher, nurse, guidance) already have one. |
| 2 | Approve feels slow — the row stays until reload. | The screen waits for the server before updating. |
| 3 | Pages show different counts (8 here, 20 there, 100 loaded at once). | No standard page size. Some pages load everything then slice it. |
| 4 | Pop-ups say "New notification" — not helpful. | No registrar-specific message titles yet. |
| 5 | Sometimes you see old data after someone else changes something. | Memory (cache) is cleared too broadly or not at the right time. |
| 6 | You are not notified when advisers request SF10 access or finals become ready. | The system notifies the adviser, but not the registrar in reverse. |

Nothing is broken beyond repair — the building blocks already exist. We just need to connect them for the registrar desk.

---

## 2. What you will notice after the fix

1. **Instant buttons.** Tap Approve / Reject / Validate / Release and the row updates immediately. If it fails, it undoes itself and tells you why.
2. **Live pages.** Open two windows: approve in one, watch the other update + pop-up in about 5 seconds. No refresh.
3. **Bell that works.** The bell icon in the top bar shows unread count, opens recent items, and "View all" for the rest. Tapping an item takes you to the right page.
4. **Always 15 per page.** Accounts, Final Grades, SF10, Access Requests, Audit — all 15. Page buttons keep your place when you go Back.
5. **Clear pop-ups (sileo).** Each pop-up names who + what + where. Missed pop-ups stay in the bell.

---

## 3. The solution in plain language

### A. Live updates (no refresh)

Think of it like a messenger: the registrar screen "listens" for new inbox letters every 5 seconds, plus a bonus instant channel when available.

- First check only remembers what you already saw (so no flood of old pop-ups).
- New letters after that pop up (max 3 at a time, oldest first).
- Every pop-up also refreshes the right list quietly in the background.
- When you return to the tab, it checks immediately.

Technical note for developers: clone of `teacherChannel.ts` — 5s auth-gated `GET /api/notifications/` poll is the real transport (Supabase anon Realtime cannot see backend-JWT rows), Supabase channel is bonus, `seenIds` dedup, 2-second invalidate throttle, refetch on focus.

### B. Fast buttons (optimistic UI)

1. You tap → screen updates instantly (row removed / badge flips).
2. App sends the request in the background.
3. If success → small success message + lists re-check quietly.
4. If fail → change is undone + clear error message.

Your own tap never causes a duplicate pop-up — the system suppresses its own echo for 30 seconds but still updates lists and the bell.

### C. Smart memory (caching, 2 layers)

- **Server memory (Redis, 30 seconds):** Going Back feels instant. Keyed by page + filters + your role + school year/term, so teachers never see each other's data and Term 1 never shows as Term 2.
- **Screen memory (React Query, 30 seconds):** Moving between tabs shows cached data instantly, no flashing.
- **Correct clearing:** Every Approve / Validate / Release clears only the affected memory (e.g. approve student clears Accounts + Overview, not everything).

New narrow tags: `registrar-overview`, `registrar-finals`, `registrar-accounts`, `registrar-sf10`, `registrar-access`, `registrar-academics`.

### D. 15 per page, everywhere

- Default `pageSize = 15`, server-paginated. Overview cards show first 5 + "View all" link to the full 15-paged page.
- Page turns keep old data on screen while loading the next page (no skeleton flash).

### E. Notifications that tell you exactly what happened

The system will now notify the **registrar** (not just the adviser) when:

| Event | Who tells registrar | Example message |
|---|---|---|
| New G11/G12 student signs up | Sign-up form | New G11 sign-up: Juan Dela Cruz (LRN 123456789012) — awaiting approval. |
| Adviser requests SF10 access | Adviser request form | SF10 access requested: Adviser Ana Reyes — 11-Bayanihan (23 advisees). |
| All subjects adviser-approved for a student-term | Grade pipeline | Finals ready: Maria Santos (11-Bayanihan) — Term 1, all subjects approved. |
| SF10 verified, needs validation | Teacher verify | SF10 verified: Ana Lim (G12) — needs validation. |
| SF10 released / validated | SF10 flow | SF10 released: Jose Rizal (G11) — ready. |

Pop-up titles match bell titles exactly (one shared mapper), derived from the message — never generic.

Examples of titles: "New student sign-up", "SF10 access requested", "Finals ready for review", "SF10 needs validation", "Academics updated".

---

## 4. What stays safe

- **Grade band:** Registrar only ever sees G11–G12. Record Keeper sees G7–G10. Same code, scoped by role.
- **View-only finals:** Registrar never approves grades — only views fully adviser-approved sets. That rule does not change.
- **Audit trail:** Every Approve / Validate / Release / Create still writes an audit row (who, what, when, why).
- **Confidentiality:** No clinical write-ups are exposed. Principal status-only rule unchanged.
- **No spam:** Same event within 60 seconds with identical message never creates a second inbox row. Parallel saves are locked so double-clicks do not double-create.

---

## 5. Work plan (in order)

1. **Backend tells registrar** — add 4 fan-outs (sign-up, access-request created, finals-ready once per student-term, SF10 verified) + message templates + notification types.
2. **Live listener + bell** — new `registrarChannel.ts`, mount in registrar layout, add bell to top bar with deep links.
3. **15 per page** — fix Accounts (8 → 15), Final Grades (100-fetch/20-slice → server page 15), SF10, Access, Audit; cap Overview previews to 5.
4. **Instant buttons** — optimistic Approve/Reject, Access Approve/Deny, SF10 Validate/Release, Subject/Section/Assignment create/edit/delete with rollback.
5. **Narrow cache clearing** — replace broad `registrar` tag with per-resource tags.
6. **Test** — two-window live check (tap in one, see it in the other in ~5s, no refresh) + automated tests for fan-out, dedup, paging + check `x-cache: HIT/MISS`.

---

## Appendix A — For developers (files to touch)

**Backend**

- `src/lib/notify.ts` — add `TYPE_MAP`: `users:pending_signup → account_pending`, `adviser_sf10_access_requests:create → sf10_access_requested`, `final_grades:adviser_approved → finals_ready`, `sf10_records:verified → sf10_needs_validation`. Use `fanoutToRole("registrar", { messageFor })`, `void` after `res.json`.
- `src/modules/auth/auth.routes.ts` — fan-out on G11–G12 student sign-up; add `page/pageSize` to pending list.
- `src/modules/registrar/registrar.routes.ts` — clamp `final-grades pageSize` max 15; `accounts-audit` default 15; overview `latestAttachments take 100 → 5`, cap `missingSf10`/`pendingStudents` previews to 5; narrow `cache()` tags + `invalidateTags()` per write.
- `src/modules/registrar/academics.routes.ts` — narrow tags; keep band guard `GRADE_BAND = [G11, G12]`.
- `src/modules/sf10/sf10.routes.ts` — fan-out on verify (to registrar/record_keeper by band); narrow invalidates on validate/release.

**Frontend**

- NEW `src/lib/realtime/registrarChannel.ts` — mirror `teacherChannel.ts` structure; `REGISTRAR_KEYS = [registrar-overview, registrar-final-grades, pending-students, account-breakdown, accounts-audit, registrar-sf10, registrar-access, registrar-notifications]`; `FALLBACK_POLL_MS = 5000`, `MAX_TOASTS_PER_POLL = 3`, `markSelfNotified()` + 30s suppress.
- `src/app/registrar/layout.tsx` — mount `useRegistrarRealtime()` + add `NotificationsBell` (`queryKey=["registrar-notifications"]`, `resolveTarget`: pending → `/registrar/accounts`, finals → `/registrar/final-grades`, access → `/registrar/adviser-access`, SF10 → `/registrar/sf10`).
- `src/lib/notifications/label.ts` — add shared registrar title mapper so bell and sileo match.
- `src/app/registrar/accounts/page.tsx` — `PAGE_SIZE 8 → 15`, queryKey `["pending-students", page]`, server `page` param, `placeholderData: keepPreviousData`, optimistic approve/reject.
- `src/app/registrar/final-grades/page.tsx` — send `page + pageSize: 15` (stop fetching 100), queryKey includes page, remove client 20-slice.
- `src/app/registrar/sf10/*`, `adviser-access/*`, `AccountsAudit` — same 15 pattern + optimistic validate/release/approve/deny.
- `src/components/providers.tsx` — no change needed (staleTime 30s already correct).

**Verify:** `vitest` (fan-out, 60s dedup, paging clamp), manual two-tab check, `x-cache` header check, bell deep-link check.

---

## Appendix B — Copy-paste build prompt for AI

> Implement the Registrar realtime plan in E-zentra. Constraints: strict pageSize 15 everywhere (server-paginated: registrar/final-grades clamp max 15, accounts-audit default 15, auth/pending add page/pageSize, overview previews take 5); narrow backend cache tags (registrar-overview/finals/accounts/sf10/access/academics) with matching invalidateTags on writes; new frontend lib/realtime/registrarChannel.ts cloning teacherChannel.ts (5s auth poll + Supabase INSERT channel, seenIds dedup, max 3 toasts/poll, 2s invalidate throttle, focus refetch) mounted in app/registrar/layout.tsx plus NotificationsBell with role-scoped resolveTarget; backend fan-outs TO registrar (signup, access-request create, finals-ready once per student-term, SF10 verified) with specific messages via fanoutToRole + messageFor, TYPE_MAP entries, void-after-response, 60s dedup respected; specific-always sileo/bell titles via shared toastTitleForRegistrar (message-regex, never generic); optimistic TanStack mutations (onMutate setQueryData + rollback + markSelfNotified self-suppress + onSettled narrow invalidates) for approve/reject, access approve/deny, SF10 validate/release, subject/section/assignment CRUD. Keep grade-band scoping (registrar G11–G12), termScope in keys, existing design system. Verify with vitest + two-tab live check, no manual refresh.

---

*End of report. Questions? Start with Section 2 (what you will notice) — everything else is how we get there.*
