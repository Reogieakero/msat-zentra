# Zentra — Progress Report for School Leadership

**Mati School of Arts and Trades · September 23, 2026**
**Status of the Student Information System: where we are, what works, what is missing, and what happens next.**

> This report is written for non-technical readers. It is based on a full
> inspection of the actual system (all screens, user roles, and workflows),
> not on plans or assumptions.
>
> How to read the lights: 🟢 **Working** · 🟡 **Partly working** · 🔴 **Not started / broken**

---

## 1. What is Zentra, in one page

Zentra is the school's digital records system. It replaces paper-and-spreadsheet
work for learner records, grades, attendance, behavior notes, ADM (Alternative
Delivery Mode) cases, and early warnings for at-risk students.

Each staff member gets their own workspace after signing in — a principal sees
school-wide dashboards, a teacher sees classes and gradebooks, the nurse sees
clinic referrals, and so on. Every sensitive action (approving an account,
locking a grade, signing an ADM case) is recorded in an audit log.

The system is **real and running**: staff can sign in today and do daily work
in it. It is not a mock-up or a demo.

---

## 2. Who can use it today

| Who | What they can do today | Status |
| --- | ---------------------- | ------ |
| Principal | School-wide dashboards, risk boards, ADM approvals, honor roll, reports, audit log | 🟢 Working |
| Registrar (Grades 11–12) | Approve student accounts, manage sections/subjects/teachers, view final grades, SF10 uploads | 🟡 Partly (SF10 upload has a bug — see §4) |
| Record Keeper (Grades 7–10) | Same as Registrar, for Grades 7–10 | 🟡 Partly (no SF10 page at all — see §4) |
| Guidance Counselor | Triage alerts, counseling cases, sessions, interventions, risk views | 🟢 Working |
| School Nurse | Clinic and ADM referrals, sessions, health-records archive, risk views | 🟢 Working |
| ADM Coordinator | Referral intake, learner profiles, parent meetings, certifications, devices, enrolled learners | 🟡 Partly (module-by-module tracking still basic) |
| Adviser | Attendance (AM/PM), advisees, behavior notes, referrals, ADM case tracking | 🟢 Working |
| Subject Teacher | Classes, gradebook, assessments, grade locking, behavior notes | 🟢 Working |
| Student | — (can register and sign in, but lands on an error page) | 🔴 Not started |
| Parent / Guardian | — (same as Student) | 🔴 Not started |

**In short: all 8 staff roles work. The 2 family roles (student, parent) do not
have their screens yet.**

---

## 3. What is working well

- **Sign-in and accounts.** Role-based sign-in works; new students/parents can
  register and the Registrar approves them, which automatically connects their
  official school records.
- **Grades.** Teachers encode scores, the system computes averages and
  transmuted grades, teachers lock them, advisers approve, and the registrar
  sees the finished pipeline. Class records can be printed.
- **Attendance.** Advisers take AM/PM attendance with sensible guards (no
  future dates, no weekends); absences automatically notify parents on file.
- **Behavior notes → referrals → help.** Advisers file behavior notes, refer
  students to Guidance/Nurse/ADM, specialists hold sessions and record
  outcomes, and interventions are tracked to completion.
- **ADM pipeline.** From referral to learner profile, parent meeting,
  certification, principal sign-off, device issuance, and enrollment
  monitoring — the full chain is connected.
- **Early warnings.** The system recomputes every student's risk level
  (Low / Moderate / High) live whenever grades, attendance, or behavior notes
  change, and at-risk students surface automatically in staff queues.
- **Oversight.** Honor roll, school reports (with export), and a full audit
  log of who did what are all available to the Principal.
