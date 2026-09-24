# ADM Coordinator — Codebase Audit + Build Report

**System:** Zentra Student Information System (SIS)
**School:** Mati School of Arts and Trades
**Role:** `adm_coordinator`
**Date:** 2026-09-21
**Scope:** Full codebase study (Phases 1–18 of the ADM Coordinator plan) +
what was seeded/built in this session.

Sections 1–12 are the **read-only audit** (grounded in actual code with
`file:line` references). Section 13 lists **what was built in this session**.
Section 14 lists **remaining gaps / next phases**.

---

## 1. Existing ADM Architecture (pre-existing)

### 1.1 Backend — authoritative, already built

| Layer | Location | State |
|---|---|---|
| State machine | `backend/src/services/adm.ts:15-45` | Complete. 8 stages, `TRANSITIONS`, `canTransition`/`assertTransition` (409 on illegal) |
| Stage metadata | `backend/src/services/adm.ts:59-128` | Complete. Owner + `principalAction` per stage |
| Eligibility engine | `backend/src/services/adm.ts:161-182` | Complete, **derived — never free-typed** |
| ADM router | `backend/src/modules/adm/adm.routes.ts` (824 lines) | Core flow complete |
| Role→stage gate | `backend/src/modules/adm/adm.routes.ts:691-700` (`ROLE_FOR_STAGE`) | Complete |
| Device ledger | `backend/prisma/schema.prisma:875-886` + `adm.routes.ts:788-822` | Backend existed; list endpoint added this session (see §13) |
| Notifications | `backend/src/lib/notify.ts:1-66` | Complete, derived-type (O7) |
| Audit | `backend/src/lib/audit.ts:1-31` | Complete, best-effort, never throws |
| Cache | `cache({tags:["adm"]})` + `invalidateTags(["adm","overview","principal"])` | Complete on all ADM writes |

**ADM endpoints that existed before this session:**

| Method | Path | Roles | Location |
|---|---|---|---|
| `GET` | `/api/adm/pipeline` | `adm_coordinator, principal` | `adm.routes.ts:15-22` |
| `GET` | `/api/adm/dashboard` | `adm_coordinator, principal` | `adm.routes.ts:25-105` |
| `GET` | `/api/adm/referrals/all?page&q&stage` | `adm_coordinator, principal` | `adm.routes.ts:131-306` |
| `GET` | `/api/adm/approvals?page&q` | `adm_coordinator, principal` | `adm.routes.ts:308-383` |
| `GET` | `/api/adm/referrals` | `adm_coordinator, principal` | `adm.routes.ts:385-416` |
| `GET` | `/api/adm/my-cases` | `adviser, subject_teacher` only | `adm.routes.ts:422-587` |
| `POST` | `/api/adm/profiles` | `adm_coordinator` | `adm.routes.ts:595-613` |
| `POST` | `/api/adm/:id/principal-approve` | `principal` | `adm.routes.ts:615-637` |
| `POST` | `/api/adm/:id/principal-return` | `principal` | `adm.routes.ts:646-689` |
| `PATCH` | `/api/adm/:id/stage` | `requireAuth` + `ROLE_FOR_STAGE[target]` | `adm.routes.ts:706-786` |
| `POST` | `/api/adm/devices/issue` | `adm_coordinator` | `adm.routes.ts:788-803` |
| `POST` | `/api/adm/devices/:id/return` | `adm_coordinator` | `adm.routes.ts:806-822` |

### 1.2 Database (Prisma, `backend/prisma/schema.prisma:823-906`)

- `AdmLearnerProfile` — `studentId→StudentProfile`, `referralId→Referral`
  (**required, no walk-ins**), `stage: AdmStage` (default `anecdotal`),
  `eligibilityStatus: AdmEligibility` (default `pending`),
  `preparedBy→User`, `approvedBy?/approvedAt?`, `certificationDetails: Json?`,
  `termId→Term`, `confidentialityLevel: restricted`.
- `AdmParentMeeting` — `recordedBy`, `meetingDatetime`, `attended: Bool`,
  `parentConfirmedAt?`, `minutesOfMeeting?`, `attendanceLogbookRef?`.
