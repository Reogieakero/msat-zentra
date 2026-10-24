# Registrar & Record Keeper — Audit: Student Account Approval + SF10 Records

**Date:** October 18, 2026
**Scope:** Registrar and Record Keeper roles — student account approval and SF10 records only (including the live notifications, badges, messages, click-throughs, and privacy for these two workflows).
**Status:** Read-only audit. Nothing was changed in the app.

How this was checked: The Registrar and Record Keeper pages and the behind-the-scenes rules that create their messages were read directly. No live test session was run — Part 7 is a ready-made checklist so this can be confirmed on the real app. One thing that could **not** be verified from the code: whether the live-updates connection is switched on in the live school database. The app is built for it and also refreshes by itself every 5 seconds, so messages normally appear within seconds either way — verify it live with the test checklist.

---

## 1. Simple Summary

- Both desks exist and work for their own grades: **Record Keeper = Grades 7–10**, **Registrar = Grades 11–12**. Band limits are enforced — neither desk can approve the other's students.
- A new student sign-up alerts the correct desk **unless the LRN isn't found in the school roster** — then the alert goes to the Registrar even for Grades 7–10, and the learner can also appear in *both* desks' pending lists. Parent sign-ups alert no one at all.
- **Approving works well:** the desk verifies the LRN first, and the "Approve account" button only appears on a full match. But there is **no Reject button anywhere** — refusing an application is only possible behind the scenes.
- Students are sent "Your account has been approved," but **students have no page to read messages** — their login leads to a "Page not found" screen, so in practice they only find out by trying to log in.
- **SF10:** Verify alerts the rest of the same desk plus the class adviser; Validate and Release only confirm to you and the adviser. Uploading a file alerts no one. There is no way to send a file back for correction, and Release is allowed without Verify/Validate.
- Neither desk is ever told about the other desk's decisions or stamps (approve/reject/SF10 actions).
- The message bell is on every page of both desks. New messages appear within seconds, reading them clears the count, and they stay after log-out/log-in. **Clicking a message opens the right list, not the exact student or record.** Only the newest 15 messages are kept.
- Message content is safe: names, sections, LRNs and counts to the correct staff — no grades, no sensitive details. The only leak is the wrong-desk sign-up case above.

---

## 2. Role Check

| Role (real name) | Their part in these two workflows | Grade limit | Approves accounts? | Works SF10? | Gets messages? |
|---|---|---|---|---|---|
| **Student** | Signs up; waits for approval; should get the "approved / not approved" message | — | No | No | The message is saved for them, but they have **no page to read it** (see Part 5) |
| **Parent** | Can sign up for a parent account | — | No | No | None — parent sign-ups create no alert for anyone |
| **Adviser** | Requests SF10 access for their class; gets told the results; gets alerts when their advisees' SF10 records are verified / validated / released | Their class | No | Views advisee records once access is granted | Yes — SF10 updates |
| **Subject Teacher** | Not part of these workflows on screen. Note: the system also accepts a "Verify" stamp from this role (see Part 5, item 7) | — | No | No (no buttons shown) | No |
| **Record Keeper** | Approves Grades 7–10 sign-ups; files and stamps Grades 7–10 SF10 records; handles adviser access requests | G7–G10 | Yes — own grades only | Yes — own desk's records | Yes |
| **Registrar** | Approves Grades 11–12 sign-ups; files and stamps Grades 11–12 SF10 records; handles adviser access requests; also receives sign-ups whose grade can't be found | G11–G12 | Yes — own grades only | Yes — own desk's records | Yes |

---

## 3. Workflow Map

**Workflow A — New student account**

1. Student (or parent) fills in the Sign-up page → account starts as **Pending**.
2. For student sign-ups, the app looks up the LRN in the school roster:
   - Grades 7–10 → alert to the **Record Keeper** desk: *"New G8 sign-up: [name] (LRN …) — awaiting approval."*
   - Grades 11–12 → alert to the **Registrar** desk.
   - LRN not found → alert goes to the **Registrar**, even if the learner is actually lower-grade. (gap)
   - Parent sign-ups → no alert to anyone. (gap)
3. Desk opens **Accounts → Pending Students** (own grades) and presses **"Verify LRN"**.
4. The app compares LRN, name, and grade/section against the official record.
5. **Only on a full match** does the **"Approve account"** button appear.
6. Approve → account becomes **Active**; the student gets *"Your account has been approved."*; the staff member gets their own confirmation copy. The other desk is not told. (gap)
7. **Reject has no button on any page.** If done behind the scenes, the account becomes **Suspended** and the student gets *"Your account request was not approved."*

**Workflow B — SF10 records**

