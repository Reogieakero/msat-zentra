# Nurse Role — Live Notification Audit

> Audit date: 2026-10-19 · Scope: **Nurse role only** · Type: read-only audit (no code changed)

> **Implementation status (2026-10-19):** Phases 1–2 of the fix plan are built.
> Phase 3 (live-feed RLS lockdown) code is also built, but is **opt-in** — it
> activates only after the Supabase project JWT secret is aligned with the
> backend secret. See "Implementation status" at the end of this file.

## What this audit covers

Does the Nurse see the notification badge and a new notification message **instantly, without refreshing**, whenever something happens that the Nurse should know about? And does the right person get notified when the Nurse acts? This report checks every page and feature the Nurse can use.

---

# PART 1 – Simple Summary

Yes — the Nurse role is fully built and live notifications do work today. The Nurse gets a bell on every page, and when a teacher, counselor, or coordinator sends a case to the clinic, the bell number goes up and a message appears within a few seconds without refreshing. Bookings, moves, cancellations, completions, follow-ups, and the Nurse's own actions all create saved notifications that stay in the list after logging out and back in. The main gaps are: the Nurse is not told what happens to an ADM case *after* the Nurse endorses it to the coordinator, appointment reminders only pop up about 5 minutes before the time, and one privacy concern — the saved notification wording can include the referral reason (which may contain health details), and the live channel is not locked down as tightly as it should be.

---

# PART 2 – Nurse Page and Feature List

