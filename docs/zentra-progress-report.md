# Zentra — UX Sitemap + Implementation Progress Audit

**Mati School of Arts and Trades · September 23, 2026**
**Full technical audit: sitemap, roles, user flows, progress matrix, UX states, navigation, gaps, target sitemap, roadmap, testing checklist.**

> Method: inspected actual code, not filenames. Frontend `frontend/src`
> (Next.js App Router) + backend `backend/src` (Express + Prisma) + `PLAN.md`
> + `docs/`. No code was modified. Items that could not be verified from the
> codebase are marked **UNVERIFIED**.
>
> Status scale: Complete > Functional > Partial > Skeleton > Planned > Not started.
> Symbols: ✓ = implemented · ⚠ = partially implemented · ✗ = missing · N/A = not applicable.

---

## A. Application Overview

**Zentra** is a Student Information & Management System for Mati School of Arts
and Trades (Grades 7–12, trimester). Web app is **Next.js 16 + React 19 +
TypeScript + TanStack Query + Axios + shadcn/ui** (`frontend/src`); API is
**Express + Prisma + Supabase Postgres** (`backend/src`, ESM, handlers inline
in `*.routes.ts`, no controllers folder). Auth is **JWT access+refresh
(argon2)** with role claim + grade-band claim; backend enforces `requireAuth /
requireRole / requireOwnershipOrRole` (`backend/src/middleware/auth.ts`) plus
`gradeBandGuard` (`backend/src/middleware/gradeBand.ts`).

What works today: 8 staff role shells are **functional end-to-end** (live
queries, skeletons, error/retry, toasts, confirm dialogs, audit +
notifications on writes). The referral → intervention → ADM pipeline, grading
+ attendance + risk engine, registrar/record-keeper banded workflows,
principal oversight boards, and print sheets are all wired to real Prisma
handlers — **no stub routers** (every mounted router has working handlers;
zero `TODO/FIXME/stub` markers in source).

What is missing: the **student and parent portals do not exist** (can log in,
have nowhere to go), plus password reset, report cards, record-keeper SF10,
settings/profile, and principal calendar management. Three dead-nav targets
404, one backend endpoint never responds (`POST /api/anecdotal/`), one
band-scoping bug leaks SHS audit data to the record keeper, and realtime
covers only 3 of 8 shells.

---

## B. Current UX Sitemap (actual, verified)

```text
E-zentra (current, as built)
│
├── Public
│   ├── Landing (/) — frontend/src/app/page.tsx → components/landing/LandingPage
│   ├── Login picker (/login) — role cards → /login/students | /login/staff | /login/parents
│   │   ├── /login/students (LRN identifier + LoginForm role=student)
│   │   ├── /login/staff (school email + LoginForm role=staff)
│   │   └── /login/parents (email/mobile + LoginForm role=parent)
│   ├── Register (/register) — RegisterForm, student only wired
│   └── Errors (/errors/[code]) — 401/403/404/500 via StatusPage
│
├── Guidance Counselor (/guidance/*, layout: guidance/layout.tsx, guarded guidance_counselor)
│   ├── Overview (/guidance/overview)
│   ├── Alerts (/guidance/alerts)
│   ├── Referrals (/guidance/referrals + /referrals/adm + /referrals/counseling)
│   ├── ADM queue (/guidance/adm)
│   ├── Interventions (/guidance/interventions)
│   ├── Anecdotal desk (/guidance/anecdotal)
│   └── Risk (/guidance/risk + /risk/heatmap + /risk/behavioral)
│
├── Teacher / Adviser (/teacher/*, layout: teacher/layout.tsx, NO guard)
│   ├── Overview (/teacher/overview)
│   ├── My Classes (/teacher/classes)
│   ├── Attendance (/teacher/attendance — AM/PM sheet)
│   ├── Gradebook (/teacher/grading + /teacher/grading/[assignmentId] workspace)
│   ├── Grade Flags (/teacher/grade-flags — raise + history)
│   ├── Advisory → Students (/teacher/advisory/students + /[id]/attendance + /[id]/academic)
│   ├── Advisory → Referrals (/teacher/advisory/referrals — canvas/library/composer)
│   ├── Advisory → ADM Cases (/teacher/advisory/adm-cases — read-only)
│   └── Records → Anecdotal chat (/teacher/anecdotal + /anecdotal/folders + /folders/student/[studentId])
│
├── Nurse (/nurse/*, layout: nurse/layout.tsx, guarded nurse)
│   ├── Overview (/nurse/overview)
│   ├── Referred Cases (/nurse/alerts — referrals + notifications panel)
│   ├── ADM Cases (/nurse/referrals/adm)
│   ├── Clinic Matters (/nurse/referrals/clinic)
│   ├── ADM Referrals (/nurse/adm)
│   ├── Health Records (/nurse/health-records — read-only archive)
│   └── Risk (/nurse/risk)
│
├── Principal (/principal/*, layout: principal/layout.tsx, GradeModeProvider, NO guard)
│   ├── Overview (/principal/overview)
│   ├── Academics (/principal/academics)
│   ├── Risk Board (/principal/risk + /risk/students + /risk/interventions
│   │              + /risk/heatmaps/attendance + /heatmaps/academics + /heatmaps/records)
│   ├── ADM Cases (/principal/adm + /adm/referrals/all + /adm/approvals/all)
│   ├── Honor Roll (/principal/honor-roll)
│   ├── Reports (/principal/reports)
│   └── Audit Log (/principal/audit)
│
├── ADM Coordinator (/coordinator/*, layout: coordinator/layout.tsx, guarded adm_coordinator)
│   ├── Overview (/coordinator/overview)
│   ├── Referrals (/coordinator/referrals — intake + create-profile)
│   ├── Enrolled (/coordinator/enrolled — monitoring/completion tabs)
│   ├── Certifications (/coordinator/certifications)
│   └── Devices (/coordinator/devices — issue/return ledger)
│
├── Registrar G11–12 (/registrar/*, layout: registrar/layout.tsx, NO guard)
│   ├── Overview │ Accounts │ Final Grades (+/[id]) │ Academics (+/assign, /subjects/[id], /teachers/[id])
│   ├── Adviser Access (/registrar/adviser-access)
│   └── SF10 (/registrar/sf10 — upload panel only)
│
├── Record Keeper G7–10 (/record-keeper/*, layout: record-keeper/layout.tsx, NO guard)
│   └── Overview │ Accounts │ Final Grades (+/[id]) │ Academics (+same 3 subs) │ Adviser Access
│       (mirrors registrar; NO sf10 page despite sidebar link)
│
└── Print (no role shell)
    ├── /record/[assignmentId] — class-record grid
    └── /record/[assignmentId]/solution/[studentId] — per-student sheet
```