- `AdmModule` — `moduleName`, `releaseDate?`, `dueDate?`, `submitted`,
  `submissionDate?`, `recordedBy`.
- `AdmDevice` — `deviceType`, `deviceSerial`, `issuedBy→User`, `issuedDate`,
  `returnedDate?`, `conditionNotes?`. **No separate inventory/stock table —
  per-learner ledger only.**
- `AdmForm` — `formType: REFERRAL_FORM|ANECDOTAL_REPORT|CERTIFICATION|
  MINUTES_OF_MEETING|HV_FORM`, `status: pending|submitted|verified`.

### 1.3 Frontend (pre-existing)

- **No coordinator route, shell, or sidebar existed.** `adm_coordinator`
  existed only as a string in `frontend/src/lib/auth/roles.ts:6`.
- `LoginForm.tsx:77-84` had **no redirect for `adm_coordinator`** (fell
  through to dead `/staff`). Fixed this session (see §13).
- No device-issuance UI anywhere (`deviceIssued` in
  `principal/adm/adm.ts:23` was always `false`, never rendered).
- No `/certification` route — certification existed only as stage +
  `AdmForm.formType=CERTIFICATION` + `certificationDetails Json?`.
- Closest working reference: `src/app/principal/adm/` (38 files).

---

## 2. Existing Roles and Responsibilities

| Role | Referral powers | ADM powers | Cannot do |
|---|---|---|---|
| Adviser / Subject Teacher | `POST /api/anecdotal` + `POST /:id/refer` (`anecdotal.routes.ts:34,117`); `consultReviewer` only when routing to ADM (`:142-144`) | Read-only `GET /api/adm/my-cases`; page states "Read-only — stage and status only" (`teacher/advisory/adm-cases/page.tsx:28-32`) | Change referral status, edit eligibility/devices/meetings |
| Guidance Counselor | Owns `referredToRole=guidance_counselor` queue; `POST /:id/adm` forwards to ADM (`referrals.routes.ts:307-326`); `POST /adm/referrals/:id/review`; owns `home_visitation` stage | Consultation reviewer; `CounselingSession` author | Create profiles, issue devices, approve |
| Nurse | Receiver-scoped (`referrals.routes.ts:1457-1464`); `nurse-adm-review → nurse-referral-form → nurse-adm-forward` (`:779-1018`) | Consultation reviewer only | Create profiles, issue devices, approve |
| ADM Coordinator | Reads `GET /api/referrals` scoped (`:1467-1473`); `POST /:id/status` | `POST /profiles`, stage PATCH → `meeting_parents\|certification\|enrollment_monitoring\|completion`, device issue/return. Owns 4 of 8 stages | Approve/return (`principal` only) |
| Principal | `GET /api/referrals` unscoped; status-only strip (`adm.routes.ts:265,369`) | **Only writes: approve + return** (`adm.routes.ts:615-689`, guards `ALREADY_APPROVED`, `NOT_CERTIFIED`, `NOT_AT_SCHOOL_HEAD`, `NOT_YET_APPROVED`) | Grades, anecdotal, learner records, devices, eligibility edits |
| Registrar / Record Keeper | Grade-banded account approval (`auth.routes.ts:129-229` + `gradeBand.ts`) | None | ADM, devices, approvals |

**Student-record access:** no dedicated profile page; identity inline
(`name+lrn+section+grade`). `OCFORM01_ROLES` (`anecdotal.routes.ts:741-748`)
**includes `adm_coordinator`** → anecdotal detail/export already permitted.
Teacher academic pages are explicitly read-only — the coordinator equivalent
(scoped academic read) is still a P2 gap.

---

## 3. Existing ADM Workflow (actual code)