| Page or feature | How the Nurse gets there | What the Nurse can do there | Should it notify the Nurse? |
|---|---|---|---|
| **Overview** (`/nurse/overview`) | Menu → Overview | View clinic dashboard, KPIs, latest referred students; quick "start handling", forward ADM | Yes (receives notices about cases the Nurse handles) |
| **Alerts** (`/nurse/alerts`) | Menu → Alerts | View all referred cases; accept, book session, reschedule, cancel, complete, add follow-up note, resolve, request info, escalate, dismiss, forward ADM, complete referral form | Yes (these are the Nurse's own actions; the filing teacher is notified) |
| **ADM Cases** (`/nurse/referrals/adm`) | Menu → Referrals → ADM Cases | Review ADM consultations picked for the Nurse; endorse/reject, complete referral form, book a session | Yes |
| **Clinic Matters** (`/nurse/referrals/clinic`) | Menu → Referrals → Clinic Matters | Same case actions, clinic-only view (kanban board) | Yes |
| **Health Records** (`/nurse/health-records`) | Menu → Records → Health Records | View only — finished sessions / resolved cases shown as record cards | No (view only) |
| **Referrals Report** (`/nurse/adm`) | Menu → Insights → Referrals Report | View only — trends, insights, risk watch | No (view only) |
| **General Settings** (`/nurse/settings`) | Menu → Settings → General Settings | View/edit own name, colors, mascot, photo, password | No |
| **Notifications bell** (top bar) | Always visible on every Nurse page | See unread count, open list, mark read, click through to a record | — (this is the receiver) |
| **Booking reminder pop-ups** | Appears automatically on the Nurse desk | See upcoming/overdue sessions and jump to the case | Yes (appears for the Nurse automatically) |

**Page address that redirects:** typing `/nurse` sends the Nurse to Overview; `/nurse/referrals` sends them to ADM Cases. Both are real and working.

**Features that could not be found:** there is no medicine/supply log, no visit log separate from the clinic sessions, no clearances, and no messaging/mailbox for the Nurse. If these are supposed to exist, the expected screen would need to be identified.

---

# PART 3 – Workflow Map

### Job A — A teacher/staff member sends a referral to the clinic
1. **Teacher** files an anecdotal record and chooses "refer to clinic."
2. **Teacher** → referral is created → **the Nurse is notified** ("…… referred [student] to the clinic: [reason]").
3. **Teacher** also gets their own confirmation row.
4. **Nurse** sees it in Alerts / Clinic Matters.

### Job B — Guidance sends a case to the clinic
1. **Guidance Counselor** reassigns or escalates a case to the Nurse.
2. **Guidance** → Nurse is notified ("…… reassigned/escalated [student] to you").
3. **Nurse** sees it in the queue.

### Job C — Nurse handles a clinic case
1. **Nurse** accepts the case (optionally books the first session).
2. **Nurse** → **the filing teacher is notified** ("The clinic accepted your referral …").
3. **Nurse** books / reschedules / cancels / completes sessions.
4. **Nurse** → **the filing teacher is notified** of each session change.
5. **Nurse** resolves, requests info, sets follow-up, escalates, or dismisses.
6. **Nurse** → **the filing teacher is notified** of the outcome.

### Job D — ADM consultation review (Nurse as reviewer)
1. **Teacher** files an ADM referral and picks the **Nurse** as the consultation reviewer.
2. **Teacher** → **Nurse is notified** ("New ADM referral needs consultation review …").
3. **Nurse** reviews, completes the referral form, endorses (forward) or rejects.
4. **Nurse** → **the ADM Coordinator is notified** when endorsed; **the filing teacher is notified** of the outcome.
5. **Coordinator** runs parent meetings → certification → **Principal** signs → completion.
6. **Notice gap:** at these later steps only the **filing teacher** and **Coordinator** are notified — **the Nurse is not notified.** (See Part 5.)

### Job E — Session life cycle
1. **Nurse or Guidance** books/moves/cancels/completes a session.
2. **Actor** → **the filing teacher is notified**; on an ADM case still with the Nurse, **the Nurse is notified**.
3. If the session involves a person invited to it, **invitees are notified**.

### Job F — Upcoming appointment reminders
1. The Nurse desk checks the Nurse's upcoming sessions automatically.
2. When a session is within **5 minutes** of its time, a pop-up appears for the **Nurse**; overdue ones also show.

---

# PART 4 – Action List by Page

| Page | What the user does | Who does it | Who should be notified | Example message | Badge live? | Row live? | Click opens record? |
|---|---|---|---|---|---|---|---|
| Clinic/teacher intake | Files a referral to the clinic | Teacher | Nurse | "…… referred [student] to the clinic: [reason]." | Yes | Yes | Yes |
| Guidance | Reassign to clinic | Guidance | Nurse | "…… reassigned [student] to you." | Yes | Yes | Yes |
| Guidance | Escalate to clinic | Guidance | Nurse | "…… escalated [student] to you." | Yes | Yes | Yes |
| ADM review | Pick Nurse as reviewer | Teacher | Nurse | "New ADM referral needs consultation review — [student]." | Yes | Yes | Yes |
| Alerts / Clinic | Accept case | Nurse | Filing teacher (+ Nurse's own row) | "The clinic accepted your referral for [student] — now in progress." | Yes | Yes | Yes |
| Alerts / Clinic | Book session | Nurse | Filing teacher (+ own) | "…… (Clinic) booked a session for [student] (individual, [date] at [venue])." | Yes | Yes | Yes |
| Alerts / Clinic | Reschedule session | Nurse | Filing teacher (+ own) | "Clinic rescheduled a session for [student] — now [new] (was [old])." | Yes | Yes | Yes |
| Alerts / Clinic | Cancel session | Nurse | Filing teacher (+ own) | "Clinic cancelled a session for [student] (……)." | Yes | Yes | Yes |
| Alerts / Clinic | Complete session | Nurse | Filing teacher (+ own) | "Clinic completed a session for [student] (……)." | Yes | Yes | Yes |
| Alerts / Clinic | Complete + set follow-up | Nurse | Filing teacher (+ own) | "Clinic set a follow-up for [student] — next session [date]." | Yes | Yes | Yes |
| Alerts / Clinic | Resolve / request info / dismiss | Nurse | Filing teacher (+ own) | "Clinic resolved your referral for [student] — case closed." | Yes | Yes | Yes |
| Alerts / Clinic | Add/remove session photo | Nurse | Filing teacher (+ own) | "Session documentation was added/removed for [student]." | Yes | Yes | Yes |
| Alerts / Clinic | Delete a cancelled session | Nurse | Filing teacher (+ own) | "A session for [student] was deleted." | Yes | Yes | Yes |
| ADM review | Complete referral form | Nurse | Filing teacher (+ own) | "The clinic completed the referral form for [student] — ready to forward." | Yes | Yes | Yes |
| ADM review | Endorse / forward to coordinator | Nurse | Coordinator (+ filing teacher, + own) | "…… endorsed the ADM consultation for [student] — sent to you." | Yes | Yes | Yes |
| ADM review | Reject (not endorse) | Nurse | Filing teacher (+ own) | "Your ADM referral for [student] was not endorsed — case closed." | Yes | Yes | Yes |
| Overview | Forward ADM / accept quick actions | Nurse | Same as above | (same messages) | Yes | Yes | Yes |
| Health Records | View only | Nurse | No one | — | — | — | — |
| Referrals Report | View only | Nurse | No one | — | — | — | — |
| Settings | Edit own profile | Nurse | No one | — | — | — | — |
| Nurse desk | Upcoming session reminder | System | Nurse | "…… upcoming one-on-one meetup, today at 10:00 · School clinic" | N/A | Yes (pop-up) | Yes |
| ADM meetings | Coordinator books a parent meeting the Nurse is invited to | Coordinator | Invitees incl. Nurse | "…… invited you to a parent meeting for [student] on [when]." | Yes | Yes | Yes (opens ADM Cases) |
| Teacher withdraws referral | Cancel referral to clinic | Teacher | Nurse | "A referral to your desk was withdrawn by the filing teacher — [student]." | Yes | Yes | Yes |

**Bell visibility:** the bell is on **all** Nurse pages (it lives in the shared top bar).

### Live update check (answers to the six questions)

| Question | Answer |
|---|---|
| Does the badge go up instantly, without refreshing? | **Yes** (live channel; a safety poll catches it within ~5 seconds) |
| Does a new message row appear instantly? | **Yes** (same channel + poll) |
| Does the badge go down when the Nurse reads a notification? | **Yes** |
| Does it still work if the Nurse is on a different page? | **Yes** — the bell and live channel live on the shared shell, so every page is covered |
| Are notifications saved for after logout/login? | **Yes** — they are stored in the database and reloaded on login |
| Does clicking a notification open the right record? | **Yes** for referrals, sessions, ADM cases, and meetings; a few notice types open nothing (see Part 5) |
| Do upcoming-appointment reminders appear on time? | **Partly** — only when the appointment is within ~5 minutes; not earlier |

---

# PART 5 – What's Missing or Broken

1. **High — Nurse is not told what happens to an ADM case after the Nurse endorses it.** Once the Nurse forwards a case to the ADM Coordinator, the Coordinator runs meetings, certification, and Principal signing — but only the filing teacher and the Coordinator get those messages. *Why it matters:* the Nurse opened the consultation and may need to know the outcome (meeting held, signed, closed). Today the case simply "goes quiet" from the Nurse's side.

2. **High (privacy) — notification wording can carry sensitive detail, and the live channel is not locked down.**
   - The message includes the referral **reason** (up to about 100–120 characters), which can describe a health or behavioral concern. A student name plus a simple status would be safer.
   - The live feed runs on the app's public key with no per-row access rule on notifications, so a technically skilled person could listen to the feed and see notification text meant for others. *Why it matters:* health information is sensitive, and a notification list is easy to read.

3. **Medium — appointment reminders only appear about 5 minutes before the session.** The reminder panel wakes up when the appointment is within 5 minutes, and checks every 30 seconds. *Why it matters:* a Nurse who steps away may miss the heads-up; an earlier reminder (for example 15–30 minutes) would help.

4. **Medium — reminders and the live bell only run while the Nurse is logged in and the tab is open.** If the Nurse closes the app, nothing "pushes" to them. The messages are saved and will be there on return, but the "instant" part needs the app open. *Why it matters:* expectations should match reality for a busy clinic.

5. **Low — the bell number can undercount when there are many unread.** The bell counts unread items within the first page of notifications (about 15). If the Nurse has more than 15 unread, the little number may not show the true total. *Why it matters:* minor — the rows are still all there.

6. **Low — if a school has more than 10 nurses, only the first 10 would be notified** for some "notify the Nurse" actions. *Why it matters:* only relevant to larger clinics.

7. **Low — some notification rows don't open a record.** Health/unknown item types just get marked read when clicked. Referrals and sessions do open correctly.

**Privacy — who can see what:** the Nurse's *pages* are correctly limited. The Nurse only sees cases referred to the clinic, escalated to the clinic, or ADM cases where the Nurse is the chosen reviewer, and only for the active term. That part is good. The concern is only the notification wording and the live feed (item 2 above), not the page lists.

---

# PART 6 – Suggested Fix List

1. **Notify the Nurse about ADM case outcomes after endorsement** — add notifications to the Nurse reviewer when the meeting is booked, when certification is done, when the Principal signs, and when the case completes. **Medium.**
2. **Trim the message text** so notifications show a student name + short status, and keep the fuller reason inside the record only. **Small.**
3. **Tighten the live feed** so each person can only receive their own notifications (add a row-level rule, and switch the app to authenticate with that rule in mind). **Medium–Big** (needs a careful rollout and testing).
4. **Make reminders earlier** — show the pop-up, say, 15–30 minutes ahead, and keep the overdue styling. **Small.**
5. **Make the bell number count all unread**, not just the first page. **Small.**
6. **Raise the "notify the Nurse" limit** if the school can have more than 10 nurses. **Small.**
7. **Give a link target** to the few notification types that currently open nothing. **Small.**

---

# PART 7 – Easy Test Checklist

1. Open the app as **Nurse** in one browser window. Leave it on **Overview**.
2. In a second window, log in as a **Teacher**, open an anecdotal record, and **refer the student to the clinic**.
3. Look at the Nurse window **without refreshing**. Did the **bell number go up**? Did a **new message row** appear?
4. Click the bell, then click the message. Did it open **that exact case** (Clinic Matters)?
5. Did the number go **down** after reading?
6. Now, in the Nurse window, open the **Alerts** page. From the second window (Teacher), **cancel the referral**. Back on Alerts, did a new message appear **without refreshing**, even though you were on a different page?
7. As the Nurse, **accept the case** and **book a session**. In the Teacher window, did the Teacher get a message about the clinic accepting/booking?
8. As the Nurse, open **Health Records** and **Referrals Report** — confirm the bell is still visible, and that nothing changes there (they are view-only).
9. **Log out** as the Nurse and **log back in**. Are the notifications still listed?
10. Book a session **5 minutes from now** on the Nurse desk. Does the **upcoming-session pop-up** appear around the right time, and does "View case" open the record?
11. For the ADM flow: have a Teacher pick the **Nurse** as the ADM consultation reviewer, then as the Nurse **endorse/forward** it. Then have the Coordinator book the parent meeting and the Principal sign — **check whether the Nurse receives anything** (this is the flagged missing part).

---

*This was an audit only — no code was changed. To action any of the Part 6 fixes, switch to a build agent.*

---

# Implementation status (2026-10-19)

Plan file: `C:\Users\jalan\.opencode\plan\nurse-notification-implementation.md`

### Phase 1 — done

| Fix | Status | Files |
|---|---|---|
| **1A** Trim the referral reason out of notification text | **Done.** Clinic/ADM/guidance referral, escalation, and ADM-consultation-endorsement fanout messages now show "name + section + status" only; the reason stays on the referral record. | `backend/src/services/anecdotal/records.refer.service.ts`, `backend/src/services/referrals/intake.service.ts`, `backend/src/services/referrals/pipeline.status.service.ts` |
| **1B** Earlier appointment reminders | **Done.** Reminder lead time widened from 5 minutes to **30 minutes**; overdue styling unchanged. | `frontend/src/components/notifications/BookingReminderStack.tsx` |
| **1C** True unread count on the bell | **Done.** New `GET /api/notifications/unread-count` returns the real total; the bell badge uses it (falls back to the first-page count if the call fails). | `backend/src/modules/notifications/notifications.routes.ts`, `frontend/src/components/notifications/NotificationsBell.tsx` |
| **1D** Link targets for dead-end notices | **No change needed** — the Nurse target mapping already routes referrals, sessions, and ADM kinds correctly. | — |
| **1E** Recipient cap (>10 nurses) | **Deferred** as agreed (school staffs ≤10 nurses). | `backend/src/lib/notify.ts` |

### Phase 2 — done

The Nurse **consultation reviewer** is now notified when the case they endorsed gets a **parent meeting booked**, is **certified**, is **signed by the Principal**, is **returned for revision**, or is **completed**. Matching bell titles/targets added so each row reads clearly and opens the ADM case.

Files: `backend/src/services/adm/profiles.progression.service.ts`, `backend/src/services/adm/meetings.booking.service.ts`, `frontend/src/lib/notifications/label.ts`.

### Phase 3 — code done, activation pending Supabase dashboard step (opt-in)

**The privacy hole:** the browser Supabase client uses the **public anon key with no Supabase login** (`frontend/src/lib/supabase/client.ts`), because the app signs its own JWTs (`JWT_ACCESS_SECRET`). Realtime `postgres_changes` on `"Notification"` currently has **no RLS**, so anyone holding the (public) anon key can subscribe and see other users' notification rows. `Referral` and the ADM tables already have `to authenticated` RLS, so they are not exposed this way.

**Why it can't be flipped on blind:** enabling RLS on `"Notification"` with a policy keyed on `auth.jwt()` makes the subscriber's role matter. With no Supabase session the browser is `anon`, so RLS would suppress live delivery for everyone. Worse, the app's own access token **cannot be reused**: it uses the JWT `role` claim for the *app* role (`nurse`, `principal`, …), whereas Supabase Realtime/PostgREST read `role` as the **Postgres** role and require `authenticated`.

**What was built (safe, opt-in — nothing changes until you activate):**
1. **Dedicated realtime token.** `signRealtimeToken()` in `backend/src/lib/jwt.ts` mints a 15-min JWT `{ sub: <userId>, role: "authenticated", aud: "authenticated" }` signed with `JWT_ACCESS_SECRET`. Served by the new `GET /api/auth/realtime-token` (`backend/src/modules/auth/auth.routes.ts`, `requireAuth`). It cannot be used as an API token (`verifyAccess` rejects the `realtime` type).
2. **Client wiring, gated by a flag.** `frontend/src/lib/supabase/client.ts` passes `accessToken` to `createBrowserClient` only when `NEXT_PUBLIC_SUPABASE_REALTIME_AUTH=true`. Off (default) the socket stays anon — exactly today's behaviour. The token is cached and keyed to the current `zentra.access`, so login/logout/user-switch invalidates it (no cross-user token reuse).
3. **RLS policy (manual).** `backend/prisma/migrations/0001_rls.sql` now enables RLS on `"Notification"` + `create policy notification_own ... using ("userId" = zentra_uid())`; the matching drop is in `apply-rls.ts`. Kept in the **manual** RLS file (not a Prisma migration) so activation is deliberate, not auto-deployed by CI.

**Activation steps (in this order — avoids any downtime):**
1. Deploy the backend endpoint + frontend code as-is (flag off → no behaviour change).
2. In Supabase → Settings → API → JWT Settings, set the project JWT secret to a strong value equal to the backend `JWT_ACCESS_SECRET`. **This rotates the anon and service-role keys**, so update `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and redeploy. (The current `JWT_ACCESS_SECRET=change-me-access` is a placeholder — replace it with a real secret.)
3. Set `NEXT_PUBLIC_SUPABASE_REALTIME_AUTH=true` and redeploy the frontend. Live delivery still works because RLS is not yet on.
4. Run `npx tsx prisma/apply-rls.ts`. Now each user receives only their own `"Notification"` rows.
5. The 5s fallback poll keeps the bell working throughout.

**Rollback:** `drop policy notification_own on "Notification"; alter table "Notification" disable row level security;` then unset the frontend flag.

Until step 4, the **wording trim in 1A remains the active privacy mitigation**.

### Verification performed

- Backend `npm run typecheck` — pass.
- Frontend `npx tsc --noEmit` — pass.
- `vitest run tests/adm-query.test.ts tests/nurse-query.test.ts tests/pagination.test.ts tests/app.test.ts` — 15 passed.

### Still open (minor / optional)

- **Free-text in the bell is now fully closed for referral flows.** The last two reason-bearing messages (referral **dismissal** reason, **session-cancel** reason) were trimmed too; both reasons remain stored on the referral/session record the recipient opens. (`pipeline.lifecycle.service.ts`, `sessions.crud.service.ts`.)
- A Guidance **intervention** session-cancel reason (`services/interventions/sessions.crud.service.ts`) still appears in notification text — that path does not involve the Nurse, so it was left.
- **Phase 3 above** (live-feed RLS) — code built and safe; activation needs the Supabase dashboard JWT-secret change (steps in that section).
- **Phase 4** — the manual five-role walkthrough (Part 7) still needs a live environment.
