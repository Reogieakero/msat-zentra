# Zentra — User Guide

> **Who this is for:** everyone who uses Zentra day to day — students, teachers,
> advisers, counselors, nurses, coordinators, records staff, and the principal.
>
> This guide explains how to sign in, what each role can see, and how the common
> school workflows run. Screenshot-level detail lives in the app itself; the
> authoritative rules live in the API. For the technical picture see
> [`../architecture/system-architecture.md`](../architecture/system-architecture.md).

---

## 1. Getting started

### 1.1 Signing in

Open the Zentra web app and choose the sign-in that matches you:

| Portal | URL |
|---|---|
| Landing page | `/` |
| Staff sign-in | `/login/staff` |
| Student sign-in | `/login/students` |
| Parent sign-in | `/login/parents` |

After a successful login you land on your role's home desk. Sessions stay alive
in the background and renew automatically; if a session is revoked you are sent
to the error page and must sign in again.

### 1.2 Registering

- **Students and parents** can self-register at `/register`.
- **Staff** accounts are created and approved by the records desk for their
  grade band (Record Keeper for Grades 7–10, Registrar for Grades 11–12).
- Submitted accounts wait in **pending** until approved. You cannot sign in
  until your account status is **active**.

### 1.3 Terms and school years

Zentra runs on **trimesters** — three terms per school year. Your desk always
shows data for the correct term:

- **Teachers and advisers** pick the term from the term selector; the choice is
  remembered.
- **The principal** picks one scope in **Settings**, and every principal page
  follows it.
- **All other roles** are scoped automatically by the server to the active term.

### 1.4 Notifications

The bell in the top bar shows in-app notifications. Desks also refresh in
real time when a related case changes — for example, a new referral appears on
the guidance queue without a manual reload.

---

## 2. Roles at a glance

| Role | Home | Can do |
|---|---|---|
| **Student** | `/student/modules` | See released modules, submit work |
| **Parent / Guardian** | — | Account only; a dedicated parent portal is not available yet |
| **Subject Teacher** | `/teacher/overview` | Grading, attendance, anecdotal records, classes, schedule |
| **Adviser** | `/teacher/advisory` | Section roster, grade approvals, advisory modules, ADM monitoring, SF10 access requests |
| **Guidance Counselor** | `/guidance/overview` | Alerts, risk, referrals, interventions, anecdotal, session documents |
| **School Nurse** | `/nurse/overview` | Clinic referrals, health records, ADM consultation |
| **ADM Coordinator** | `/coordinator/overview` | ADM cases, parent meetings, certification, devices |
| **Record Keeper** (G7–10) | `/record-keeper/overview` | Accounts, SF10, final grades, adviser access |
| **Registrar** (G11–12) | `/registrar/overview` | Same records desk for the senior band |
| **Principal** | `/principal/overview` | School-wide oversight, terms, ADM approval, reports, audit |

Grade bands are enforced by the server: a Record Keeper cannot open Grades
11–12 records, and a Registrar cannot open Grades 7–10 records.

---

## 3. Student portal

**Navigation:** Modules

1. Open **Modules** to see work released to your section.
2. Each module shows its status: *pending*, *submitted*, or *overdue*.
3. To submit, open the module and choose one of:
   - **Link** — paste a URL to your work.
   - **File** — upload a PDF or Word document (up to 10 MB).
   - **Physical** — mark it as passed in person.
4. Submitted work is visible to your teacher/adviser for checking.

If a module is not listed, it has not been released to your section yet.

---

## 4. Teacher and adviser desk

**Home:** `/teacher/overview`

| Page | Purpose |
|---|---|
| **Overview** | Today's classes, outstanding tasks, quick actions |
| **Classes** | Sections and subjects you handle |
| **Grading** | Score entry, component weights, final grades |
| **Attendance** | Daily AM/PM and per-subject sheets |
| **Grade flags** | Learners whose averages fall below thresholds |
| **Anecdotal** | Record observations in confidential folders |
| **Advisory** | Adviser-only: roster, advisee academics/attendance, approvals, ADM, modules |
| **Schedule** | Your timetable |
| **Settings** | Profile, term, preferences |

### 4.1 Recording grades

1. Go to **Grading** and pick a section and subject.
2. Choose a component — Written Work, Performance Task, or Exam — and enter
   scores per assessment. Weights are configured per subject.
