# Audit Report — Record Keeper Notifications (Live Badge & Messages)

**Date:** 17 October 2026
**Scope:** Does the Record Keeper get a live badge (the little number on the bell) and live notification messages without refreshing?
**Note:** This is a code audit only — nothing was changed. The school's live server was not tested; anything depending on how it is switched on there is marked.

> Plain-language rule used throughout: "desk" = the role's own working screens; "live" = appears by itself without refreshing.

---

## PART 1 – Simple Summary

**Partly works.** The Record Keeper is fully set up as a role, the notification bell sits in the top bar of **every** Record Keeper page, and messages are saved online, so they are still there after logging out and back in.

For a few events — a teacher locking grades, an adviser approving final grades, a new Grades 7–10 student signing up, an adviser requesting SF10 access, and an SF10 file being stamped "verified" — the little number on the bell and the new message line appear **by themselves, without refreshing** (fastest when the live line works; at worst about 5 seconds, because the app also checks quietly every 5 seconds).

The big gaps: referral updates and class changes **never reach the Record Keeper**, an SF10 uploaded by someone else sends **nothing**, and the bell count can sit for a moment after a message is read before it goes down.

Also, only the newest 15 messages are ever reachable — there is no full "all notifications" page.

---

## PART 2 – Role Check

10 roles exist in the app (no generic "Admin" — the admin-type roles are ADM Coordinator and Principal). "Desk" below means the role's own working screens.

| Role | Can receive notifications? | Can cause notifications? | Problem found (plain words) |
|---|---|---|---|
| Student | Saved for their account, but **no screen to see it** (student login leads to a missing page) | Yes — signing up pings the Record Keeper for Grades 7–10 | No portal yet; only sign-up works |
| Parent | No parent screens exist; none of the flows checked send to parents | Not really — parent sign-up alerts nobody | Parents can sign up but can't do anything yet |
| Subject Teacher | Yes — bell on their desk | Yes — locking grades, attendance, referrals, enlisting learners | Referral updates they make do **not** reach the Record Keeper |
| Adviser | Yes | Yes — approving grades, SF10 access requests, verifying SF10 | Their referral updates also don't reach the Record Keeper |
| Nurse | Yes — referral/clinic messages | Yes — clinic actions | Sends only to guidance/ADM/teacher, never the Record Keeper |
| ADM Coordinator | Yes | Yes — ADM case steps | Same — never sends to the Record Keeper |
| Guidance Counselor | Yes | Yes — counselling steps | Same |
| **Record Keeper** | **Yes — bell works on all their pages; messages are saved** | Yes — approving accounts, deciding SF10 access, validating/releasing SF10 (notifies the student and the adviser) | Only Grades 7–10 events are addressed to them (by design); 11–12 events go to the Registrar |
| Registrar | Yes | Yes — the same desk actions, but for Grades 11–12 | Their actions don't (and shouldn't) ping the Record Keeper |
| Principal | Yes | Yes — schedule approvals, class setup, ADM sign-off | Changing class setup for Grades 7–10 does **not** notify the Record Keeper |

Nothing blocks the Record Keeper from receiving messages. The only limits: events are meant for Grades 7–10 only, and role-wide messages are sent to at most 10 people per role.

---

## PART 3 – Action List by Page

**Bell visible on every Record Keeper page:** Overview, Final Grades, Account Approvals, Adviser Access Requests, SF10 Records, a single SF10 record, Upload SF10, Settings — all yes. The "Report Cards" menu item opens a page that doesn't exist (dead end), so nothing is there.

"Live?" columns assume the app is open somewhere as Record Keeper on any page.

### A. Pages where the Record Keeper is the doer

| Page | What the user does | Who does it | Should RK be notified? | Example message | Badge live? | Row live? |
|---|---|---|---|---|---|---|
| Overview / Account Approvals | Approve or reject a 7–10 sign-up | Record Keeper | No (they did it — a "you did it" note is saved anyway) | "You approved Juan Dela Cruz (LRN …) — G8." | Yes | Yes |
| Overview / Account Approvals | Verify an LRN | Record Keeper | No | — | n/a | n/a |
| Adviser Access Requests | Grant / deny / check / report missing | Record Keeper | No (the adviser is the one notified) | — | n/a | n/a |
| SF10 Records (one record) | Verify | Record Keeper | No | — | n/a | n/a |
| SF10 Records (one record) | Validate / Release | Record Keeper | No (a note to themselves is saved) | "You validated an SF10 record — ready for release." | Yes | Yes |
| Upload SF10 | Upload / analyse a file | Record Keeper | No | — | n/a | n/a |
| Final Grades | View finished grade sets | Record Keeper | No save action found on this page | — | n/a | n/a |
| Settings | Change profile / password | Record Keeper | No | — | n/a | n/a |