```
Adviser files anecdotal
  ↓  POST /api/anecdotal/:id/refer  {referredToRole: adm_coordinator, consultReviewer?}
Referral (pending) → early row id="referral:<id>" stage=consultation
  (adm.routes.ts:42-44,175-189,270-285)
Consultation (guidance_counselor | nurse per consultReviewer)
  ↓
Coordinator POST /api/adm/profiles {studentId, referralId*, termId}
  (referral NOT NULL, 404 REFERRAL_NOT_FOUND)
Meeting with Parents (AdmParentMeeting)
  ├─ attended → MINUTES_OF_MEETING
  └─ absent → PATCH → home_visitation (guidance, GCForm-12 → HV_FORM)
Recommendation & Certification (AdmForm CERTIFICATION must be verified)
  │  eligibility recomputed on every PATCH into certification+
  ↓  PATCH → principal_approval (forward — locks case by convention)
Principal: approve → enrollment_monitoring (auto) | return → principal_approval
  (return clears approval AND resets eligibility → pending)
Enrollment Monitoring (AdmModule) → PATCH → completion (+ device return)
```

Key truths: eligibility **derived on PATCH, never typed**; principal approve
**auto-advances**; return **resets eligibility** (flagged risk, §14);
early referrals merged **in-memory** (paging is a slice, not DB paging);
principal rows strip `studentId`, coordinator rows keep it.

---

## 4. ADM Coordinator Gaps (at audit time)

| Objective | Model | API (then) | UI (then) | Status now |
|---|---|---|---|---|
| 1. Review referrals | `Referral` + early-row merge | `GET referrals/all`, `GET /referrals` | Principal queue only | **Built** — coordinator Referrals page |
| 2. Evaluate eligibility | `evaluateAdmEligibility` | Recomputed on PATCH | Eligibility pills | **Built** — evidence checklist in case Sheet (display-only) |
| 3. Profiles/academic/anecdotal | `StudentProfile`, `FinalGrade`, anecdotal | Anecdotal detail (OCFORM01); no academic read | None | **Partial** — anecdotal via existing rights; scoped academic read still P2 |
| 4. Monitor enrolled | `AdmModule`, `enrollment_monitoring` | PATCH only; **no module CRUD** | None | **Partial** — Enrolled page lists cohorts; module CRUD still P2 |
| 5a. Certifications | `AdmForm CERTIFICATION`, `certificationDetails` | `POST /profiles`, PATCH | None | **Built** — Certifications ledger + forward |
| 5b. Devices issue/return | `AdmDevice` | issue/return existed; **no list** | None | **Built** — ledger endpoint + Devices page |
| 6. Forward to Principal | `stage=principal_approval` | PATCH existed | None | **Built** — forward with lock notice |
| 7. Track approvals | `approvedBy/At` | `GET /approvals` existed | Principal page only | **Built** — 4-tab tracking incl. needs-revision |
| Notifications | `fanoutNotification`, 60s dedup | inbox endpoints | shared | Coordinator fanouts (forward/approve/device) still P2 |
| Realtime | Supabase `postgres_changes` | — | Guidance + nurse only | **Built** — `coordinator-desk` channel |

No duplicate system introduced: one device table, one form table, one
profile table, one status model.

---

## 5. Coordinator Navigation (as built — 5 tabs)

Follows the **guidance/nurse tab-bar pattern**
(`guidance-sidebar.tsx`, `nurse-sidebar.tsx`), not the principal sidebar.
Guard: `useRoleGuard(["adm_coordinator"])`; backend `requireRole` stays
authoritative.

| Tab | Route | Icon | Purpose |
|---|---|---|---|
| Overview | `/coordinator/overview` | `LayoutDashboard` | "What needs me today?" — KPIs, pipeline, latest 5 |
| Referrals | `/coordinator/referrals` | `Inbox` | Intake queue + case Sheet + create profile |
| Enrolled | `/coordinator/enrolled` | `ClipboardList` | Monitoring / Completed cohorts |
| Certifications | `/coordinator/certifications` | `Award` | Prepared / Awaiting / Needs revision / Approved |
| Devices | `/coordinator/devices` | `Tablet` | Issue / return ledger |

