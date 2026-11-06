# Teacher Notifications – What Was Fixed

> Plain-words summary for school admin. No tech terms.
> Date: 2026-10-16

## What works now

Your bell checker was already good. It checks every 5 seconds on all teacher pages.
What was missing was the messages themselves. I added the missing messages.

Fixed today:

1. **Class assignments** – When Principal assigns an adviser, subject teacher, or removes them, that teacher now gets a bell message like "You were assigned to Math in Section Hope".
2. **Timetable edits** – When a Master edits, clears, unlocks, or submits a timetable, ALL teachers in that section now hear about it, not just Masters.
3. **Principal Approve / Reject** – Now tells ALL teachers in that section, not just the submitter.
4. **Single grade Lock** – Now tells the adviser and the grades office, same as Batch Lock.
5. **Adviser Approve** – Now tells the subject teacher back, "Your grades were approved".
6. **Grade flags** – Opening and resolving a flag now tells the owner, the adviser, and the raiser.
7. **Intervention re-assign** – Now tells the adviser, not just the new staff.
8. **Intervention photos** – Adding or removing session photos now tells the adviser too.
9. **Principal flag to guidance** – Now tells the adviser too, "Your advisee was flagged to guidance".
10. **Daily attendance Save** – Now gives "You saved it" confirm.
11. **Auto-absent sweep** – Now tells advisers a sweep ran.
12. **SF10 verify / release** – Now tells the adviser, "SF10 ready for your advisee".
13. **Principal bell speed** – Changed from 15 seconds to 5 seconds, same as Teacher.
14. **Bell titles and links** – New messages now show clear titles like "New class assignment", "Grade flag opened", "Follow-up reassigned", and open the right page when clicked.

## How the bell behaves now

- Badge number goes up by itself in about 5 seconds. No refresh.
- New row appears in the list by itself.
- Clicking a message marks it read, number goes down right away.
- Works from any teacher page (Dashboard, Classes, Grades, Attendance, Referrals), because the checker runs on all teacher pages.
- If the tab is hidden, it waits until you come back. That is normal.

## Checks I ran

- Backend check (finds typing mistakes): PASSED, no errors.
- Frontend check (finds typing mistakes): PASSED, no errors.
- Backend tests: 205 passed, 4 failed in `sf10-upload-auto.test.ts`.
  - Those 4 are about file upload reading, not about notifications. They fail with "Connection terminated" and timeout. I did not touch upload reading.
  - All notification-related tests passed: grading (22), attendance (8+13+8), grade-flags (4), principal-adviser-batch (7), adviser-code (5), advisory (4).

## Still open (needs your decision)

- **Device overdue**: message text exists but no sender, and devices have no due date field. I left it alone. Tell me what "overdue" means (how many days after issue?) and I will add it.
- **Archive / Restore student**: message text exists but I found no archive button handler. Tell me the page name where Archive lives and I will wire it.
- **Student / Parent bell pages**: I found no student or parent bell pages. If parents and students should see a bell, that is a new Big job with new pages.

## Easy re-test (same as audit)

- Test A Referral: Teacher watches bell, Guidance changes status to In Progress. Bell +1 in 5 sec, row on top, click drops number.
- Test B Classes: regular teacher watches bell, Master edits slot and Saves. NOW you should see a new message. Before the fix you saw nothing.
- Test C Grades: adviser watches bell, subject teacher Locks ONE grade. NOW adviser gets a message. Adviser Approves, subject teacher gets "approved" message.
- Test D Different page: teacher on Dashboard, referral changes. Bell still goes up.
- Test E Read: Mark all read, number disappears right away.
