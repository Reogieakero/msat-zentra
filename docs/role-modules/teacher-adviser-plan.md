# Adviser & Subject Teacher — Planning Document

> Pre-implementation plan for the **Subject Teacher** and **Adviser** web
> module specifications. Closes the `docs/role-modules/` gap (currently only
> `principal.md` and `registrar.md` exist per `docs/role-modules/README.md`).
>
> Grounded in `PLAN.md` §4 (RBAC), §4.3 (confidentiality tiering), §5 (API
> surface), §6 (core logic), and §8 (audit). Visual language follows
> `frontend-design-direction.md` (off-white workspace, single accent,
> `rounded-md`, 1px borders, task-dense).
>
> Legend: 👁 visible · ✎ action allowed · 🔒 denied / hidden.

---

## 0. Scope

This plan covers **two roles**, both surfaced through the same `/teacher/*`
route tree with a server-side role+assignment check:

1. **Subject Teacher** — assigned subjects/classes only.
2. **Adviser** — Subject Teacher surface **plus** an advisory class.

In the database (`users.role`), both map to `teacher`; the difference is
**section assignment** (`section_advisers`) and the gating flag `is_adviser`
applied server-side. One teacher can be both; the page tree renders the
adviser surfaces only when `section_advisers` contains them for a current
section.

### Deliverables
1. `docs/role-modules/subject-teacher.md` — module page spec.
2. `docs/role-modules/adviser.md` — module page spec (extends teacher + adds
   adviser-only surfaces).
3. `docs/role-modules/README.md` — update status table.
4. Frontend scaffolding plan (sidebar nav, route tree, role gating).

Out of scope (covered elsewhere or future):
- Student/Parent/Admin modules.
- Mobile app screens.
- Backend route implementation (this plan produces the **spec**, not code).

---

## 1. Account Facts

| Field | Subject Teacher | Adviser |
|---|---|---|
| `users.role` | `teacher` | `teacher` (same) |
| Self-register? | Yes (`/register/staff`) | Yes (same form, adviser flag set later) |
| Approver | Registrar or Record Keeper | Registrar or Record Keeper |
| Differentiator | `teacher_subjects` rows | `section_advisers` rows (one per advisory section) |
| Auth gate | `requireRole('teacher')` + assignment filter | `requireRole('teacher')` + `is_adviser === true` for adviser routes |
| Self-claim classes? | **No** — school office assigns | **No** — school office assigns advisory section |

---

## 2. Page Index (combined route tree)

Routes are namespaced under `/teacher`. The sidebar renders **only the links
the logged-in teacher has access to** — server-side, not by hiding in JS.

```
/teacher
├── /dashboard                 (all teachers)
├── /classes                   (all teachers — list of assigned classes)
│   └── /:classId              (single class workspace)
│       ├── /gradebook         (subject teacher: by subject; adviser: read-only all subjects in advisory section)
│       ├── /assessments       (subject teacher only)
│       └── /students          (subject)
├── /advisory                  (adviser only — visible iff section_advisers row exists)
│   ├── /students              (roster + status)
│   ├── /attendance            (daily AM/PM)
│   ├── /anecdotal             (behavior/incident reports)
│   ├── /referrals             (refer to Guidance/Nurse)
│   └── /adm-cases             (read ADM case status for advisees)
├── /modules                   (adviser — owns SF10)
│   └── /sf10                  (upload + OCR verify)
├── /grade-flags               (any teacher — raise flags; subject teacher also resolves own)
├── /settings                  (profile, notifications)
```

Adviser routes return **404** for a non-adviser teacher (server-side gate, not
a redirect).

---

## 3. Subject Teacher — Sidebar Links & Pages