Approval tracking lives **inside Certifications** (no separate nav item —
avoids guidance's duplicate-ADM-entry problem). Deliberately excluded:
Reports, Audit Log (principal-only), accounts, grade encoding, attendance,
health/home-visit editing.

---

## 6. Page-by-Page (as built)

Conventions on every page: TanStack Query (`staleTime 30s`,
`placeholderData: keepPreviousData` on paged tables), debounced 300ms
search, skeleton mirroring live layout, error + Try again (`Loader2`),
empty states, `Badge` pills, `DropdownMenu` row actions, `AlertDialog` for
forward/issue/return, `Dialog` for create-profile, `Sheet` for case file,
sileo `toast.success/error` only in mutation callbacks, explicit
`invalidateQueries`, no full reloads.

### 6.1 Overview (`overview/page.tsx`)

- **5 cards:** Needs attention (live total + Review button opening the
  actionable-items modal; disabled when all clear) · ADM cases referred
  to me (`totalReferred` from `GET /api/adm/referrals/all`) ·
  Certifications issued (profiles at or past `certification`, from
  dashboard `stageBreakdown`) · Awaiting Principal approval
  (`kpis.pendingSignature` — same gate as `isAwaitingSignature`) ·
  Active enrolled (`enrollment_monitoring` count). Card actions are solid
  24px theme-aware buttons, no arrows.
- **Needs-attention modal:** new referrals with no profile · needs
  revision (unsigned `principal_approval` + not eligible) · devices still
  out — each with count, hint, and an Open deep link. Shares query keys
  with the Certifications/Devices pages so caches are reused.
- **Cases-by-stage donut in the 30% rail** (recharts Pie, 8-slice neutral
  ramp, counts legend beneath) beside the Recent-forwards table in one
  `railRow` (stacks under 900px). The certification-progress donut was
  removed per scope — certification tracking lives on the Certifications
  page.
- **Devices summary:** issued-vs-returned counts plus the 5
  longest-outstanding tablets (serial, student, issued date, live time
  out) in the alerts-table treatment.
- **Recent forwards from Nurse / Guidance:** freshest `consultation`
  rows with the reviewer as natural text ("School Nurse:" + an explicit
  "Adviser: {name}" line for the referral author), derived case status,
  live elapsed, and endorse date. The reviewer field was added to
  early-row output (`adm.routes.ts`) for this. No raw enums reach the UI:
  reviewer, role, action-type, form-type, and form-status values pass
  through `consultReviewerLabel` / `roleLabel` / `friendlyActionType` /
  `friendlyWords` (`coordinator-data.ts`). Stored audit reasons are
  rewritten at display time by `friendlyReason`: "Referred to
  adm_coordinator (consult reviewer: …)" renders as "Anecdotal referred
  for the ADM case — … review", and "ADM stage advanced to {stage}"
  renders with the proper stage name.
Early rows also carry **`endorsedAt`** — the earliest `audit_logs` entry
for the referral ("Referred to adm_coordinator …", same technique as
`referrals.routes.ts:1513-1533`) — so waiting-time readouts and the
"Date referred" column run from the guidance/nurse hand-off, not the
anecdotal observation date. Merge sort orders early rows by endorse time.
Verified live: 3/3 early ADM referrals resolve an endorse timestamp.
- `?tab=` deep-links into Certifications (`awaiting`, `revision`,
  `approved`) via `useSearchParams` + `Suspense` (guidance/nurse pattern).

### 6.2 Referrals (`referrals/page.tsx`)

- Same layout as the nurse/guidance alerts queues: panel header
  (title + live count + search + Stage/Status dropdowns + Show-all clear),
  shadcn Table with the alerts treatment (roomy rows, muted headers),
  nurse-style pager ("Showing X–Y of Z" + Previous / Page N of M / Next).
- Columns: Student · Type (ADM) · Case status (derived) · Eligibility ·
  Time elapsed (live 30s tick from endorse/creation time) · Date referred ·
  ⋯ row menu (Open case, See history, + contextual Create profile /
  Advance / Endorse).
- **Case Sheet → Parent meetings:** once referred to ADM, the coordinator
  books the parent/guardian meeting **in school or as a home visitation**
  (`venue`), lists booked meetings with outcome (Booked/Attended), and
  records the outcome (attended + minutes + logbook ref). Attended
  meetings evidence the `meeting_parents → certification` branch; missed
  ones evidence the home-visitation path. New endpoints (all
  `adm_coordinator`, `adm_edit` audit, `adm` invalidation):
  `POST /api/adm/:id/meetings`, `GET /api/adm/:id/meetings`,
  `PATCH /api/adm/meetings/:meetingId`. Schema: `AdmParentMeeting.venue`
  (`school|home`, default `school`) via migration
  `20260923010000_add_adm_meeting_venue` — written `IF NOT EXISTS`
  because the pooler was unreachable to the migrate CLI at apply time
  (applied via runtime SQL, verified live in information_schema; a later
  `migrate deploy` records it as a no-op).
- Verified live end-to-end: profile create → book home visit →
  list → outcome save → test rows deleted (0 profiles remain).
- **Create profile**: resolves account-backed `studentId` via
  `GET /api/referrals` (roster-only → toast explaining Registrar approval
  needed), term picker via `GET /api/registrar/academics/terms` (role
  widened this session), `POST /api/adm/profiles`.
- Mutations: `PATCH /:id/stage` for advance + forward, each with confirm
  dialog, toast, and invalidation of referrals + dashboard keys.

### 6.3 Enrolled (`enrolled/page.tsx`)

- Monitoring / Completed tabs over `GET /api/adm/referrals/all?stage=…`
  (follows up page 2 when total > 20). Approval attribution column.
- Explicit P2 note rendered in-page for module timelines.

### 6.4 Certifications (`certifications/page.tsx`)

- Prepared (`certification` stage) / Awaiting signature
  (`principal_approval` + eligible + unsigned) / Needs revision
  (`principal_approval` + unsigned + not eligible — covers Principal
  returns, which reset eligibility to pending) / Approved
  (`GET /api/adm/approvals` + search).
- Forward action with lock-worded confirm. No Sign/Return anywhere
  (principal-only, 403-enforced).

### 6.5 Devices (`devices/page.tsx`)

- Ledger from **new `GET /api/adm/devices`** (§13): serial search, status
  filter, Issued (`secondary`) / Returned (`outline`) pills, condition
  notes, issuer attribution.
- Issue dialog (case picker from active pipeline, type default Tablet,
  required serial, optional condition) → existing `POST /devices/issue`.
- Return confirm → existing `POST /devices/:id/return` (`ALREADY_RETURNED`
  guard server-side).

---

## 7. Core Workflow Transitions (implemented subset marked ✅)

| From → To | Actor | Mutation | UI |
|---|---|---|---|
| Referral → profile exists | Coordinator | `POST /profiles` ✅ | Create-profile dialog ✅ |
| `consultation` → `meeting_parents` | Coordinator | `PATCH stage` ✅ | Advance confirm ✅ |
| `certification` → `principal_approval` (forward/lock) | Coordinator | `PATCH stage` ✅ | Forward confirm ✅ |
| `principal_approval` → `enrollment_monitoring` | **Principal only** | `POST principal-approve` | Display only ✅ |
| return → `principal_approval` (eligibility→pending) | **Principal only** | `POST principal-return` | Needs-revision tab ✅ |
| Device issue / return | Coordinator | `POST devices/issue\|return` ✅ | Dialogs ✅ |
| Meeting record, form upload/verify, module release/submit | Coordinator | **missing (P2)** | Checklist displays only |

---

## 8. Principal Approval Boundary (enforced)

- Coordinator CAN: create profile, advance stages, forward, issue/return
  devices. Coordinator CANNOT: approve/return — `requireRole("principal")`
  (`adm.routes.ts:618,649`); no such buttons exist in coordinator UI.
- Post-forward lock is **conventional** (confirm copy warns) — server-side
  `CASE_LOCKED` enforcement is P2.
- Return semantics preserved: `eligibilityStatus=pending` reset surfaces in
  the Needs-revision tab by design.
- No version/history table — history via `audit_logs` old/new diffs.

---

## 9. Student Record Access

- **Reused, not duplicated.** Anecdotal detail/export already permits
  `adm_coordinator` (`OCFORM01_ROLES`). Coordinator rows carry `studentId`
  (principal rows strip it) for deep-linking.
- Coordinator writes are limited to ADM rows (profile/forms/meetings/
  modules/devices). Nothing else is editable from this desk.
- Scoped academic read (`GET /adm/students/:id/academic`) is P2 — no grade
  columns are exposed to the coordinator UI today.

---

## 10. Certification Workflow (existing fields only)

`Pending` (pre-certification) → `Prepared` (CERTIFICATION verified) →
`Forwarded` (`principal_approval`, locked) → `Approved` (`approvedBy/At`) →
`Issued/Recorded` (device + modules). Rendered from
`stage + eligibilityStatus + approvedBy + forms[]` — no new statuses, no new
table. `certificationDetails` edit-after-create and form upload/verify
endpoints are P2.

---

## 11. Learning Device Workflow (ledger, no second inventory)

- Reuses `AdmDevice`. Status derived (`returnedDate != null`).
- **User decision locked:** split `conditionNotes` into
  `conditionAtIssue / conditionAtReturn` + `accessories / remarks` via
  migration (P2) — UI already collects "condition at issuance"; back-compat
  read of `conditionNotes` retained.
- Serial uniqueness (global vs in-use-only partial index) still open.

---

## 12. Status Model (single lifecycle + derived case statuses)

`AdmStage` (8, linear + `meeting_parents` branch) · `AdmEligibility` (3,
derived) · `AdmFormStatus` (3; CERTIFICATION must be `verified`) ·
`ReferralStatus` (7, referral-level) · Device `Issued/Returned` (derived).
Principal `isAwaitingSignature` gate reused verbatim for the Awaiting tab.

**Action-derived case statuses** (`deriveAdmCaseStatus` in
`coordinator-data.ts`, computed from the backend `ADM_STAGE_FLOW` — same
idea as the nurse queue's `deriveActionStatus`, never a new stored enum):

| Pipeline position | Case status | Badge |
|---|---|---|
| `consultation` (no profile) | Need review by ADM | warning |
| `meeting_parents` | Parent meeting | secondary |
| `home_visitation` | Home visitation | secondary |
| `certification`, evidence incomplete | For certification | warning |
| `certification`, eligible | Ready to endorse | default |
| `principal_approval`, unsigned, eligible | Endorsed to Principal | default |
| `principal_approval`, unsigned, not eligible | Needs revision | destructive |
| `enrollment_monitoring` | Monitoring | success |
| `completion` | Completed | success |

The endorse action (`PATCH → principal_approval`) is labeled **"Endorse to
Principal"** across Referrals and Certifications (was "Forward").

---

## 13. What Was Built in This Session

### 13.1 Credentials (verified live against the database)

- `backend/prisma/seed-adm-coordinator.ts` (new, idempotent): upserts
  `adm@zentra.test` / role `adm_coordinator` / `status active` (+
  `StaffProfile ADM01`), argon2 hash of the canonical `Zentra2025!`
  (mirrors `seed.ts:9,68`). Executed successfully — user id
  `ee3e3366-…`.
- **Sign-in:** Staff portal (`role=staff`), email `adm@zentra.test`,
  password `Zentra2025!` → lands `/coordinator/overview`.

### 13.2 Auth wiring (2-line fix + copy)

- `frontend/src/components/auth/LoginForm.tsx` — added
  `adm_coordinator → /coordinator/overview` redirect (was falling through
  to dead `/staff`).
- `frontend/src/app/login/staff/page.tsx` — description now includes the
  ADM coordinator.

### 13.3 Backend (additive only)

- `GET /api/adm/devices` (`adm.routes.ts`) — ledger join
  (device + profile stage + student + issuer), `q`/`status` filters,
  derived `issued|returned`, `requireRole(adm_coordinator, principal)`,
  `cache(tags:["adm"])`.
- `GET /api/adm/history` (`?profileId=` and/or `?referralId=`) — audit
  trail ordered oldest-first: adviser anecdotal filing → referral to ADM
  (endorse) → consultation endorse → coordinator actions → principal
  decision → devices, with actor names; system events only,
  `requireRole(adm_coordinator, principal)`. Verified live, including 9
  real "Anecdotal record created" filings now surfacing first.
- Early-row output: `consultReviewer`, `referralStatus`, **`endorsedAt`**
  (earliest referral audit = guidance/nurse hand-off; merge sort orders
  early rows by it). Verified live: 3/3 early ADM referrals resolve.
- `GET /terms` role widened (read-only reference data):
  `registrar/academics.routes.ts` + `record-keeper/academics.routes.ts`
  now include `adm_coordinator` (term picker for profile creation).
- `backend typecheck` clean; `tests/logic.test.ts` passes (2/2).

### 13.4 Frontend coordinator workspace (16 new files)

| File | Pattern source |
|---|---|
| `src/components/coordinator-sidebar.tsx` (+ `.module.css`) | `guidance-sidebar.*` |
| `src/lib/realtime/coordinatorChannel.ts` (`coordinator-desk`, 6 tables, 2s throttle) | `guidanceChannel.ts` |
| `src/app/coordinator/layout.tsx` (+ `coordinator.module.css`) | `guidance/layout.tsx` |
| `src/app/coordinator/page.tsx` (→ overview) | `guidance/page.tsx` |
| `src/app/coordinator/pages.module.css` | `guidance/pages.module.css` |
| `src/app/coordinator/components/coordinator-data.ts` (types + fetchers + `deriveAdmCaseStatus` + elapsed helpers) | `principal/adm/api.ts` |
| `src/app/coordinator/components/CaseHistoryDialog.tsx` (audit-timeline dialog, shared by Overview + Referrals) | guidance session-history pattern |
| `overview/page.tsx`, `referrals/page.tsx`, `enrolled/page.tsx`, `certifications/page.tsx`, `devices/page.tsx` | guidance ADM + principal ADM pages |

- `frontend tsc --noEmit` clean.

### 13.5 Realtime + notifications (this session)

- Live: `useCoordinatorRealtime` invalidates all six coordinator keys on
  `AdmLearnerProfile|Referral|AdmForm|AdmDevice|AdmModule|AdmParentMeeting`
  changes. Toasts only from mutations (never realtime) — no double-notify.
- Pending (P2): server fanouts for forward→principal, approve→coordinator,
  return-recipient fix, device events.

---

## 14. Remaining Gaps / Next Phases (dependency order)

| Phase | Scope |
|---|---|
| P2a — Schema | `AdmDevice.conditionAtIssue/conditionAtReturn/accessories/remarks` + serial in-use index (locked decision §11) |
| P2b — API | `GET /api/adm/:id` detail; form upload/verify; `PATCH /:id/certification`; module release/submit; `GET /adm/students/:id/academic` (scoped); forward-lock (`CASE_LOCKED`); approve fanout + return-recipient fix (parent-meeting book/list/outcome + `venue` migration already built, §6.2) |
| P3 — RBAC/RLS | Supertest per role-matrix row; RLS O1 coverage for `adm_coordinator` before live confidential data |
| P4 — UX depth | Case drawer: meeting record, form upload, CERTIFICATION verify, academic read-only view, audit-sourced revision history |
| P5 — Notify | Forward/approve/return/device fanouts with correct recipients |
| P6 — Hardening | Vitest (eligibility/transitions), in-memory-paging revisit, serial-uniqueness rule, overdue-device threshold, E2E cross-role walkthrough |

**Open questions:** serial uniqueness scope (§11); device issuance allowed
before `enrollment_monitoring`?; academic-read column scope (SF10 excluded
until RLS review); principal-return preserving vs resetting eligibility;
overdue-device threshold N days.

---

*End of report. Audit §§1–12 grounded in code; build §13 executed and
typechecked this session; §14 is the dependency-ordered remainder.*