3. Zentra applies the DepEd transmutation automatically and shows the computed
   grade.
4. When a class is complete, **lock** the final grades. Locked grades go to the
   adviser for approval; once approved they are final for the term.

Changing a score after locking requires the normal unlock/approval path — the
system keeps an audit trail of every change.

### 4.2 Taking attendance

- **Daily sheet:** mark AM and PM per learner.
- **Per-subject:** open the class session and mark attendance for that subject.
- Weekend, future-date, and Philippine-holiday entries are blocked.
- Any sheet not recorded by the cutoff is automatically marked absent by the
  hourly sweep; correct it by editing the sheet.

### 4.3 Anecdotal records (confidential)

1. Open **Anecdotal** and choose or create a folder for the learner.
2. Write the observation, pick a category, and save.
3. The record stays confidential — visible to guidance/nurse/authorized staff,
   not to the learner's other teachers by default.
4. A serious observation can be **referred** to guidance. Referrals move through
   triage into counseling or health sessions.

Advisers can request temporary access to their advisees' SF10 records from the
**Advisory → SF10 access** area; the records desk approves or rejects the request.

### 4.4 Advisory modules

Advisers release section-wide modules from **Advisory → Modules**. Learners
submit a link, a file, or a physical output. The desk shows an aggregate status
plus a per-learner submission table. ADM cases in the adviser's section merge
these advisory modules with the coordinator's ADM modules, so progress is
computed across both.

---

## 5. Guidance desk

**Home:** `/guidance/overview`

| Page | Purpose |
|---|---|
| **Overview** | Current caseload and alerts |
| **Alerts** | Merged at-risk queue (referrals + interventions) |
| **Risk** | Risk dashboards and heatmaps |
| **Referrals** | Intake and case pipeline |
| **Interventions** | Engine-created cases, sessions, approvals, outcomes |
| **Anecdotal** | Confidential observation records |
| **Session documents** | Counseling/home-visitation documents |
| **ADM** | Cases routed to guidance |
| **Settings** | Profile and preferences |

### 5.1 Handling a referral

1. Open **Referrals**. New cases sit in the intake queue.
2. **Triage** the referral: accept it, escalate it, or reassign it to the nurse
   or another counselor.
3. Add **notes**, schedule **follow-ups**, and record **sessions** with
   attachments.
4. Close the case only after at least one session is completed — Zentra refuses
   an empty close-out.
5. Every step appears on the case timeline and is audited.

### 5.2 Interventions

The risk engine creates interventions automatically when a learner is flagged
(for example, an average below 75 or attendance below 80%). Work the case
through sessions, record the outcome, and submit it for approval.

---

## 6. Nurse desk

**Home:** `/nurse/overview`

| Page | Purpose |
|---|---|
| **Overview** | Clinic activity |
| **Referrals** | Two boards: *Clinic matters* and *ADM cases* |
| **Health records** | Clinic visits, including walk-ins |
| **ADM** | Health-side consultation for ADM candidates |
| **Alerts** | Health-relevant alerts |
| **Settings** | Profile and preferences |

Clinic visits can be recorded as walk-ins (not tied to a referral) or attached
to a referral. Attach visit notes and documents where needed. ADM cases routed
to the nurse are reviewed on the ADM board.

---

## 7. ADM Coordinator desk

**Home:** `/coordinator/overview`

| Page | Purpose |
|---|---|
| **Overview** | ADM pipeline summary |
| **Enrolled** | Learners enrolled under ADM |
| **Referrals** | Cases forwarded to the coordinator |
| **Certifications** | Cases ready for certification and principal approval |
| **Devices** | Devices issued to ADM learners |
| **Settings** | Profile and preferences |

### 7.1 The ADM case flow

```
anecdotal → consultation → meeting_parents → home_visitation
   → certification → principal_approval → enrollment_monitoring → completion
```

1. A learner is referred and evaluated for eligibility.
2. The coordinator builds the learner profile and books **parent meetings** and
   **home visitations**, recording minutes and attachments.
3. When the case is ready, **certify** it. Certification forwards it to the
   principal.
4. The principal signs; if returned, the case comes back to certification with
   a reason.
5. After approval, track **modules** and **devices** through completion.

The principal's signature is a drawn signature saved once in their profile and
reused on every approval.