Route count: ~84 `page.tsx` routes (7 public + 12 guidance + 14 teacher +
9 nurse + 15 principal + 6 coordinator + 10 registrar + 9 record-keeper +
2 print). No `/student/*`, no `/parent/*`, no `middleware.ts` (verified —
glob finds none).

---

## C. Role → Sitemap Matrix

Backend role enum (`prisma/schema.prisma` + `frontend/src/lib/auth/roles.ts`):
10 roles — `student, parent, subject_teacher, adviser, nurse,
adm_coordinator, guidance_counselor, record_keeper, registrar, principal`.

| Role | Accessible areas (as built) | Main tasks (working) | Status |
| ---- | --------------------------- | -------------------- | ------ |
| Principal | `/principal/*` (15 pages) | School-wide overview, risk boards + 3 heatmaps, ADM sign/return, honor roll, reports, audit drill-down (status-only) | Functional |
| Registrar (G11–12) | `/registrar/*` (10 pages) | Pending student approvals, final-grade pipeline (view-only), sections/subjects/teachers/assign, adviser-access approve/deny, SF10 upload | Functional (SF10 partial) |
| Record Keeper (G7–10) | `/record-keeper/*` (9 pages) | Same as registrar, G7–10 band | Functional (no SF10 page at all) |
| Guidance Counselor | `/guidance/*` (12 pages) | Alerts triage, counseling + ADM referral queues, sessions/attachments, interventions queue + review, anecdotal desk, risk desk | Functional |
| Nurse | `/nurse/*` (9 pages) | Clinic + ADM queues, accept/forward/endorse, sessions, health-records archive, risk | Functional |
| ADM Coordinator | `/coordinator/*` (6 pages) | Intake → create-profile → parent meeting → certification → devices → enrolled/completion | Functional (monitoring partial) |
| Adviser | `/teacher/*` (+ attendance, advisory, anecdotal, ADM-cases) | AM/PM attendance, advisee roster, anecdotal filing (GCForm-01), referrals canvas, ADM-case tracking, grade-flag raising | Functional |
| Subject Teacher | `/teacher/*` (same shell; classes, grading workspace, flags) | Grade components/assessments/scores, weights presets, lock finals, anecdotal, flags | Functional |
| Student | **No portal** — login succeeds then `router.push("/student")` → **404** (`components/auth/LoginForm.tsx:77-86`) | Register (pending approval) only | Not started |
| Parent | **No portal** — login succeeds then `router.push("/parent")` → **404** (same lines) | Register only (parent path exists in form, `RegisterForm.tsx:14,34`) | Not started |

- Shared between roles: nothing — each role has an isolated shell/sidebar; no
  cross-role links (except print sheets, deep-link `?highlight=` in
  guidance/nurse queues).
- Role-specific actions are correctly split (e.g.
  `POST /api/grades/final-grades/:id/adviser-approve` is adviser-only;
  `POST /api/adm/:id/principal-approve` principal-only; banded registrar vs
  record-keeper routes).
- Appears accessible but should not be: `GET /api/registrar/accounts-audit`
  uses hardcoded G11–12 band instead of `roleGradeBand`, so a **record-keeper
  caller receives SHS audit data**
  (`backend/src/modules/registrar/registrar.routes.ts:804-878`). Backend
  **NEEDS AUDIT**.
- Missing role workflows: student self-view (grades/attendance/risk level),
  parent linked-child view + ADM meeting confirmation, principal calendar
  (years/terms) management, standalone nurse health-record and GC home-visit
  authoring.

Client guards: `useRoleGuard` is used in **only 3 of 8 layouts** (guidance,
nurse, coordinator). Teacher, principal, registrar, record-keeper layouts
render with **no client role check** (`teacher/layout.tsx`,
`principal/layout.tsx`, `registrar/layout.tsx`,
`record-keeper/layout.tsx`). Backend `requireRole` remains authoritative, so
this is a flash-of-wrong-shell issue, not a data leak — but inconsistent.

---

## D. User Flow Map

```text
Auth: /login → pick portal → identifier+password → POST /api/auth/login
        → JWT (zentra.access/refresh) → role→home → [student|parent → 404 ✗ BREAKS]
        Register: /register → POST /api/auth/register/student → pending → registrar/accounts approve
        → auto-creates StudentProfile + migrates roster grades/attendance (real) → notify
        Forgot link → /login/*/reset ✗ DEAD (no page) │ Google button → /api/auth/google ✗ DEAD (no route)
```

```text
Grading (teacher): overview → classes → grading/[assignmentId] workspace → components/weights
  → assessments → score grid → POST /api/grades/assessments/:id/score → recompute finals + risk
  → toast → invalidate → lock → adviser-approve → registrar final-grades (view-only)
  Status: WORKS. Print: /record/[assignmentId] + /solution/[studentId] live.
```

```text
Attendance (adviser): attendance → date+session → prefill GET /api/teacher/advisory/attendance
  → sheet → POST /api/attendance/bulk (PH/weekend/future guards) → risk recompute
  → parent notify on absent/late → toast → audit. WORKS.
```