1. A file is added at its desk (**SF10 → Upload**) — Record Keeper for Grades 7–10, Registrar for Grades 11–12. **No message goes to anyone on upload.** (gap)
2. Desk presses **Verify** → other staff on the same desk get *"SF10 verified: [name] ([section]) — needs validation."* and the class adviser gets *"SF10 verified for your advisee …"*.
3. Desk may press **Validate** → only you (own copy) and the adviser get a message.
4. Desk presses **Release** (works while the record is "Attached") → record is released/archived; only you and the adviser get a message. **Verify/Validate are optional stamps — Release doesn't require them.**
5. Adviser side: a class adviser requests SF10 access for a section → alert to the matching desk; the adviser gets a copy of their own request.
6. Desk side (**Adviser Access** page): **Check** runs the records check (adviser is told the counts); then **Approve LRN / Approve All / Deny** or **Report Missing** per student — each sends the adviser a message. **Approving requires the Check to run first; Deny doesn't.**
7. Nobody can send a record back with a note for correction — that action doesn't exist anywhere. (gap)

---

## 4. Action List by Page

**How to read the six check columns** — they describe what happens for the *person the message is for*, if they are logged in at their desk:

- **Badge live?** = the number on the 🔔 updates by itself within seconds (the app listens and also refreshes every 5 seconds).
- **New row live?** = the message appears by itself.
- **Count clears on read?** = reading it removes it from the count.
- **Works from other pages?** = the bell follows you on every page of that desk.
- **Persists after log-out/in?** = the message is still there next log-in.
- **Opens the exact record?** = clicking it lands on that exact student/record.

### A. Account approval actions

| Page & action | Who can do it | Message goes to | Badge live? | New row live? | Count clears | Works from other pages? | Persists re-login? | Opens exact record? | Privacy notes |
|---|---|---|---|---|---|---|---|---|---|
| **Sign up** — Sign-up page | Student (parents can too, but create no alert) | Matching desk: Record Keeper (G7–10) or Registrar (G11–12); Registrar if the LRN isn't found | Yes | Yes | Yes | Yes | Yes | No — opens the **Accounts list** | Name + LRN to one desk only; wrong desk when the LRN isn't in the roster |
| **Verify LRN** — Accounts (both desks) | Both desks, own grades | **No message sent** | — | — | — | — | — | — | Nothing shared |
| **Approve account** — Accounts (both desks) | Both desks, own grades (button appears only on a full LRN match) | The student **+ your own copy** | Not viewable — students have no messages page | Not viewable | — | — | Saved, but nowhere to read it | — | Student text is generic and safe; your copy shows name + LRN |
| **Reject account** — *no button on any page* | Not available on screen | The student + your copy (only if used behind the scenes) | — | — | — | — | — | — | Rejection reason stays internal |

### B. SF10 actions

