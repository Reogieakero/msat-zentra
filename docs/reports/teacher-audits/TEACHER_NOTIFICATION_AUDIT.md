# Teacher Notification Live Update – Audit Report

> Goal: teachers see the bell badge (little number) and new message row instantly, without refreshing.
> Example: Classes Save, referral update by admin / staff / parent / counselor.
> Type: AUDIT ONLY – no code was changed.

---

## PART 1 – Simple Summary

Your live bell mostly works, but only when a message is actually sent.

When a message IS sent to a teacher, the little number on the bell goes up by itself in about 5 seconds, with no refresh. A new row also appears in the list by itself. This works on all teacher pages, because the checker runs in the background on every teacher page.

The big problem is this: many actions that SHOULD send a message to a teacher send nothing today. So the bell stays quiet, not because the bell is broken, but because no message was created. Referrals work well. Classes, Grades, and section assignments have the biggest gaps.

---

## PART 2 – Role Check

These are the real role names from your app. A teacher in your app means 2 roles: Subject Teacher and Adviser.

| Role | Can receive notifications? | Can cause notifications? | Problem found (plain words) |
|---|---|---|---|
| Subject Teacher | Yes – has bell + background checker on all teacher pages | Yes – filing anecdotal, filing referral, saving scores, enlisting student | Many actions by others do not send to this role when they should |
| Adviser (class adviser) | Yes – same teacher bell and checker | Yes – same as above, plus approving final grades | Same gap as above. Also misses approval news, assignment news |
| Guidance Counselor | Yes – has own bell + checker | Yes – referral updates, sessions, interventions do notify teacher | Works well for referrals. Some intervention changes miss the adviser |
| Nurse | Yes – has own bell + checker | Yes – referral and clinic updates do notify teacher | Works for referrals |
| ADM Coordinator | Yes – has own bell + checker | Yes – ADM stage changes and meetings do notify teacher | Works for ADM |
| Principal | Yes – has own bell + checker, but checks every 15 seconds (slower) | Yes – schedule approve / reject notifies only the submitter | Other teachers in that section hear nothing. Slower check |
| Registrar (Grades 11-12) | Yes – has own bell + checker | Yes – SF10 approve / deny notifies adviser | SF10 validate / release does not tell the adviser |
| Record Keeper (Grades 7-10) | Yes – has own bell + checker | Yes – same as Registrar | Same gap as Registrar |
| Student | I could not find this – no student pages and no bell found | No – students do not trigger teacher messages | If students should get a bell, it is missing. I would need your student page list to confirm |
| Parent | I could not find this – no parent pages and no bell found | No – parents do not trigger teacher messages found | App does create parent messages for attendance, but I found no parent bell to show them. I would need your parent page list to confirm |

What a teacher needs to see the live bell: an active Subject Teacher or Adviser login, on any `/teacher/...` page. No extra permission is needed.

What can block a teacher:

- Account is still “pending” and not yet approved – then login does not fully work.
- Bell only refreshes while the tab is open and visible. If the tab is hidden or in the background, it waits until you come back.
- If no message was created for that action, there is nothing for the bell to show.

---

## PART 3 – Action List by Page

“Live” below means “by itself in about 5 seconds, no refresh”, because the teacher pages check every 5 seconds. If it says No, it means no message is sent at all today.

