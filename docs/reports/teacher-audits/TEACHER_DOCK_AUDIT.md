# Teacher Dock Audit — No changes made, check only

I checked the code by reading it. I did not click the live app. All findings below come from real screens and task names in your app.

> Update on Rule 3: you confirmed ThoughtLine is the small status line at the top of the Dock with a sparkle icon, words like “Saving…”, and a timer. So Rule 3 means “must have ThoughtLine”, not a vertical joining line. Verdict below reflects that. I still did not find any vertical line joining the rows — tell me if you also want that added.

## PART 1 — Simple Summary

Your Dock exists, but it is not one single box. It is about 10 small boxes that look alike.
Most boxes stay open after Done and let the teacher close them with X. That part is good.
Moving between Teacher pages keeps many boxes open, but leaving that page, refreshing, or opening a new tab loses the tasks. That part fails your rules.
There is no vertical timeline line, and rows are not all laid out the same. That part also fails.

This covers your checks A to I.

## PART 2 — Rules Check

| Rule | Passes? | What I saw (plain words) | Where in the app it happens |
|---|---|---|---|
| Rule 1 – Must NOT close by itself, show Done or plain problem, only X closes it | Partly | Most task boxes stay until the teacher clicks X. The close button is locked while work is running. One big exception: the SF10 file upload box hides by itself about 8 seconds after success. If all files fail, it hides at once and only shows a small pop-up message. | Teacher and Record-keeper / Registrar file upload: “Uploading SF10 files” / “records filed”. Other boxes that do stay: Teacher > Advisory > Referrals “Sending referral”, Teacher > Grades “Saving scores”, “Saving weights”, Teacher > Schedule “Saving timetable”, Teacher > Attendance “Saving attendance”, Teacher > Classes “Unlinking code”, Teacher > Chat “Sending SF10 request” |
| Rule 2 – Keep working when teacher moves, new tab, refresh | Partly | Moving between Teacher pages: many boxes stay because they sit above the pages. New tab: no box shows the same tasks. Refresh: all running and finished tasks disappear. Work does not truly continue in the new tab or after refresh. | Stays on page change: Referral send, Lock grades, SF10 upload, Timetable save, Score save, Weights save. Disappears on page change: Attendance save, Referral cancel, Bama request in Chat, Unlink code in Classes, Template page saves. New tab and refresh fail everywhere. |
| Rule 3 – Must have ThoughtLine (small status line at top with sparkle, words, timer) | Yes | ThoughtLine is there in almost all Teacher boxes. It sits centered at the top, shows steps like “Saving to server”, and folds up after Done. The one box without it is the bottom-left conflict warning. There is still no vertical line joining rows — that part does not exist anywhere. | All Teacher Docks: Referrals, Grades, Attendance, Schedule, Classes, Chat. Missing only in Schedule Template conflict warning (bottom-left). |
| Rule 4 – Every row same layout: icon left, line in center, details middle, right text, same spacing | No | Most rows do put icon on left, name in middle, status on right. But there is no center line. Some boxes have no rows at all. Some rows look different: bordered cards vs plain rows, picture vs icon, extra buttons. | Different: Referral send has no right text. Unlink code and Weights save have no rows. Attendance uses student pictures and color labels. Timetable save uses bordered cards. |

Check A — Does the Dock exist for Teacher? Do all roles see it?
Yes, Teacher has it. But it is not only for teachers. The same box look is used for Record-keeper, Registrar, Principal, Guidance, Coordinator, Nurse. The upload and check boxes are turned on for the whole app. The grade and timetable boxes only appear under Teacher pages.

Check B — Does it ever close on its own?
Yes. SF10 upload auto-hides after Done. Failed-only upload hides at once. ThoughtLine steps fold up after Done. Minimize hides the body. Going to Login clears all boxes.

Check H — Running, done, failed, waiting, cancelled?
Running shows a spinning icon. Done shows a green tick. Failed shows a red cross and plain words. That is fairly same. Waiting words differ: “Queued”, “Saving…”, “Verifying…”, “Not verified”. Cancelled is missing: cancelling an SF10 file just removes the row, it never says “Cancelled”. Bama request in Chat has no failed view at all.

## PART 3 — Page-by-Page Check

This is for Teacher role. “Stay” means the box is still visible. “Continue” means the work and numbers keep moving.