| Page & action | Who can do it | Message goes to | Badge live? | New row live? | Count clears | Works from other pages? | Persists re-login? | Opens exact record? | Privacy notes |
|---|---|---|---|---|---|---|---|---|---|
| **Add file** — SF10 → Upload (both desks) | Both desks, own grades | **No one** | — | — | — | — | — | — | Silent — see Part 5 |
| **Verify** — SF10 record page | Both desks | Other staff on the same desk + the class adviser | Yes | Yes | Yes | Yes | Yes | No — opens the **SF10 list** | Name + section only; no grades |
| **Validate** — SF10 record page | Both desks | You (own copy) + the class adviser | Yes | Yes | Yes | Yes | Yes | No — opens the **SF10 list** | Name + section only |
| **Release** — SF10 record page | Both desks | You (own copy) + the class adviser | Yes | Yes | Yes | Yes | Yes | No — opens the **SF10 list** | No message to the other desk or the student |
| **Request access** — SF10 Access (adviser side) | Class adviser | Matching desk (by the section's grade) + your copy | Yes | Yes | Yes | Yes | Yes | No — opens the **Adviser Access list** | Adviser name, section, advisee count, and the adviser's own reason text |
| **Handle request** — Adviser Access (both desks): Check / Approve LRN / Approve All / Deny / Report Missing | Both desks, own grades | The requesting adviser (+ your copy on approve/deny) | Yes | Yes | Yes | Yes | Yes | No — opens the **Adviser Access list** | Counts after a check; per-student notices include name + LRN; only that adviser receives them |

*Notes:* "Your own copy" behaves like every normal message (live, clears on read, survives re-login). Approval of an access request needs the Check first; Deny doesn't. Release only works while the record is "Attached." And on the checks above — **could not verify live** whether the real-time connection is switched on in the live database; the 5-second refresh covers it while a page is open (test in Part 7).

---

## 5. What's Missing or Broken

**High**

1. **No Reject button on either Accounts page.** *Impact:* fake or wrong applications can't be formally refused from the page — they sit in Pending unless someone acts behind the scenes; rejection reasons never reach anyone.
2. **Students and parents cannot read any messages.** There is no student/parent page — after login they land on "Page not found." *Impact:* "approved" notices are invisible; families find out by trial and error, and even approved learners land on a missing page. Any student-facing flow depends on fixing this.
3. **Wrong-desk sign-up alerts.** When the LRN isn't found in the school roster, the alert goes to the Registrar even for Grades 7–10, and that learner can appear in *both* desks' pending lists. *Impact:* the wrong desk sees a learner's name + LRN, and it's unclear who should act — fix the routing and label these "grade unknown."

**Medium**

4. **No "send back for correction" anywhere.** SF10 files can't be returned with a note; account rejections have no note for the student. *Impact:* faulty files and applications must be chased outside the system.
5. **Message clicks don't open the exact record** — only the right list. *Impact:* extra searching on busy days, especially on the SF10 list.
6. **Neither desk hears about the other desk** (account decisions, SF10 stamps, uploads), and nobody outside the desk + adviser is told about an SF10's progress or release. *Impact:* no cover when someone is out; records that cross between desks' grades can fall between the cracks.
7. **Verify permission is too broad.** The system also accepts a "Verify" stamp from subject-teacher accounts, without limiting which records they can touch — the button isn't shown on their pages, so this is behind-the-scenes only. *Impact:* a permission hole worth closing.
8. **The bell keeps only the newest 15 messages.** *Impact:* on busy days older messages (even unread ones) can't be seen, and the count understates the backlog.

**Low**

9. **New SF10 uploads are silent** — the first ping anyone gets is Verify. Could be intentional; worth confirming.
10. **Small live-update details:** reading a message in one window doesn't update another open window instantly (up to ~30s); a minimized tab pauses updates until you return. *Impact:* cosmetic; the count corrects itself.
11. **Parent sign-ups alert no one** (student sign-ups do). *Impact:* parent accounts wait silently for whoever approves them.
12. **The extra database lock on the messages table doesn't appear to be switched on** — messages are still protected by the app itself; this is cheap belt-and-braces.
13. *Side notes found while checking click targets (outside this audit's scope):* the "Report Cards" links on both desks' sidebars lead nowhere, and a Registrar notification for academics points to a page that doesn't exist yet.

---

## 6. Suggested Fix List

1. **(High)** Add a **Reject** button (with a required reason) to both Accounts pages, mirroring the approve flow.
2. **(High)** Give students/parents **somewhere to see messages and status** — even a simple sign-up-status screen — so approvals actually reach them.
3. **(High)** Fix **sign-up routing**: use the LRN to find the grade; if it can't be found, alert both desks (or one shared queue) and mark it "grade unknown" so no learner is stranded or shown to the wrong desk.
4. **(Medium)** Add **"Return for correction with a note"** for SF10 records, and share rejection reasons with the student later.
5. **(Medium)** Make message clicks **open the exact record** (jump to it / highlight it in the list).
6. **(Medium)** Decide and wire the **missing updates**: a ping when a record crosses desks' grades, and whether students/families should be told about SF10 progress and releases (today only the same desk + adviser get pings).
7. **(Medium)** **Tighten Verify**: remove the subject-teacher role from it, or limit it to their own classes.
8. **(Medium)** Let the bell **show all messages** (paged), or at least label "newest 15 shown" with a full-history view.
9. **(Low)** Consider a **ping on upload** if the desk wants a heads-up when a file arrives.
10. **(Low)** Housekeeping: enable the extra database protection on messages; clean up the dead "Report Cards" links and the missing Registrar "Academics" target.
11. **(Low)** After any fix, re-run the Part 7 checklist to confirm behavior.

---

## 7. Easy Test Checklist

Set up two windows side by side: **Window A** = Registrar (use the seeded `registrar@zentra.test` account), **Window B** = Record Keeper (`record_keeper@zentra.test`). Keep the bell visible.

1. **Sign-up alert.** In Window A and B, watch the bell while a Grade 11 test student signs up. → Registrar's bell shows "New G11 sign-up…" within seconds; clicking opens the Accounts list (no jump to the student). Record Keeper gets nothing. Repeat with a Grade 8 learner → Record Keeper gets it, Registrar doesn't.
2. **Wrong-desk check.** Sign up a student with an LRN that isn't in the roster. → Watch the alert land on the **Registrar** (this is the known issue); check both desks' Pending lists — the learner can appear in both.
3. **Approve flow.** Registrar: Accounts → **Verify LRN** → the Approve button appears only on a full match. Approve. → The student's "approved" message is saved but has no page to be read on. Look for a Reject button — there isn't one (known issue). Press nothing else.
4. **Bell behavior.** Read a message → the count drops. Log out and back in → messages are still there. Mark a message read in one window → the other window may lag ~30 seconds (expected).
5. **SF10 stamps.** Record Keeper: open an SF10 record → **Verify** → other same-desk staff and the class adviser get messages; clicking opens the SF10 list only. **Validate** → only you + adviser. **Release** (record must be "Attached") → works even without Validate; only you + adviser are told; the other desk and the student get nothing. **Upload** a new file → no message to anyone (known).
6. **Adviser access.** As an adviser, request SF10 access → the matching desk gets the alert. As the desk: try **Approve** before **Check** → blocked; run **Check** → adviser sees counts; then Approve LRN / Approve All / Deny / Report Missing → each messages the adviser. Clicks land on the Adviser Access list.
7. **Live check.** Keep the bell open in Window B, trigger actions from Window A → badge appears within a few seconds. Minimize Window B for a minute and trigger again → it may wait until you return and then catch up. This also confirms the live connection is switched on in the real database (the one thing that couldn't be verified from the code).