| Page | What the user does (e.g. “Clicks Save”) | Who does it | Who should be notified | Example message the teacher would see | Badge updates live? | Message row appears live? |
|---|---|---|---|---|---|---|
| Classes – Claim code / Save | Clicks Save to link class code | Subject Teacher / Adviser (self) | Same teacher + Master Teachers | “You linked your class code” | Yes | Yes |
| Classes – Schedule edit / Save | Master edits time slot and clicks Save | Master Teacher | All other teachers in that section | “Your class schedule was changed” | No – only Masters are told today | No |
| Classes – Submit for review / Save | Clicks Submit | Master Teacher | Principal + submitter self | “Timetable submitted for review” | Yes for submitter self, No for other teachers | Yes for submitter, No for others |
| Classes – Principal Approve / Reject | Clicks Approve or Reject | Principal | All teachers in that section | “Your section schedule was approved” | Partly – only the submitter is told | Partly |
| Referrals – File referral / Save | Files referral from anecdotal | Subject Teacher / Adviser | Filing teacher (confirm) + next desk | “Your referral to Guidance was submitted” | Yes | Yes |
| Referrals – Status change | Changes status to In Progress, Resolved, etc. | Guidance / Nurse / Coordinator / Principal | Teacher who filed it | “Your referral for Juan is now In Progress” | Yes | Yes |
| Referrals – Escalate / Reassign / Forward | Clicks Escalate, Reassign, Forward | Guidance / Nurse / Coordinator | Filing teacher + new desk | “Your referral was escalated to ADM” | Yes | Yes |
| Referrals – Book / Reschedule / Cancel / Complete session | Saves session change | Guidance / Nurse | Filing teacher | “A counseling session was booked for your referred student” | Yes | Yes |
| Students / Advisory Roster – Enlist / Save | Clicks Enlist / Save | Adviser | Same adviser (confirm) | “You enlisted a student in your advisory” | Yes | Yes |
| Attendance – Subject Save | Saves subject attendance | Subject Teacher | Adviser (if different person) + Parents | “Subject attendance was submitted for your advisory” | Yes for adviser | Yes for adviser |
| Attendance – Advisory AM/PM Save | Saves daily advisory attendance | Adviser | Same adviser (confirm) | “You saved advisory attendance” | No – no confirm sent today | No |
| Grades – Save score / Bulk save | Clicks Save | Subject Teacher | Same teacher (confirm) | “You saved scores” | Yes for self only | Yes for self only |
| Grades – Lock batch | Clicks Lock | Subject Teacher | Section adviser + Grades office | “Final grades were locked for your section” | Yes for adviser | Yes for adviser |
| Grades – Lock single student | Clicks Lock | Subject Teacher | Section adviser + Grades office | “A final grade was locked, please review” | No – nothing sent today | No |
| Grades – Adviser Approve | Clicks Approve | Adviser | Subject teacher who locked it + Grades office | “Your locked grades were approved” | Partly – Grades office is told, subject teacher is not | Partly |
| Grade Flags – Create / Resolve flag | Saves a flag | Teacher / Guidance | Adviser / subject teacher | “A grade flag was opened for your student” | No | No |
| Anecdotal – Create / Save | Clicks Save | Subject Teacher / Adviser | Same teacher (confirm) | “You filed an anecdotal record” | Yes for self | Yes for self |
| Anecdotal – Add follow-up / Save | Adds follow-up | Guidance / Teacher | Original filing teacher | “A follow-up was added to your anecdotal” | Yes | Yes |
| ADM Cases – Stage advance / Certify / Verdict | Moves ADM forward | Coordinator / Principal | Filing teacher | “Your ADM case moved to the next stage” | Yes | Yes |
| ADM Meetings – Book / Reschedule / Cancel | Saves meeting | Coordinator | Filing teacher + invited people | “A parent meeting was booked for your case” | Yes | Yes |
| SF10 Access – Request / Approve / Deny | Clicks Request, Approve, Deny | Adviser, Registrar, Record Keeper | Adviser + Grades office | “Your SF10 request was approved” | Yes | Yes |
| SF10 – Validate / Release record | Clicks Validate / Release | Registrar / Record Keeper | Adviser | “Your advisee’s SF10 is ready” | No | No |
| Interventions – Open follow-up / Approve / Outcome | Clicks Save / Approve | Guidance | Adviser + assigned staff | “Guidance opened a follow-up for your advisee” | Yes | Yes |
| Interventions – Assign / Reassign staff | Clicks Assign | Guidance | New staff only today, adviser misses it | “Assignee changed for your advisee’s case” | Partly – assignee yes, adviser no | Partly |
| Principal Assign page – Assign adviser / subject / section | Clicks Assign / Save | Principal | Affected teacher / adviser | “You were assigned as adviser to Section Hope” | No | No |
| Dashboard / Overview | Views only, no Save | — | — | — | — | — |
| Messages / Chat | Chats with helper | Adviser | — | — | I could not find this – chat has no message system today | I could not find this |
| Accounts – Approve / Reject teacher | Clicks Approve / Reject | Registrar / Record Keeper / Principal | That teacher | “Your account was approved” | Yes | Yes |

Two examples you asked about:

- Classes Save: if a Master changes the timetable, regular teachers get NOTHING today. Bad gap.
- Referral update by admin / staff / parent / counselor: YES, the filing teacher IS told live today.

---

## PART 4 – What’s Missing or Broken

**High – teacher misses important news:**