### Sidebar (left rail, sticky, ~240px, off-white `#FAFAF9`, 1px right border)
| Link | Visible to | Route | Source data |
|---|---|---|---|
| Dashboard | all teachers | `/teacher/dashboard` | `dashboard_cards` (today's classes, pending scores, flagged grades) |
| My Classes | all teachers | `/teacher/classes` | `teacher_subjects` ∪ `class_sections` |
| Grade Flags | all teachers | `/teacher/grade-flags` | `grade_flags` where `raised_by=me` |
| Settings | all teachers | `/teacher/settings` | `users`, `notification_prefs` |

No "Advisory", "Attendance", "Anecdotal", "Modules/SF10", or "Referrals" links
appear for a pure subject teacher (server-side render).

### 3.1 Dashboard `/teacher/dashboard`

**Layout**
```
┌──────────────────────────────────────────────────────────────────┐
│ TopBar · SY ▾ · Term ▾   🔔(n)  ⚙                                │
├────────────┬─────────────────────────────────────────────────────┤
│ Sidebar    │ MAIN                                                  │
│            │  KPI strip:  [Classes] [Pending scores] [Flags] [SY] │
│            │  ─────────────────────────────────────────────────   │
│            │  Today: per-class cards (period, section, room)      │
│            │  Recent activity: grade locks, flags, notifications  │
└────────────┴─────────────────────────────────────────────────────┘
```

**Widgets**
- 👁 KPI cards: count of assigned class sections, count of unsubmitted
  assessments this term, count of open grade flags I raised, current
  SY/term status.
- 👁 **Today's schedule** — derived from `class_sections.schedule_json`,
  filtered to today's weekday. Each card links to `/teacher/classes/:id`.
- 👁 **Recent activity feed** — last 10 items from `audit_logs` where
  `actor_id=me` (subject teacher scope).
- 🔒 No student-level academic risk rollups (Guidance-only).

**Interactions**
- Click class card → `/teacher/classes/:id` (defaults to gradebook tab).
- ✎ Click pending score badge → opens the corresponding assessment row.

**States**
- Loading: skeleton KPI strip + 3 placeholder cards.
- Empty (no assignments yet): "No classes assigned. Contact the school
  office."

### 3.2 My Classes `/teacher/classes`

**Layout** — list/table of assigned class sections.
- 👁 **Columns:** Subject, Grade level, Section, Schedule, Student count,
  Action (Open).
- Sorted by grade level → section.
- 🔒 Filters hidden: ❌ Grade level, ❌ Subject, ❌ Section selectors beyond
  the assigned subset (server already filters).

### 3.3 Class Workspace `/teacher/classes/:classId`

Tabbed page (default tab: **Gradebook** for subject teacher).

**Tab: Gradebook**
- 👁 Students roster (left mini-list), assessment columns (top scroll).
- 👁 Per-student cell shows raw score; row footer shows class average.
- ✎ Inline edit on cell → modal "Enter score" → `POST /api/grades/assessments/:id/score`.
- ✎ "Add assessment" → modal: type (WW/PT/QE), max score, weight, due date.
- ✎ "Lock grades" (end of term) → confirmation → `POST /api/final-grades/:id/lock`
  (subject teacher completes this step per Role Workflow §3; DepEd
  transmutation runs automatically per `PLAN.md` §6.1).
- 👁 Color-coded transmuted grade chip (DepEd 90–100=Outstanding, etc.).
- 🔒 **No** attendance, **no** anecdotal, **no** health, **no** ADM columns.

**Tab: Assessments** (subject teacher only)
- 👁 Table of assessments with status (draft/published/scores-locked).
- ✎ Create / edit / publish / delete (draft only).

**Tab: Students** (subject teacher only)
- 👁 Read-only student list (LRN, name, gender). No contact info, no address.

### 3.4 Grade Flags `/teacher/grade-flags`

**Layout** — two stacked tables.
- 👁 **Raised by me** (open + resolved) — shows flag, target grade, owner
  teacher, status, age.
- 👁 **Raised against my gradebook** (anyone can flag any teacher's grade per
  Role Workflow §4; subject teacher sees flags on grades they own).
- ✎ **Raise flag** → choose student, subject, term, reason → creates row
  with `raised_by=me`, `status=open`, `escalation_threshold_days` from system
  config.
- ✎ **Resolve** (owner only) → resolution note → status `resolved`,
  `resolved_by=me`, audit row.
- 🔒 Cannot resolve flags I did not raise.

**Escalation** (server-side, not UI): `escalation_threshold_days` pass →
auto-creates an entry in Principal's escalated-flags dashboard
(see `principal.md`); original teacher still owns resolution until then.

### 3.5 Settings `/teacher/settings`
- ✎ Edit own profile (name, contact, avatar).
- ✎ Notification preferences (channel matrix: in-app/email, per event type).
- 🔒 Cannot edit role, status, or assigned classes (school-office only).

---

## 4. Adviser — Extra Sidebar Links & Pages

An adviser sees **all Subject Teacher links** plus:

| Additional link | Route |
|---|---|
| Advisory | `/teacher/advisory/students` |
| Attendance | `/teacher/advisory/attendance` |
| Anecdotal | `/teacher/advisory/anecdotal` |
| Referrals | `/teacher/advisory/referrals` |
| ADM Cases | `/teacher/advisory/adm-cases` |
| Modules (SF10) | `/teacher/modules/sf10` |

The advisory section is the single section in `section_advisers` for the
current SY where this teacher is listed. If a teacher is adviser of multiple
sections, an **Advisory selector** appears in the TopBar (server confirms
exactly which section is in scope per request).

### 4.1 Advisory Students `/teacher/advisory/students`

**Layout**
```
┌──────────────────────────────────────────────────────────────────┐
│ MAIN                              │ RIGHT SIDEBAR                 │
│  Filter chips: [All][Low][Mod][High]│  Quick filters                │
│  Student cards (grid):            │  • Has open flag              │
│   Avatar · Name · LRN · Status    │  • Attendance < 80%           │
│   Category chips (academic/att/   │  • Has anecdotal (count)      │
│   behavioral)                     │                                │
└──────────────────────────────────────────────────────────────────┘
```

- 👁 Per advisee: profile (name, LRN), `risk_level` chip
  (Low/Moderate/High), behavioral category flag chip **only** — never the
  write-up text.
- 👁 Click card → drawer with:
  - Subject grades (read-only, all subjects in this section).
  - Attendance rate (read-only, current term).
  - Anecdotal count + confidentiality-tier badge (no content unless I own it
    or I have granted access — see §6).
  - Active referrals + ADM case status (stage only).
- ✎ "Write anecdotal" → opens anecdotal composer.
- ✎ "Refer to Guidance/Nurse" → opens referral composer.
- ✎ "Request full records access" (adviser-only, see §6).
- 🔒 **Never** sees non-advisee students or other advisers' advisees.

### 4.2 Attendance `/teacher/advisory/attendance`

**Layout** — daily attendance sheet.
- 👁 Date picker (default: today). Tabs: **Morning (AM)** / **Afternoon (PM)**.
- 👁 Roster rows × present/absent/late/excused radio per row.
- ✎ Bulk submit (`POST /api/attendance/bulk`) — one payload per session
  (AM/PM). Per `PLAN.md` §5.
- ✎ Edit today's entry before EOD lock window; 🔒 past days locked unless
  admin override.
- 👁 Per-row attendance rate (term) shown beside name as a secondary chip.
- 🔒 No other sections, no behavior, no grades.

**Notifications fired:** absent/late → parent (in-app + email per
notification prefs).

### 4.3 Anecdotal `/teacher/advisory/anecdotal`

**Layout** — list + composer drawer.
- 👁 List of own anecdotal records for advisees: date, student, category
  (behavioral/academic/emotional/other), confidentiality level badge
  (owning-adviser = full view).
- ✎ **New anecdotal** → composer with:
  - Student (advisee only).
  - Category.
  - **Confidentiality level** dropdown: `low` / `medium` / `high` (adviser
    sets; matches `anecdotal_records.confidentiality_level`).
  - Write-up (rich text).
  - Attachments (max 5, ≤10MB each).
- ✎ Edit own (within edit window per `audit_logs` policy).
- ✎ Add follow-up entry on existing record.
- ✎ **Refer** from a record → opens referral composer with the anecdotal
  pre-linked (`referrals.source_record_id`).
- 🔒 Cannot view other advisers' anecdotal records for other students; can
  view another adviser's anecdotal about **my advisee only when** my access
  request is approved (§6).

### 4.4 Referrals `/teacher/advisory/referrals`

**Layout** — kanban-style status columns:
`Referred → Meeting scheduled → Home visit (if needed) → Resolved/Referred out`.
- 👁 Cards per referral: student, target role, category, status, age.
- ✎ New referral (adviser-only source: anecdotal-driven).
- ✎ Add meeting outcome (if I attended the parent meeting).
- ✎ Request home visit (when parent no-showed).
- 🔒 Cannot see referrals I did not originate **unless** I'm listed as a
  participant (`referral_participants`) — in which case I see status +
  category only, never the write-up content.

### 4.5 ADM Cases (read-only) `/teacher/advisory/adm-cases`
- 👁 Advisees in the ADM pipeline — stage only
  (`referral → parent_meeting → home_visit → recommendation → principal_approval → modules → completion`).
- 👁 Module status (issued/submitted/completed) per advisee.
- ✎ "Mark module submitted on behalf of student" if student self-mark didn't
  happen (per Role Workflow §1, §5 — staff can record on student's behalf).
- 🔒 **No** `adm_learner_profiles` confidential columns. No health detail.
No guidance notes. No ADM Coordinator's recommendation text — only the stage
label.

### 4.6 Modules (SF10) `/teacher/modules/sf10`

**Layout** — list + upload + OCR verify.
- 👁 My advisees' SF10 records, filterable by SY and validation status.
- ✎ Upload PDF/image (Multer → OCR job, per `PLAN.md` §7).
- ✎ Review extracted fields (jsonb view) → edit / confirm → `verified_by=me`,
  `verified_at`.
- ✎ Lock final quarterly grades → submits to Registrar (11–12) or Record
  Keeper (7–10) for `validate`.
- 👁 Per-record version history (append-only).
- 🔒 SF10 for non-advisees invisible.

---

## 5. Cross-Cutting Rules

- **Server-side filtering is authoritative.** The client never receives
  classes, sections, students, or rows the teacher is not assigned to. Per
  `PLAN.md` §4.3 row-level RLS plus app-layer hide.
- **Confidentiality tier** (`low` / `medium` / `high`) on anecdotal records
  is enforced server-side. Adviser (writer) and referred role (Guidance /
  Nurse / LRPC) see the write-up; Principal sees the row but app hides the
  text (status-only).
- **Audit:** every grade write, anecdotal edit, attendance submit, flag raise
  / resolve, referral status change, SF10 verify writes an `audit_logs` row.
- **Notifications:** in-app + email per `notification_prefs`; advisory
  triggers notifications fire on attendance anomaly and status change.
- **No client-side role switching.** Role is from JWT. `is_adviser` is from
  `section_advisers` lookup, cached on session.
- **Stop conditions / human review** are out of scope for this planning doc
  but will be added when implementation prompts are written.

---

## 6. Adviser "Full Records Access" Request Flow

Per Role Workflow §4 footnote, an adviser can request full records access to
their advisees. This is a **two-step request + approve**, not auto.

**Request side (adviser)**
- Page: drawer action from `/teacher/advisory/students` → "Request full
  records access".
- Form: scope (single advisee or all advisees), reason, duration (days, max
  30).
- Submits → `access_requests` row (`status=pending`, `requested_by=me`,
  `approver_role` resolved server-side by advisee grade band: 7–10 →
  Record Keeper; 11–12 → Registrar).

**Approver side**
- Record Keeper or Registrar sees pending requests in their respective
  dashboard queue (already wired for adviser access requests per Role
  Workflow §8/§9).
- Approve / deny with reason → status changes; audit row written.

**Enforcement**
- Approved access unlocks read access to confidential columns of the named
  advisee(s) for the requested duration only.
- Server enforces expiry (`expires_at`) — UI hides the unlocked columns
  when expired but RLS still gates.
- Denial / expiry → access removed on next request cycle.

---

## 7. Sidebar Link Source-of-Truth (for frontend build)

```ts
// server-side, returns nav tree
function buildTeacherNav(user, sectionAdviserFor) {
  const nav = [
    { label: 'Dashboard', href: '/teacher/dashboard', visible: true },
    { label: 'My Classes', href: '/teacher/classes', visible: true },
    { label: 'Grade Flags', href: '/teacher/grade-flags', visible: true },
    { label: 'Settings', href: '/teacher/settings', visible: true },
  ];
  if (sectionAdviserFor) {
    nav.push(
      { label: 'Advisory', href: '/teacher/advisory/students' },
      { label: 'Attendance', href: '/teacher/advisory/attendance' },
      { label: 'Anecdotal', href: '/teacher/advisory/anecdotal' },
      { label: 'Referrals', href: '/teacher/advisory/referrals' },
      { label: 'ADM Cases', href: '/teacher/advisory/adm-cases' },
      { label: 'Modules (SF10)', href: '/teacher/modules/sf10' },
    );
  }
  return nav;
}
```

Client never decides visibility; it only renders what the server returned.

---

## 8. API Surface Touched (cross-ref to `PLAN.md` §5)

| Method | Route | Teacher | Adviser |
|---|---|---|---|
| GET | `/api/teacher/classes` | 👁 own assignments | 👁 own assignments |
| GET | `/api/classes/:id/gradebook` | 👁 own subject | 👁 read-only all subjects in advisory section |
| POST | `/api/grades/assessments/:id/score` | ✎ own subject | ✎ own subject |
| POST | `/api/final-grades/:id/lock` | ✎ own | ✎ own (then forwards to registrar) |
| POST | `/api/attendance/bulk` | 🔒 | ✎ for advisees AM/PM |
| GET | `/api/students/:id/attendance-rate` | 🔒 | 👁 advisees only |
| POST | `/api/anecdotal` | 🔒 | ✎ for advisees |
| POST | `/api/anecdotal/:id/refer` | 🔒 | ✎ own anecdotal → referral |
| GET | `/api/referrals?mine=true` | 🔒 | 👁 originated + participant |
| GET | `/api/adm/cases?adviser=me` | 🔒 | 👁 status only |
| POST | `/api/adm/modules/:id/submit-on-behalf` | 🔒 | ✎ |
| POST | `/api/sf10/upload` | 🔒 | ✎ advisees only |
| GET | `/api/sf10/:jobId` | 🔒 | ✎ |
| POST | `/api/sf10/:id/verify` | 🔒 | ✎ |
| POST | `/api/grade-flags` | ✎ (any student's grade) | ✎ |
| POST | `/api/grade-flags/:id/resolve` | ✎ if owner of gradebook | ✎ if owner |
| POST | `/api/access-requests` | 🔒 | ✎ |
| GET | `/api/risk/students/:id` | 🔒 | 👁 advisees only |

---

## 9. Out-of-Scope / Open Questions

- **Mobile parity:** Plan covers web only. Mobile teacher screens will be a
  separate plan.
- **Bulk anecdotal import:** Not in scope.
- **Adviser-of-multiple-sections UX:** Plan assumes one advisory section
  primary; TopBar selector appears if more than one. [DESIGN PROPOSAL]
- **Grade flag auto-resolution on edit:** Should editing the underlying grade
  auto-resolve an open flag? Currently flagged for product decision. Not
  blocking for this plan.
- **Co-advisers:** Two advisers per section is supported in the data model
  but the UX assumes one primary. [DESIGN PROPOSAL]

---

## 10. Next Steps

1. Write `docs/role-modules/subject-teacher.md` from §3 + §5 + §7 + §8.
2. Write `docs/role-modules/adviser.md` from §4 + §5 + §6 + §7 + §8.
3. Update `docs/role-modules/README.md` status table to mark both ✅ Done.
5. Generate the implementation prompts (one per module page) using the
   zentra-design skill tokens — separate task.
6. Sprint slot: these fall under Sprint 3 (Teacher/Adviser surfaces) per
   `PLAN.md` §10.