---

## 8. Records desks — Record Keeper and Registrar

**Home:** `/record-keeper/overview` or `/registrar/overview`

| Page | Purpose |
|---|---|
| **Overview** | Desk summary |
| **Accounts** | Pending registrations for the band |
| **Adviser access** | SF10 access requests from advisers |
| **Final grades** | Locked finals submitted for the band |
| **SF10** | Learner permanent records |
| **Settings** | Profile and preferences |

### 8.1 Approving accounts

Pending staff/student registrations appear in **Accounts**. Verify the details
(including LRN matches) and approve or reject. Approved users become active and
can sign in.

### 8.2 Working with SF10 records

1. Upload photos or a file of the existing SF10; Zentra runs OCR to help capture
   the text.
2. Review and correct the captured data.
3. Move the record through **verify → validate → release**. Each step is
   recorded, and the original is never overwritten — every edit appends a
   version.
4. **Release** makes the record official for its band.
5. Advisers who need access submit a request; approve it for a limited period
   from **Adviser access**.

### 8.3 Final grades

Locked finals arrive from teachers. Review them for the band and confirm the
adviser approval state. Anything suspicious can be flagged for correction.

---

## 9. Principal desk

**Home:** `/principal/overview`

| Page | Purpose |
|---|---|
| **Overview** | School-wide academics, attendance, risk, ADM |
| **Academics** | Sections, subjects, assignments, schedules |
| **Risk** | Dashboards, heatmaps, interventions |
| **Honor roll** | Live honor-roll computation |
| **ADM** | Final approvals and returns |
| **Reports** | School-wide reports with a scope picker |
| **Audit** | Audit log of sensitive actions |
| **Settings** | Profile, signature, and term scope |

### 9.1 Term management

In **Settings**, choose or create school years and terms and set the active one.
The principal's chosen scope applies to every principal page. If you need to
change scope for a single report, use the scope picker on **Reports**.

### 9.2 Approving ADM cases

1. Certified ADM cases appear in the approval lane.
2. Open a case, review its documents and history.
3. Sign to approve — this requires a saved drawn signature. Without one, Zentra
   asks you to add it in Settings first.
4. To send a case back, choose **Return** and give a reason; it moves back to
   certification and stays in the *Returned* lane until re-certified.

### 9.3 Confidentiality

The principal sees that a confidential case exists and its status, but not the
sensitive write-ups. This is deliberate: oversight without unnecessary access to
counseling and health detail.

---

## 10. Common tasks

| Task | Where | Who |
|---|---|---|
| Submit a module | Student → Modules | Student |
| Enter and lock grades | Teacher → Grading | Subject Teacher |
| Approve final grades | Teacher → Advisory | Adviser |
| Take daily attendance | Teacher → Attendance | Teacher / Adviser |
| File a referral | Teacher → Anecdotal → Refer | Teacher / Adviser |
| Triage a referral | Guidance → Referrals | Guidance |
| Record a clinic visit | Nurse → Health records | Nurse |
| Certify an ADM case | Coordinator → Certifications | ADM Coordinator |
| Approve an ADM case | Principal → ADM | Principal |
| Approve an account | Records desk → Accounts | Record Keeper / Registrar |
| Request SF10 access | Teacher → Advisory | Adviser |

---

## 11. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| "Account pending" at login | Registration is awaiting approval by the records desk |
| Sent to the error page | Session expired or revoked — sign in again |
| Page shows the wrong term | Teachers: check the term selector. Principal: check Settings scope |
| A learner is missing from a list | Wrong section/term, or the learner is only on the roster with no account |
| Cannot close a referral | At least one completed session is required |
| Cannot approve an ADM case | Add a drawn signature in Settings first |
| Module not visible to a student | It has not been released to that section |
| "Forbidden" on a records page | The record belongs to the other grade band |
| Changes appear late | Lists cache for a few seconds; wait or reload |

If something looks wrong, note the page, the learner or case, and the time, then
report it to your records desk or the system administrator.

---

## 12. Related documents

- System architecture — [`../architecture/system-architecture.md`](../architecture/system-architecture.md)
- Developer setup and conventions — [`../guides/developer-guide.md`](../guides/developer-guide.md)
- Per-role module specifications — [`../role-modules/`](../role-modules/)
- Documentation index — [`../README.md`](../README.md)