```text
Anecdotal → Referral → Intervention → ADM (core spine):
  teacher/anecdotal chat (file) → POST /api/anecdotal/ ✗ HANGS (no res.json — backend bug §H-C1)
  → advisory/referrals composer → POST /api/anecdotal/:id/refer → referrals/mine
  → guidance/nurse alerts → accept → sessions/attachments → escalate/reassign/note
  → specialist/ADM forward → coordinator/referrals create-profile (POST /api/adm/profiles)
  → parent meeting branch (attended→minutes / missed→home visit flag, no dedicated form UI)
  → certifications endorse → principal/adm sign (principal-approve) or return
  → devices issue/return → enrolled monitoring (P2 API pending — partial) → completion
  → interventions auto-created on Moderate/High (services/risk.ts) → review/outcome
  Status: WORKS end-to-end except anecdotal-create hang + monitoring/form gaps.
```

```text
SF10: registrar/sf10 upload panel → POST /api/sf10/upload → verify (teacher) → validate
  (record keeper/registrar) → release. Backend full state machine exists; frontend mounts
  ONLY the upload panel (Sf10Repository/DetailSheet exist unmounted) + studentId passed is
  the STAFF's own sub (registrar/sf10/page.tsx:12-15 — wrong subject). PARTIAL, NEEDS AUDIT.
```

```text
Risk: live recompute on grade/attendance/anecdotal writes (services/risk.ts) → risk board/
  heatmaps/students/interventions read via /api/risk/* → auto-intervention → notifications
  (60s dedupe, derived types) → realtime invalidation on 3 shells only. WORKS, realtime partial.
```

```text
Reports/Audit: principal/reports (GET /api/reports, CSV export) + principal/audit
  (filter/paginate/CSV + status-only source drill-down). WORKS.
```

Friction noted: search box in 7 shells is a non-functional Command placeholder
(nurse omits it); avatar `Settings` menu item is dead in all shells; no
breadcrumbs anywhere (grep `breadcrumb` → 0); important actions split across
lookalike queues (`guidance/referrals/adm` vs `guidance/adm`;
`nurse/alerts` vs `nurse/referrals/*`) with only prefix-active sidebar state
to orient.

---

## E. Implementation Progress (every page)

Scale: Complete > Functional > Partial > Skeleton > Planned > Not started.
Symbols per §6: ✓ = implemented · ⚠ = partially implemented · ✗ = missing ·
N/A = not applicable. Actions = page performs writes/mutations (N/A =
read-only by design). Notifications = toast/feedback on those actions.