- **Day-to-day polish.** Screens show loading states, empty states ("nothing
  here yet"), error messages with retry, and confirmation pop-ups before
  important actions — staff are rarely left guessing.

---

## 4. What is missing or broken, and why it matters

### 🔴 Critical — blocks real users

1. **Students and parents cannot use the system.** They can register and sign
   in, but are then sent to a page that does not exist. Until their screens
   are built, families cannot see grades, attendance, risk levels, or confirm
   ADM meetings online. *Affects: all students and parents.*
2. **Filing a behavior note can hang.** Saving a new anecdotal record
   sometimes never finishes (a confirmed technical bug with a known one-line
   fix). Staff must re-enter the note. *Affects: advisers, teachers.*
3. **SF10 upload attaches to the wrong student.** On the Registrar's SF10
   page, the upload is filed under the staff member instead of the chosen
   student, and the records list is not shown. The back-end workflow
   (verify → validate → release) is fully built — only the screen is wrong.
   *Affects: registrar, record keeper.*

### 🟡 Important — visible gaps

4. **"Report Cards" menu items go nowhere** (Registrar and Record Keeper).
   Clicking them shows a missing page. The underlying grade data exists, so
   this is a missing screen, not missing data.
5. **The Record Keeper has no SF10 page at all**, even though Grades 7–10
   need the same workflow as Grades 11–12.
6. **"Forgot password?" and "Sign in with Google" do not work.** There is no
   password-reset process and no Google connection behind the button. Anyone
   locked out must ask the registrar in person.
7. **"Settings" and the search box do nothing.** They are visible in every
   workspace but are decorative. They should either be built or removed so
   staff are not misled.

### 🟡 Workflow limitations (workarounds exist)

8. **Some screens need manual refresh.** Guidance, Nurse, and ADM updates
   appear automatically, but Teacher, Principal, and Registrar screens only
   update when reloaded — a colleague's change can look missing until then.
9. **Only the Nurse has a notifications inbox.** Everyone else gets system
   notifications with no central place to read them.
10. **Health notes and home-visit notes have no dedicated forms.** They are
    handled inside referral dialogs instead of having their own pages, which
    makes them harder to find and file.
11. **The Principal cannot manage school years and terms in-system.** That
    setup currently lives in the Registrar's area instead of with the
    Principal, where policy assigns it.
12. **ADM module-by-module tracking is basic.** The coordinator's "enrolled"
    view lists cases but per-module timelines are still pending.

---

## 5. What happens next, in order

**Phase 1 — Quick fixes (days, IT only).**
Fix the hanging behavior-note save, the SF10 upload filing, and the audit-view
scoping; remove or repair the dead buttons and links (password reset, Google,
Settings, search).

**Phase 2 — Student and parent access (the biggest missing piece).**
Build the two family workspaces, showing only what families may see (grades,
attendance, risk level — never confidential notes), plus ADM meeting
confirmations for parents.

**Phase 3 — Finish the staff workflows.**
Report-card screens, the Record Keeper's SF10 page, dedicated health and
home-visit forms, per-module ADM tracking, and principal calendar management.

**Phase 4 — Live updates for everyone.**
Automatic refresh on all workspaces and a notifications inbox for every role.

**Phase 5 — Final testing.**
Walk through every workflow as each of the 10 roles, approve accounts across
both grade bands, and re-test after each fix.

---

## 6. Small glossary

- **ADM** — Alternative Delivery Mode (learning via modules for qualified learners).
- **SF10** — The learner's permanent school record (Form 10).
- **Anecdotal record** — A written behavior/observation note about a student.
- **Referral** — Sending a student's case to a specialist (Guidance, Nurse, ADM).
- **Intervention** — A planned action to help an at-risk student, tracked to completion.
- **Risk level** — Low / Moderate / High, recomputed automatically from grades, attendance, and behavior notes.
- **Audit log** — The tamper-evident list of who did what and when.
- **Transmuted grade** — The official DepEd grade computed from raw scores.
- **Grade band** — Grades 7–10 (Record Keeper) vs Grades 11–12 (Registrar).

---

*Prepared from a full codebase inspection, September 2026. Technical detail
(file-by-file findings, route tables, and test checklists) is available from
the IT team on request.*