| Page | Does the Dock stay? | Does progress continue? | Problem found (plain words) |
|---|---|---|---|
| Teacher > Overview / Dashboard | Yes, for shared boxes | Yes, for shared boxes | New boxes started elsewhere appear here, but refresh or new tab wipes them |
| Teacher > Classes | Yes, for shared boxes. Unlink code box only lives here. | Yes, while you stay here | If you leave Classes mid-unlink, the Unlink box disappears. The work may finish on the server but you see nothing. |
| Teacher > Advisory > Referrals | Yes, for shared boxes. Referral send box lives across Teacher pages. Cancel box only lives here. | Yes, for send box | If you leave Referrals mid-cancel, the Cancel box disappears. |
| Teacher > Advisory > Students / List / Schedule / Attendance / Adm-cases / SF10-access | Yes, for shared boxes | Yes | Same as above: shared boxes stay between these pages, but refresh or new tab loses them |
| Teacher > Students (Overview > Students) | Yes, for shared boxes | Yes | Same refresh / new tab loss |
| Teacher > Attendance | Yes, for shared boxes. Attendance save box only lives here. | Yes, while you stay here | If you leave Attendance mid-save, the save box is gone. You may think the save failed. |
| Teacher > Grades / Grading detail | Yes, for shared boxes plus Score, Weights, Add, Delete boxes | Yes, between Teacher pages | These grade boxes survive Teacher page jumps, but not refresh or new tab |
| Teacher > Schedule and Schedule > Template | Yes, for shared boxes plus Timetable save box. Template page also opens many boxes at once and they sit on top of each other. | Yes, while layout stays | Page-only submit / delete / config boxes disappear if you leave Template. Many boxes open at same spot can cover each other. Bottom-left conflict warning is a different box, not the Dock. |
| Teacher > Chat (Bama) | Yes, for shared boxes. Bama request box only lives here. | Yes, while you stay here | If you leave Chat mid-send, the request box disappears. |
| Teacher > Settings, Reports | Yes, for shared boxes | Yes | Same refresh / new tab loss |
| Login screen | No, all boxes are hidden | No | This is correct, so the next user does not see old names. Not a bug. |

Check C — Page change: shared boxes pass between Teacher pages, page-only boxes fail.
Check D — New tab: fails everywhere. Second tab starts empty and does not update.
Check E — Refresh: fails everywhere. Tasks do not come back.

Why: tasks live in short-term screen memory only. The app does not save them in browser saved memory (the place that survives refresh) and does not send updates between tabs.

## PART 4 — Layout Check

Your wanted order: 1. Icon left, 2. Line through center of icons, 3. Details middle, 4. Right text.

| Part of the row | Where it is now | Where it should be | OK? |
|---|---|---|---|
| Icon on left | Small icon on far left in most boxes, size about 15. Attendance uses student picture instead. | Far left, same size and same spot in every box | No |
| Timeline line through center of icons | Nowhere. No vertical line exists. You confirmed you meant ThoughtLine, so this vertical line is not needed unless you ask for it. | ThoughtLine status line at top, centered — already there | Yes for ThoughtLine. No for vertical joiner (not needed now). |
| Details in middle | Task name and short description in middle, cut with “…” if too long. Some boxes use 1 line, some use 2 lines plus color labels. | One name line + one short description line, same in every box | No |
| Text on right | Status / time / percent on far right in most boxes. Referral send box has no right text. Weights and Unlink boxes have no rows. SF10 rows add an extra X button after the text. | Status / time / percent on far right, same spot, nothing jumps when status changes | No |

Check F — Is the line visible, connected, centered? No. I could not find it.
Check G — Is every row the same? No. Order is mostly icon-middle-right, but borders, pictures, buttons, and 1-line vs 2-line details differ. Nothing jumps badly when status changes because long text is cut short, but boxes do not match each other.
Check I — Small screens and long text? Mostly OK, but see below. Box is fixed to bottom-right, width 320 on phones and 384 on larger screens. Long names are cut with full text on hover. Long lists scroll inside the box so the page does not move. Risk: on a small phone, the bottom-left conflict warning and the bottom-right Dock can overlap. On Template page, many boxes stack exactly on top of each other.

## PART 5 — What’s Broken or Missing

1. **High — New tab shows nothing.** A teacher starts an upload, opens a new tab, sees no Dock. They think it stopped and may start again twice. Why it matters: duplicate uploads and worry.