| Area | Page | Route | Role | UI | Data | Actions | Loading | Errors | Notifications | Realtime | Status |
| ---- | ---- | ----- | ---- | -- | ---- | ------- | ------- | ------ | ------------- | -------- | ------ |
| Public | Landing | `/` | Public | ✓ | N/A | N/A | ✓ | N/A | N/A | N/A | Functional |
| Public | Login picker | `/login` | Public | ✓ | N/A | N/A | ✓ | N/A | N/A | N/A | Functional |
| Public | Student sign-in | `/login/students` | Public | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | N/A | Functional |
| Public | Staff sign-in | `/login/staff` | Public | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | N/A | Functional |
| Public | Parent sign-in | `/login/parents` | Public | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | N/A | Functional |
| Public | Register | `/register` | Public | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | N/A | Functional |
| Public | Error pages | `/errors/[code]` | Public | ✓ | N/A | N/A | N/A | ✓ | N/A | N/A | Functional |
| Guidance | Overview | `/guidance/overview` | Counselor | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✓ | Functional |
| Guidance | Alerts | `/guidance/alerts` | Counselor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Guidance | Referrals | `/guidance/referrals` | Counselor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Guidance | ADM cases | `/guidance/referrals/adm` | Counselor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Guidance | Counseling cases | `/guidance/referrals/counseling` | Counselor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Guidance | ADM queue | `/guidance/adm` | Counselor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Guidance | Interventions | `/guidance/interventions` | Counselor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Guidance | Anecdotal desk | `/guidance/anecdotal` | Counselor | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✓ | Functional |
| Guidance | Risk desk | `/guidance/risk` | Counselor | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✓ | Functional |
| Guidance | Risk heatmap | `/guidance/risk/heatmap` | Counselor | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✓ | Functional |
| Guidance | Behavioral | `/guidance/risk/behavioral` | Counselor | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✓ | Functional |
| Teacher | Overview | `/teacher/overview` | Teacher | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Teacher | My Classes | `/teacher/classes` | Teacher | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Teacher | Attendance | `/teacher/attendance` | Teacher | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Teacher | Gradebook | `/teacher/grading` | Teacher | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Teacher | Class workspace | `/teacher/grading/[assignmentId]` | Teacher | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Teacher | Grade flags | `/teacher/grade-flags` | Teacher | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Teacher | Advisory students | `/teacher/advisory/students` | Teacher | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Teacher | Student attendance | `/teacher/advisory/students/[id]/attendance` | Teacher | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Teacher | Student academics | `/teacher/advisory/students/[id]/academic` | Teacher | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Teacher | Referrals | `/teacher/advisory/referrals` | Teacher | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Teacher | ADM cases | `/teacher/advisory/adm-cases` | Teacher | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Teacher | Anecdotal filing | `/teacher/anecdotal` | Teacher | ✓ | ✓ | ⚠ | ✓ | ⚠ | ✓ | ✗ | Partial |
| Teacher | Record folders | `/teacher/anecdotal/folders` | Teacher | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Teacher | Student folder | `/teacher/anecdotal/folders/student/[studentId]` | Teacher | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Nurse | Overview | `/nurse/overview` | Nurse | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Nurse | Referred cases | `/nurse/alerts` | Nurse | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Nurse | ADM cases | `/nurse/referrals/adm` | Nurse | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Nurse | Clinic matters | `/nurse/referrals/clinic` | Nurse | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Nurse | ADM referrals | `/nurse/adm` | Nurse | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Nurse | Health records | `/nurse/health-records` | Nurse | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✓ | Functional |
| Nurse | Risk | `/nurse/risk` | Nurse | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✓ | Functional |
| Principal | Overview | `/principal/overview` | Principal | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Principal | Academics | `/principal/academics` | Principal | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Principal | Risk board | `/principal/risk` | Principal | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Principal | Risk students | `/principal/risk/students` | Principal | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Principal | Interventions | `/principal/risk/interventions` | Principal | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Principal | Attendance heatmap | `/principal/risk/heatmaps/attendance` | Principal | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Principal | Academic heatmap | `/principal/risk/heatmaps/academics` | Principal | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Principal | Records heatmap | `/principal/risk/heatmaps/records` | Principal | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Principal | ADM overview | `/principal/adm` | Principal | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Principal | ADM referrals | `/principal/adm/referrals/all` | Principal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Principal | ADM approvals | `/principal/adm/approvals/all` | Principal | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Principal | Honor roll | `/principal/honor-roll` | Principal | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✗ | Functional |
| Principal | Reports | `/principal/reports` | Principal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Principal | Audit log | `/principal/audit` | Principal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Coordinator | Overview | `/coordinator/overview` | Coordinator | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✓ | Functional |
| Coordinator | Referrals | `/coordinator/referrals` | Coordinator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Coordinator | Enrolled | `/coordinator/enrolled` | Coordinator | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓ | Partial |
| Coordinator | Certifications | `/coordinator/certifications` | Coordinator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Coordinator | Devices | `/coordinator/devices` | Coordinator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Functional |
| Registrar | Overview | `/registrar/overview` | Registrar | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Registrar | Accounts | `/registrar/accounts` | Registrar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Registrar | Final grades | `/registrar/final-grades` | Registrar | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Registrar | Final-grade detail | `/registrar/final-grades/[id]` | Registrar | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Registrar | Academics | `/registrar/academics` | Registrar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Registrar | Assign teachers | `/registrar/academics/assign` | Registrar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Registrar | Subject detail | `/registrar/academics/subjects/[id]` | Registrar | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Registrar | Teacher detail | `/registrar/academics/teachers/[id]` | Registrar | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Registrar | Adviser access | `/registrar/adviser-access` | Registrar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Registrar | SF10 | `/registrar/sf10` | Registrar | ✓ | ✓ | ⚠ | ⚠ | ⚠ | ✓ | ✗ | Partial |
| Record keeper | Overview | `/record-keeper/overview` | Keeper | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Record keeper | Accounts | `/record-keeper/accounts` | Keeper | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Record keeper | Final grades | `/record-keeper/final-grades` | Keeper | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Record keeper | Final-grade detail | `/record-keeper/final-grades/[id]` | Keeper | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Record keeper | Academics | `/record-keeper/academics` | Keeper | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Record keeper | Assign teachers | `/record-keeper/academics/assign` | Keeper | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Record keeper | Subject detail | `/record-keeper/academics/subjects/[id]` | Keeper | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Record keeper | Teacher detail | `/record-keeper/academics/teachers/[id]` | Keeper | ✓ | ✓ | N/A | ✓ | ✓ | N/A | ✗ | Functional |
| Record keeper | Adviser access | `/record-keeper/adviser-access` | Keeper | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Functional |
| Print | Class record | `/record/[assignmentId]` | Staff | ✓ | ✓ | N/A | ✓ | ✓ | N/A | N/A | Functional |
| Print | Student solution | `/record/[assignmentId]/solution/[studentId]` | Staff | ✓ | ✓ | N/A | ✓ | ✓ | N/A | N/A | Functional |
| Shells | Redirects (5) | `/guidance`, `/nurse`, `/nurse/referrals`, `/coordinator`, `/principal/risk/heatmaps` | Own shell | ✓ | N/A | N/A | N/A | N/A | N/A | N/A | Functional |
| Missing | Student portal | (no route) | Student | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Not started |
| Missing | Parent portal | (no route) | Parent | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Not started |
| Missing | Password reset | (no route) | Public | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Not started |
| Missing | Report cards | `/registrar/report-cards` | Registrar | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Planned |
| Missing | Report cards | `/record-keeper/report-cards` | Keeper | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Planned |
| Missing | SF10 | `/record-keeper/sf10` | Keeper | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Planned |
| Missing | Settings / Profile | (no route) | All | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Not started |
| Missing | School years / terms | (no route) | Principal | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Not started |

Notes: `/teacher/anecdotal` is Partial because its core submit hangs on the
missing backend response (§H-2). `/coordinator/enrolled` is Partial because
per-module timelines await the P2 monitoring API. `/registrar/sf10` is Partial
because only upload is mounted and it files under the wrong student (§H-3).
`/principal/honor-roll` stays Functional — its award-sheet copy is a
placeholder but all actions (candidate table, leaderboard, CSV export) work.
Nothing is marked Complete: even the best pages lack global search/settings
and full realtime.

---

## F. UX State Audit

Sampled across shells — the pattern is consistent, so one row per area:

| Area | Loading/Skeleton | Empty | Error+Retry | Button pending | Validation | Confirm | Toast | Realtime w/o refresh |
| ---- | ---------------- | ----- | ----------- | -------------- | ---------- | ------- | ----- | -------------------- |
| Guidance (all 12) | ✓ (`GuidanceReferralsSkeleton`, skeletons) | ✓ ("No … yet") | ✓ ("Try again", `isRefetching ? Loading`) | ✓ (`isPending`, "Applying…") | ✓ (zod server + form) | ✓ (endorse/reject dialogs) | ✓ | ✓ (guidanceChannel) |
| Teacher (14) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (submit-confirm, resolve-flag) | ✓ | ✗ (manual refetch) |
| Nurse (9) | ✓ | ✓ ("No notifications yet") | ✓ | ✓ (`reset()` on close) | ✓ | ✓ (start-handling, forward-ADM) | ✓ | ✓ (nurseChannel) |
| Principal (15) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (sign/return) | ✓ | ✗ |
| Coordinator (6) | ✓ | ✓ | ✓ | ✓ (`Loader2` spin) | ✓ | ✓ (advance/endorse/create-profile) | ✓ | ✓ (coordinatorChannel) |
| Registrar / Record-keeper | ✓ | ✓ | ✓ | ✓ | ✓ (band guards 403) | ✓ (approve/deny) | ✓ | ✗ |
| Auth | ✓ ("Signing in" spinner) | N/A | ✓ (inline `role=alert` + toast) | ✓ (disabled while loading) | ⚠ (required only; no strength meter) | N/A | ✓ | N/A |
| SF10 upload | ⚠ (panel only) | ✗ (no repository view mounted) | ⚠ UNVERIFIED end-to-end | ✓ | ⚠ (band check server-side) | ✗ (no verify/validate confirm in UI) | ✓ | ✗ |
| Search / Settings | ✗ (decorative) | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

Global error handling: `StatusPage` (401/403/404/500) + 401→403 redirect on
refresh failure (`lib/api/client.ts:44-52`) is consistent. Stale-data risk:
teacher/principal/registrar/record-keeper rely on 30s `staleTime` + manual
refetch; another user's write does **not** appear automatically there (no
channel). 401s map to the 403 page, which mislabels expired sessions as
forbidden — minor but confusing.

Realtime answers (verified in code): on guidance/nurse/coordinator shells,
another user's update appears automatically via Supabase `postgres_changes`
(`lib/realtime/guidanceChannel.ts`, `nurseChannel.ts`,
`coordinatorChannel.ts`) with ~2s throttle and TanStack Query prefix
invalidation; subscriptions are created in the role layout, gated on
`useRoleGuard`, and related users receive notification rows. On
teacher/principal/registrar/record-keeper shells there are no subscriptions —
stale data can appear until manual refresh or the 30s `staleTime` refetch;
notification rows are still written server-side but only the nurse shell
renders an inbox, so other roles may never see them.

---

## G. Navigation Audit

| Navigation item | Destination | Exists? | Correct label? | Correct role? | Issue |
| --------------- | ----------- | ------- | -------------- | ------------- | ----- |
| Registrar → Report Cards | `/registrar/report-cards` | ✗ 404 | — | — | Dead sidebar link (`registrar-sidebar.tsx:53`); no `page.tsx` |
| Record Keeper → Report Cards | `/record-keeper/report-cards` | ✗ 404 | — | — | Dead sidebar link (`record-keeper-sidebar.tsx:32`) |
| Record Keeper → SF10 Records | `/record-keeper/sf10` | ✗ 404 | — | — | Dead sidebar link (`record-keeper-sidebar.tsx:33`); G7–10 has no SF10 UI at all |
| Forgot password? (all 3 login forms) | `/login/*/reset` | ✗ | — | — | Dead link (`LoginForm.tsx:135`); no reset page or backend route |
| Sign in with Google | `/api/auth/google?role=` | ✗ (backend has no `/google` handler) | — | — | Dead OAuth button (`LoginForm.tsx:180`) |
| Settings (avatar menu, all shells) | — (no-op) | ✗ | — | — | Dead item in 8 layouts (e.g. `coordinator/layout.tsx:103`, `teacher/layout.tsx:92`) |
| Header Search… (7 shells) | — (Command placeholder) | ⚠ renders, does nothing | Misleading | — | Non-functional affordance; nurse correctly omits it |
| Student login success | `/student` (fallback) | ✗ 404 | — | Wrong | `LoginForm.tsx:85` fallback hits nonexistent route |
| Parent login success | `/parent` (fallback) | ✗ 404 | — | Wrong | Same line |
| Guidance generic `/guidance/referrals` | kept "for deep-links" | ✓ | ⚠ overlaps `/referrals/adm` + `/referrals/counseling` + `/adm` | — | Three queues with near-identical names; orientation relies on sidebar prefix-active only |
| Nurse `/nurse/alerts` vs `/nurse/referrals/*` | both live | ✓ | ⚠ "Referred Cases" vs "ADM Cases/Clinic Matters" overlap | — | Same concern; `lockType` differs but labels don't explain it |
| Teacher "View student profile" | — (disabled menu item, `teacher-overview-advisory.tsx:180`) | ⚠ | — | — | Dead action in an otherwise live menu |
| No breadcrumbs | — | ✗ globally | — | — | 3-level principal risk/heatmap nesting has no trail; back-navigation only via sidebar |

No duplicate sidebar entries within a shell; role isolation is by shell (no
cross-role hrefs). No `middleware.ts` — all gating is layout-level + backend.

---

## H. UX Problems

### Critical (blocks a primary workflow)

1. **Student and parent logins land on 404.** Backend issues a valid JWT, then
   `LoginForm.tsx:77-86` pushes `/student` / `/parent`, which have no routes.
   Both PLAN-mandated consumers (risk visibility, ADM meeting confirmation)
   cannot use the product. (Covers 2 of 10 roles.)
2. **`POST /api/anecdotal/` never responds**
   (`backend/src/modules/anecdotal/anecdotal.routes.ts:34-84` — creates +
   audits + recomputes risk, then falls off without `res.json`). The teacher
   anecdotal filing flow hangs; every downstream flow (referral →
   intervention → ADM) depends on records created through other paths. Fix is
   a one-line response + regression test.
3. **Registrar SF10 page uploads against the wrong student.**
   `registrar/sf10/page.tsx:12-15` passes the staff member's own
   `session.sub` as `studentId`; repository/detail components exist but are
   never mounted. SF10 verify→validate→release cannot be completed in UI
   despite a full backend state machine.