### B. Pages where other people act (this is where it matters)

| Page | What the user does | Who does it | Should RK be notified? | Example message | Badge live? | Row live? |
|---|---|---|---|---|---|---|
| Teacher → Grading workspace | Clicks Lock on a class's grades | Teacher | **Yes** | "Ms. Cruz locked 12 Math 9 (MATH9) grades for G9-B — Term 1, SY … They are awaiting adviser approval." | **Yes** | **Yes** |
| Adviser → grade approvals | Approves the last subject of a learner | Adviser | **Yes** | "Mr. Santos approved all subjects for Juan Dela Cruz (G9-B) — the record is complete and ready for your review." | **Yes** | **Yes** |
| Adviser → SF10 access page | Requests SF10 access | Adviser | **Yes** | "SF10 access requested: Adviser Cruz — G9-B (32 advisees) — reason." | **Yes** | **Yes** |
| A single SF10 record | Marks it verified | Adviser / teacher with access | **Yes** | "SF10 verified: Juan Dela Cruz (G9-B) — needs validation." | **Yes** | **Yes** |
| Register page | A student signs up (7–10, LRN matches) | Student | **Yes** | "New G8 sign-up: Juan Dela Cruz (LRN …) — awaiting approval." | **Yes** | **Yes** |
| Register page | A parent signs up | Parent | No | nothing | — | — |
| SF10 upload (adviser side) | Uploads an SF10 file | Adviser | **Yes — should be** | today: nothing at all | Nothing today | Nothing today |
| Teacher → My Classes | Links / unlinks the class code, enters the class code | Teacher | No (this alerts Master Teachers, not the desk) | — | — | — |
| Advisory → Enlist learner | Adds a learner to the roster | Teacher / Adviser | Optional (today: only a note to the doer) | — | Nothing today | Nothing today |
| Teacher → Attendance | Submits attendance | Teacher | No (the adviser gets it) | — | — | — |
| Referrals (all roles) | Files a referral, changes status, adds a note, closes it | Teacher, Adviser, Nurse, Guidance, ADM, Principal | **You said yes — today: nothing** (see caution below) | e.g. "A G8 learner's referral status changed to resolved." (no details) | Nothing today | Nothing today |
| Principal → Academics | Adds/edits a section, assigns an adviser or subject teacher, sets the schedule | Principal | **Yes for 7–10 changes — today: nothing** | e.g. "Section G8-B now has adviser Ms. Reyes." | Nothing today | Nothing today |
| Nurse / Guidance / ADM case pages | Clinical or case updates | Nurse, Guidance, ADM | No — private by design | — | — | — |
| Registrar pages | Desk actions on 11–12 records | Registrar | No (other grade band) | — | — | — |