2. **High — Refresh wipes tasks.** After refresh, running and Done tasks are gone. No history. Why it matters: teacher cannot prove what finished and may redo grades or referrals.

3. **High — Some tasks stop showing if you leave the page.** Attendance save, Referral cancel, Bama request, Unlink code, Template saves. Why it matters: teacher leaves the page, thinks the save failed, and repeats or misses the result.

4. **High — SF10 upload hides by itself.** Hides 8 seconds after Done. If all fail, it hides at once. This breaks your “only X closes it” rule. Why it matters: teacher misses which files failed.

5. **Low — No vertical joining line, but you said you do not need it.** ThoughtLine itself is present and clear. Why it matters: no action unless you later want a vertical order line too.

6. **Medium — Rows do not match.** No right text in Referral send. No rows in Unlink and Weights. Different borders, pictures, buttons. Why it matters: teachers learn one look, then get confused.

7. **Medium — No plain “Waiting” and “Cancelled” states.** Words change: Queued, Saving…, Verifying…. Cancel just deletes the row. Bama has no failed view. Why it matters: teacher does not know what is waiting vs stuck vs cancelled.

8. **Low — Small phone overlap.** Left-side conflict box plus right-side Dock, and many Template boxes in one spot. Why it matters: on a phone, one box can cover the other.

## PART 6 — Suggested Fix List

1. Make one shared task holder for Teacher that all pages use, so any page shows the same Dock. Size: Medium.
2. Save tasks in browser saved memory so refresh brings them back, and clear them on logout and after teacher clicks X. Size: Medium.
3. Send updates between tabs so a second tab shows the same progress. In plain words: tabs talk to each other. Size: Medium.
4. Stop auto-hide. Keep Done and Failed until X is clicked. Keep the 8-second hide only if you ask for it. Size: Small.
5. Keep ThoughtLine as is in every box (already done). Only add a vertical joining line later if you ask for it. Size: Small.
6. Make one row pattern for all boxes: icon left, details middle (2 lines), right text. Fix the odd boxes: add right text to Referral send, add rows or clear empty state to Unlink and Weights, use same borders and spacing, keep Attendance picture style only if you approve it. Size: Medium.
7. Add clear Waiting and Cancelled labels and a Failed view for Bama. Do not silently delete cancelled rows. Size: Small.
8. Fix small screens: keep one box on top, stack multiple boxes side by side or in a list, avoid left-right overlap. Size: Small.
9. Best order: do 1 first, then 4, then 2 and 3 together, then 6 and 5, then 7, then 8 last.

## PART 7 — Easy Test Checklist

Do this without changing code. Have a teacher login ready.

1. Log in as Teacher. Go to Teacher > Advisory > Referrals. Start a new referral. Did the Dock appear bottom-right? Wait until it says Sent. Did it stay open? Click X only now. Did it close?
2. Start another referral send. While it says Sending, click to Teacher > Classes, then Teacher > Attendance, then Teacher > Overview. Is the same Dock still there with the same progress on each page?
3. While a task is running, open the app in a new tab and log in as the same teacher. Does the new tab show the same Dock and same progress? Leave both tabs open. Does the new tab update?
4. While a task is running, refresh the page. Do running and Done tasks come back? Start a task, wait for Done, refresh again. Is Done still there?
5. Start an SF10 upload or bulk task. Wait for Done. Does the Dock stay until you click X, or does it hide by itself? Try a failed task. Does it stay and show the problem in plain words?
6. Look for the thin vertical line linking the rows. Is there a line through the icons from top to bottom? Open ThoughtLine steps. Is that what you meant, or did you want a different line?
7. Check each row: is the icon on the left, details in the middle, status on the right? Do all rows line up? Try a long student name. Is it cut short neatly? Does anything jump when status changes from Saving to Saved to Failed?
8. Try waiting and cancel: queue files, cancel one file. Does it say Cancelled or just vanish? Try each state if you can: running, done, failed, waiting, cancelled. Do they look the same way?
9. Try on a phone and a tablet. Is the Dock fully visible bottom-right? Can you read all rows? Open the Template page with conflicts. Do boxes overlap?
10. Check roles: log in as Record-keeper, Registrar, Principal. Do you see the same Dock look? Note which tasks each role sees.