### High (major usability/functionality problem)

4. **Report-cards links 404 in both registrar shells; record-keeper SF10
   404s.** Visible nav promises missing modules (G §1–3).
5. **Password reset and Google sign-in are dead ends.** Reset has no page or
   API; Google has a button but no `/api/auth/google` handler. Users with
   expired/forgotten credentials have no self-service path.
6. **`accounts-audit` leaks SHS rows to the record keeper**
   (`registrar.routes.ts:804-878` hardcodes G11–12 instead of
   `roleGradeBand`). Privacy/band-integrity bug, not just UX.
7. **No standalone health-record or home-visitation authoring.** Schema +
   audit projections exist (`healthRecord`, `homeVisitationRecord`), but there
   is no dedicated page or router — clinic work hides inside referral
   dialogs, GCForm-12 has no form. PLAN §§3.6/4.2 workflows are unreachable
   as first-class tasks.
8. **Principal has no years/terms management UI** despite PLAN §4.2 assigning
   it. Only registrar-academics exposes school-year/term endpoints, and only
   to registrar/record-keeper roles.

### Medium (works, but important gap)

9. **Realtime on 3 of 8 shells.** Teacher, principal, registrar,
   record-keeper need manual refresh; cross-role handoffs (e.g. coordinator
   endorse → principal queue) go stale.
10. **Client role guards on 3 of 8 shells.**
    Teacher/principal/registrar/record-keeper flash wrong-shell content
    before backend 403s; add `useRoleGuard` to the 5 remaining layouts.
11. **Notifications inbox exists only in nurse alerts.** Backend fan-out +
    dedupe is real, but guidance/coordinator/principal/adviser have no inbox
    surface.
12. **ADM module timelines pending P2 API**
    (`coordinator/enrolled/page.tsx:110-116`); enrolled/completion tabs are
    list-only.
13. **401s redirect to `/errors/403`.** Expired sessions read as "forbidden";
    distinguish session-expiry → `/login` from true 403.

### Low (polish/consistency)

14. Non-functional global search in 7 headers; dead `Settings` item in 8
    shells; zero breadcrumbs; overlapping queue names (`referrals/adm` vs
    `adm`; `alerts` vs `referrals/*`); honor-roll "will be listed here once
    finalized" placeholder copy (`principal/honor-roll/page.tsx:188`);
    disabled "View student profile" item; unused `NursePlaceholder` legacy
    component (`nurse/components/nurse-placeholder.tsx` — harmless, delete).

---

## I. Target UX Sitemap (recommended)

```text
TARGET (changes vs current marked ▲ = add/move, ✚ = fix)
│
├── Public
│   ├── Landing, Login picker + 3 portals (keep)
│   ├── ▲ /login/:portal/reset — password reset (request + confirm) + backend routes
│   ├── ▲ remove or implement Google OAuth (decide; do not ship dead button)
│   ├── Register (▲ wire parent role path, currently student-only)
│   └── Errors (✚ separate 401-session-expired → /login from true 403)
│
├── ▲ Student (/student/*, NEW shell + sidebar + guard)
│   ├── Overview (risk level + category flags only — never clinical columns)
│   ├── My Grades │ My Attendance │ My Records (status-only) │ Notifications
│   └── Profile (own contact info)
│
├── ▲ Parent (/parent/*, NEW shell + sidebar + guard)
│   ├── Children (linked via parent_student_links) → child switcher
│   ├── Child: grades │ attendance │ risk │ ADM meeting confirmations
│   └── Notifications │ Profile
│
├── Guidance / Nurse / Coordinator / Teacher (keep structure)
│   ├── ✚ disambiguate queue labels (e.g. "Triage Alerts" vs "Counseling Caseload" vs "ADM Pipeline")
│   ├── ▲ notifications inbox (reuse NurseNotifications pattern) in guidance + coordinator
│   ├── ▲ standalone Health Record composer (nurse) + Home-Visit GCForm-12 composer (guidance)
│   ├── ✚ fix anecdotal-create response (backend one-liner)
│   └── ▲ realtime channels for teacher shell (at minimum advisory/grading invalidation)
│
├── Principal (keep; ▲ add Calendar: school-years + terms management wired to existing
│   registrar-academics endpoints or new principal-scoped routes; ▲ notifications inbox)
│
├── Registrar / Record Keeper (keep; ▲ implement Report Cards or remove links;
│   ▲ build record-keeper/sf10 from registrar/sf10 components; ✚ fix SF10 student picker;
│   ✚ fix accounts-audit band scoping; ▲ slim SF10 repository/detail mounting)
│
└── Global (all shells): ✚ remove or implement Search + Settings; ▲ breadcrumbs
    on ≥2-level nests (principal risk/heatmaps, teacher advisory/[id], registrar finals/[id]);
    ▲ useRoleGuard on the 5 unguarded layouts
```

Per-change rationale: every ▲ restores a PLAN-committed workflow
(student/parent visibility §4.2–4.3, calendar §4.2, health/home-visit §3.6,
report cards implied by final-grades pipeline) or removes a proven dead end
(reset, OAuth, search, settings). No existing working structure is moved —
the target preserves all 8 shells and only adds the 2 missing ones plus leaf
pages. Code changes required for all ▲/✚ items; nothing here is copy-only
except queue-label renames and honor-roll placeholder text.

### CURRENT vs TARGET — every proposed change