- Principal assigns adviser, subject, or section, but the affected teacher gets nothing. WHY it matters: a teacher can show up to the wrong class and not know they were moved.
- Master edits timetable, but regular teachers in that section get nothing. WHY it matters: teacher follows an old schedule.
- Single final grade lock sends nothing. WHY it matters: adviser never knows to review it.
- Adviser approves grades, but the subject teacher who locked them is never told. WHY it matters: subject teacher keeps waiting and asks “was it approved?”
- Grade flags send nothing. WHY it matters: teacher never knows a student was flagged.
- Intervention re-assign and session photo changes tell staff but not the adviser. WHY it matters: adviser gives parents old news.

**Medium – teacher is confused or does extra work:**

- Advisory daily attendance Save has no “you saved it” confirm. WHY it matters: teacher clicks Save twice because they are not sure it worked.
- Principal auto-absent sweep tells no one. WHY it matters: adviser finds absences late.
- Principal alert-to-guidance tells guidance only, not the adviser. WHY it matters: adviser learns about their own advisee last.
- SF10 validate / release does not tell the adviser. WHY it matters: adviser keeps checking back for no reason.
- Principal bell checks every 15 seconds, teacher bell every 5 seconds. WHY it matters: principal sees news a little later.

**Low – small polish:**

- Filing into a folder and some archive / restore actions have no confirm message. WHY it matters: small doubt – “did it save?”
- I could not find if “Delete referral” and “Device overdue” send messages. The message text exists but I found no sender. WHY it matters: if a referral is deleted, the filer may keep waiting.
- Student and Parent bells: I found messages for parents (attendance) but no parent or student bell pages. WHY it matters: if parents should see a bell, they cannot today. I would need your parent / student page list to confirm.

---

## PART 5 – Suggested Fix List

In best order (most helpful to teachers first):

1. Send a message when Principal assigns adviser / subject / section to a teacher. Size: Small.
2. Send a message to ALL teachers in a section when timetable is edited, submitted, approved, or rejected – not just Masters and submitters. Size: Medium.
3. Send a message for single-grade lock (to adviser + grades office) and for adviser approval (back to the subject teacher). Size: Small.
4. Send a message for grade flags – opened, updated, resolved. Size: Small.
5. Send a message to adviser on intervention assign change, session photo change, and principal alert-to-guidance. Size: Small.
6. Add “you saved it” confirm for advisory attendance Save, and tell advisers about auto-absent sweep. Size: Small.
7. Tell the adviser when SF10 is validated or released. Size: Small.
8. Check and fix Delete referral, Archive / Restore student, and Device overdue – make sure they send if they should. Size: Small.
9. Make Principal bell check every 5 seconds like Teacher, and make hidden tabs catch up faster on return. Size: Small.
10. Decide and add Student / Parent bell pages if parents and students should see messages. Size: Big – needs new pages and testing.

---

## PART 6 – Easy Test Checklist

You need two windows side by side. No refresh allowed during each test.

**Test A – Referral (should already work):**

1. Window 1: log in as Teacher who filed a referral. Open any teacher page and look at the bell number. Leave it open.
2. Window 2: log in as Guidance. Open Referrals and change that referral status to “In Progress”. Click Save.
3. Watch Window 1 for 10 seconds. Check: did the bell number go up by 1 without refresh? Open the bell. Check: is the new row on top? Click it. Check: does the number go down by 1?

**Test B – Classes (likely broken today):**

1. Window 1: log in as a regular Subject Teacher in Section Hope. Note the bell number.
2. Window 2: log in as Principal or Master. Edit that section’s time slot and click Save.
3. Watch Window 1 for 10 seconds. Check: did anything change? Today you will likely see NO change. That is the gap.

**Test C – Grades lock (partly broken):**

1. Window 1: log in as Adviser. Note the bell number.
2. Window 2: log in as Subject Teacher of the same section. Lock ONE final grade and click Save/Lock.
3. Watch Window 1. Check: no new message? That is the gap. Now try Lock Batch instead. Check: this time the adviser SHOULD get a message.

**Test D – Different page test:**

1. Window 1: log in as Teacher. Go to Dashboard / Overview (not Referrals).
2. Window 2: change a referral for that teacher as Admin or Guidance.
3. Watch Window 1. Check: does the bell on Dashboard still go up without refresh? It should, because the checker runs on all teacher pages.

**Test E – Read test:**

1. As Teacher, open the bell, click “Mark all read”.
2. Check: does the little number disappear right away without refresh? It should.

If you want, tell me your student and parent page names, and I will check those bells too – I could not find them in this check.