**Caution on referrals:** the Record Keeper has no referral screens (they'd get a "you can't open this" dead end), and referrals can hold sensitive, confidential details. If you add them, send a short headline only, or skip them.

---

## PART 4 – What's Missing or Broken

1. **HIGH – Referral updates never reach the Record Keeper.** Every referral message goes to the nurse, guidance, ADM coordinator, principal, or the teacher who filed it — never the desk. Why it matters: your stated goal isn't met, and you must first decide if the desk should see anything about referrals at all (they currently can't open them, and referral content can be sensitive).
2. **MEDIUM – The bell count can lag when you read a message.** The server keeps a short-lived copy of the list (about 15 seconds) and "mark as read" doesn't clear it, so the number can sit until you switch tabs and back, or until the next message arrives. Why it matters: the count is the desk's "what's new" signal; it looks broken when it doesn't drop.
3. **MEDIUM – Class setup for Grades 7–10 doesn't notify the desk.** Your example "a teacher saves a change on Classes" — on the teacher's Classes page they can only link their class code (that alerts Master Teachers). Editing classes/sections/subjects happens on the Principal's Academics pages and on the desks, and none of that pings the Record Keeper. Why it matters: the desk's records follow the class list; they find out late.
4. **MEDIUM – An SF10 uploaded by an adviser (or the registrar) is silent.** The file simply appears in the list; nobody tells the desk it arrived. Why it matters: validating/releasing is the desk's job — they should know a new file landed.
5. **MEDIUM – Only the newest 15 messages exist anywhere.** The bell loads 15, the "View all" window shows the same 15, and the count counts only those. Why it matters: on busy days the count under-reports and older unread items are unreachable.
6. **MEDIUM (privacy) – The notification table in the online database isn't locked at the database level.** The app filters each person to their own messages (the team wrote a note saying this is on purpose because the app runs its own logins), but the messages contain student names, so it's worth one check with whoever manages the database.
7. **LOW–MEDIUM – The "Report Cards" side-menu link is a dead end.** No page exists, so it's a 404 and has no bell.
8. **LOW – "Instant" depends on the live line being switched on for your real server.** The app also quietly checks every 5 seconds, but only if the two public app settings are present (school URL + public key). If those are missing, nothing updates by itself. The auto-check also pauses while the tab is hidden and catches up the moment you return to the tab.
9. **LOW – Your own actions count as messages too ("You approved…").** Some pages hide the pop-up for your own action, others don't. Why it matters: clutter and mild confusion in the count.
10. **LOW – With more than one Record Keeper (or more than 10 people in a role), some people miss messages.** The desk doesn't hear about another Record Keeper's decisions, and role-wide messages stop after 10 people.

---

## PART 5 – Suggested Fix List (best order)

1. **Make the badge drop right after reading** — clear the short-lived list copy when something is marked read. **Small.**
2. **Confirm the live settings on the real school server** (school URL + public key, and the live line switched on for notifications). This is what makes updates truly instant instead of "a few seconds". **Small** (needs whoever manages the server).
3. **Tell the desk when an SF10 is uploaded by someone else** ("New SF10 filed for X — ready for validation"). **Small.**
4. **Decide the referral rule with the team, then act**: headline-only messages ("A G8 learner's referral was updated"), skip confidential cases, and either add a simple read-only list for the desk or leave the messages unclickable. **Small decision, then Medium.**
5. **Add a real "All notifications" page** with paging, so nothing beyond 15 is lost and the count is always truthful. **Medium.**
6. **Notify the desk about Grades 7–10 class-setup changes** made on the Principal's Academics pages. (Later, if you want the desk to manage classes themselves, their Classes screen doesn't exist yet — backend exists, no screen.) **Medium** (notification) / **Big** (new screen).
7. **Fix or remove the dead "Report Cards" menu item.** **Small.**
8. **Polish:** hide "you did it yourself" pop-ups on every desk page; revisit the 10-person message limit. **Small.**

---

## PART 6 – Easy Test Checklist

Do this on the real school website. Use two different windows or browsers (or one normal + one private/incognito window) so the two logins don't fight.

**Test A – Live badge and live message (grades)**
1. Window 1: log in as the Record Keeper. Open Overview. Note the number on the bell.
2. Window 2: log in as a subject teacher with a Grade 7–10 class. Go to Grading, lock that class's grades.
3. Watch Window 1 **without touching it**. Expected: a little pop-up appears, and the bell number goes up by 1 within about 5–10 seconds.
4. Click the bell. Expected: the new line ("… locked N … grades for …") is at the top. Click it — it should jump to Final Grades.

**Test B – It works from a different page**
5. Move the Record Keeper to Settings. Repeat the teacher lock. Expected: same pop-up and count change.

**Test C – Reading it**
6. After clicking a message, watch the number. Expected: it goes down — but **allow up to ~15 seconds**, and if it doesn't drop, switch to another tab and back once. If that's what you see, it's the known lag (fix #1).

**Test D – Still there after logging out**
7. Log the Record Keeper out, log back in. Expected: the message is still in the bell list.

**Test E – Confirm the known gaps (you should see nothing)**
8. As a teacher or guidance user, update a referral. Check the Record Keeper bell: expected — no new message. If you want the desk to know, mark this as a "to do" (fix #4).
9. As an adviser, upload an SF10 file. Check the Record Keeper bell: expected — no message today (fix #3). Confirm the file shows on the SF10 Records page after you open it fresh.
10. Click "Mark all read" for the Record Keeper. Expected: the number goes to 0 (again, allow the ~15-second lag).

If Test A shows nothing at all within ~15 seconds, that's worth reporting right away — it likely means the live line and the quiet 5-second check aren't running on that server (fix #2).