| Change | Current location | Proposed location | Reason | Workflow affected | Code changes? |
| ------ | ---------------- | ----------------- | ------ | ----------------- | ------------- |
| Student shell (new) | None — `/student` 404s after login | `/student/*` (overview, grades, attendance, records-status, notifications, profile) | PLAN-mandated consumer with no access; risk visibility for learners | Student self-service | Yes — new shell, pages, status-only serializers |
| Parent shell (new) | None — `/parent` 404s after login | `/parent/*` (children switcher, per-child views, meeting confirmations) | Linked parents cannot follow child or confirm ADM meetings | Parent engagement, ADM meeting branch | Yes — new shell, pages, parent-scoped reads |
| Password reset | Dead `*/reset` link on 3 login forms | `/login/:portal/reset` pages + backend routes | Locked-out users have no self-service path | Auth recovery | Yes — pages, API, email/channel plumbing |
| Google OAuth | Dead button → nonexistent `/api/auth/google` | Remove button, or implement handler | Ships a promise the backend cannot keep | Auth | Yes — either deletion or OAuth handler |
| Parent register path | `RegisterForm` only wires student | Wire parent role in the same form | Parents currently cannot self-register as parents | Registration | Yes — small form + API check |
| 401 vs 403 split | 401 refresh failure → `/errors/403` | Session expiry → `/login`; true 403 stays | Expired sessions misread as "forbidden" | Auth recovery | Yes — client interceptor |
| Report cards | Dead sidebar links, no pages | `/registrar/report-cards`, `/record-keeper/report-cards` pages — or remove links | Nav promises a missing module; grade data already exists | Final-grade reporting | Yes — pages, or link removal |
| Record-keeper SF10 | Dead sidebar link, no page | `/record-keeper/sf10` reusing registrar SF10 components | G7–10 needs the same workflow as G11–12 | SF10 pipeline | Yes — page + mount shared components |
| SF10 student picker | `registrar/sf10/page.tsx` files under staff `sub` | Same page, picker passes chosen studentId; mount repository/detail | Uploads land on the wrong student; pipeline unfinishable in UI | SF10 pipeline | Yes — page wiring |
| Anecdotal create response | `POST /api/anecdotal/` hangs | Same endpoint returns `201 + created row` | Core filing action never completes | Anecdotal → referral spine | Yes — backend one-liner + test |
| Accounts-audit band | Hardcoded G11–12 leaks to keeper | Derive band from caller role via `roleGradeBand` | Privacy/band-integrity leak | Account approvals audit | Yes — backend one-spot fix |
| Health-record composer | Inside referral dialogs only | Standalone nurse page + reads | Hard to find/file; no first-class task | Clinic documentation | Yes — page (+ router if split) |
| Home-visit composer | `hasHomeVisit` flag only | Standalone GC GCForm-12 page | GCForm-12 workflow unreachable as a form | Home visitation | Yes — page (+ router if split) |
| Principal calendar | Missing; lives in registrar area | Principal school-years/terms management | Policy assigns it to Principal (PLAN §4.2) | Academic setup | Yes — pages, reuse or new scoped routes |
| ADM module timelines | List-only enrolled view | Per-module timelines on `/coordinator/enrolled` | Coordinator cannot track module progress | ADM monitoring | Yes — P2 monitoring API + UI |
| Notifications inbox | Nurse alerts panel only | Inbox in guidance/coordinator/principal/teacher (reuse pattern) | Most roles never see their notifications | Cross-role handoffs | Yes — UI reuse, backend exists |
| Realtime rollout | 3 of 8 shells subscribed | Channels for teacher/principal/registrar/record-keeper | Stale queues on handoffs | All handoff workflows | Yes — channel modules + layout hooks |
| Search / Settings | Decorative in all shells | Implement or remove globally | Misleading affordances | Global navigation | Yes — either build or delete |
| Breadcrumbs | None anywhere | Add on ≥2-level nests (risk heatmaps, advisory `[id]`, finals `[id]`) | Deep pages have no trail back | Navigation orientation | Yes — shared component |
| Role guards | 3 of 8 layouts guarded | `useRoleGuard` in the 5 remaining layouts | Wrong-shell flash before backend 403 | Shell integrity | Yes — one hook per layout |
| Queue labels | Overlapping names (`referrals/adm` vs `adm`) | Disambiguated labels | Staff cannot tell queues apart | Referral triage | No — copy only |
| Honor-roll copy | "will be listed here once finalized" | Final wording | Placeholder in a live page | Awards | No — copy only |

---

## J. Implementation Roadmap (dependency order)

```text
PHASE 1 — Unblock critical paths (backend-first, no UI deps)
├── Fix POST /api/anecdotal/ response + regression test (H-C2)
├── Fix registrar SF10 student picker + mount repository/detail (H-C3)
├── Fix accounts-audit grade-band scoping (H-6)
└── Decide Google OAuth: implement handler or delete button (H-5)

PHASE 2 — Missing portals (needs Phase 1 auth sanity)
├── Student shell: overview/grades/attendance/records-status/notifications/profile (status-only serializers)
├── Parent shell: children switcher + per-child views + ADM meeting confirm + notifications
├── Password reset: request/confirm pages + backend routes + email/channel plumbing
└── useRoleGuard on 5 unguarded layouts + 401-vs-403 redirect split

PHASE 3 — Specialist workflows (needs Phase 1 spine)
├── Nurse health-record composer (standalone, confidentiality-tiered)
├── GC home-visitation GCForm-12 composer
├── ADM parent-meeting minutes + per-module timelines (P2 monitoring API)
├── Principal calendar (school-years/terms) management
└── Report cards (registrar + record-keeper) or link removal; record-keeper SF10 page

PHASE 4 — Workflow completion + sync
├── Notifications inbox in guidance/coordinator/principal/teacher (reuse nurse pattern)
├── Realtime for teacher/principal/registrar/record-keeper shells
├── Verify RLS policies before any confidential data goes live (PLAN O1 — still implementation-open)
└── risk_snapshots / report_snapshots refresh wiring (tables exist; schedule-on-write unverified)

PHASE 5 — Navigation + polish
├── Implement-or-remove Search and Settings globally; breadcrumbs on deep nests
├── Queue-label disambiguation; remove NursePlaceholder legacy; honor-roll copy
└── Empty/error/confirm copy pass (already strong — keep pattern)

PHASE 6 — QA (per checklist §K)
├── Role-matrix testing (10 roles × accessible/forbidden)
├── Band testing (G7-10 vs G11-12 on every registrar/record-keeper surface)
├── Flow testing (grading→lock→approve, attendance→risk, anecdotal→referral→ADM→devices)
├── Mutation + realtime + stale-data testing; regression on fixed bugs
```

---

## K. Testing Checklist

- [ ] Login as each of 10 roles → lands on correct home; student/parent no
  longer 404; wrong-role URL → `/errors/403`; logged-out URL → `/login`.
- [ ] Register student + parent → appear in correct band's pending queue;
  approve → profile created + roster grades/attendance migrated; reject →
  suspended + notified.
- [ ] Forgot-password request → confirm → login with new password; expired
  token rejected.
- [ ] Teacher: create components/weights/assessments → enter scores → finals
  recompute + risk recompute → lock → adviser-approve → visible read-only in
  correct registrar band.
- [ ] Adviser: bulk attendance (AM/PM, weekend/future/PH guards) → rate
  changes → parent notified on absent/late; anecdotal file → **response
  received** (regression for H-C2) → refer → appears in guidance/nurse queue.
- [ ] Guidance: accept → book/reschedule/complete/cancel session →
  attachments (5MB×5, ≤10) → escalate/reassign/note → forward to
  specialist/ADM; intervention review (approve/reject/modify) + outcome gates.
- [ ] Nurse: clinic accept → sessions → ADM review endorse (requires
  `referralFormReady`) / reject → forward; health-records archive reflects
  closures.
- [ ] Coordinator: intake → create-profile (roster-without-account blocked
  with clear message) → meeting branch → certification endorse → principal
  sign/return → device issue/return → enrolled/completion.
- [ ] Principal: ADM sign requires eligible stage; return resets correctly;
  honor-roll math (avg ≥ 90, no subject < 75); reports CSV; audit
  filter/paginate/CSV + drill-down returns status-only (no clinical columns).
- [ ] Registrar (G11–12) vs record-keeper (G7–10): pending lists,
  accounts-audit, finals, adviser-access, academics never cross bands
  (regression for H-6).
- [ ] SF10: upload → verify → validate → release with versions + audit rows;
  student picker targets correct student (regression for H-C3).
- [ ] Risk: force academic (<75 avg), attendance (<80%), behavioral (≥1
  record) flags → High/Moderate/Low transitions; auto-intervention created
  once; snapshots written.
- [ ] Realtime: write in role A → role B's queue updates without refresh
  where channels exist; confirm stale behavior where they don't.
- [ ] Dead-link sweep: report-cards ×2, record-keeper/sf10, `*/reset`,
  Google, Settings, Search — each either works or is gone.
- [ ] Print sheets render correct WW/PT/QE + transmuted grades for
  roster-only and account-backed students.
- [ ] Grade-band + confidentiality: student/parent see risk level + category
  only; principal sees status-only; RLS verified pre-live-data (PLAN O1).

---

## Final Summary

```text
TOTAL AREAS: 24 (14 page groups + 10 cross-cutting/backend)
COMPLETE: 0
FUNCTIONAL: 14 (public auth, 6 staff shells' pages, print sheets, backend routers)
PARTIAL: 5 (registrar SF10, health-record authoring, home-visit authoring, ADM module timelines, notifications UI + realtime coverage)
SKELETON: 1 (global search — renders, does nothing)
PLANNED: 2 (report cards, record-keeper SF10 — nav exists, no pages)
NOT STARTED: 5 (student portal, parent portal, password reset, settings/profile, principal calendar UI)
NEEDS AUDIT: 2 (accounts-audit band leak; SF10 student-subject wiring)

CRITICAL ISSUES: 3 (student/parent 404; anecdotal POST hang; SF10 wrong-student + unmounted repo)
HIGH PRIORITY: 5 (dead report-card/SF10 links; dead reset+OAuth; audit band leak; no health/home-visit composers; no principal calendar)
MEDIUM PRIORITY: 5 (realtime 3/8 shells; guards 3/8 layouts; inbox 1 role; P2 monitoring API; 401→403 conflation)
LOW PRIORITY: 1 group / 7 items (search/settings/breadcrumbs/labels/placeholder copy/disabled item/legacy component)

NEXT RECOMMENDED WORK:
1. Fix POST /api/anecdotal/ missing response (one-liner + test) — unblocks the core spine.
2. Fix registrar SF10 student picker + mount repository/detail — completes the SF10 state machine in UI.
3. Fix accounts-audit grade-band scoping — stops SHS data reaching the G7–10 keeper.
4. Build student + parent shells (status-only serializers) — restores 2 of 10 roles from 404.
5. Implement password reset (or document its absence) + resolve the Google OAuth dead button.
```

Key file references: auth redirect + dead reset/OAuth
`frontend/src/components/auth/LoginForm.tsx:77-86,135,180`; anecdotal hang
`backend/src/modules/anecdotal/anecdotal.routes.ts:34-84`; SF10 page
`frontend/src/app/registrar/sf10/page.tsx:1-22`; band bug
`backend/src/modules/registrar/registrar.routes.ts:804-878`; dead nav
`frontend/src/components/registrar-sidebar.tsx:53`,
`frontend/src/components/record-keeper-sidebar.tsx:32-33`; guards
`frontend/src/lib/auth/useRoleGuard.ts` (used only in guidance/nurse/coordinator
layouts); realtime
`frontend/src/lib/realtime/{guidanceChannel,nurseChannel,coordinatorChannel}.ts`;
legacy placeholder `frontend/src/app/nurse/components/nurse-placeholder.tsx:19-21`
(unused); enrolled P2 note `frontend/src/app/coordinator/enrolled/page.tsx:110-116`.
