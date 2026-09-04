# Plan: Teacher Attendance Taking page (`/teacher/advisory/attendance`)

> Focused implementation plan for the adviser **attendance sheet** — marking
> present / absent / late / excused per advisee, AM/PM sessions.
> Spec source of truth: `docs/role-modules/teacher-adviser-plan.md` §4.2
> (Attendance), §5 (cross-cutting rules). This plan adds the build order,
> endpoint inventory, and verification gates — it does not change the spec.

## Context (current state & gaps found in codebase)

- **Frontend gap A (dead nav link):** `frontend/src/components/teacher-sidebar.tsx:54`
  already links `{ title: "Attendance", href: "/teacher/advisory/attendance" }`,
  but **no route dir exists** under `/teacher/advisory/` besides `students/`
  (and its `[id]/` detail pages). Read-only per-student attendance already
  ships at `/teacher/advisory/students/[id]/attendance` (full school-day axis,
  calendar layout) — this plan adds the **write** surface, not another view.
- **Backend gap B (endpoint exists, guards missing):** `POST /api/attendance/bulk`
  (`backend/src/modules/attendance/attendance.routes.ts:31-53`) is adviser-only
  and upserts by `(studentId, date, session)` — but it does **not** verify the
  `sectionId` belongs to the caller's advisory section (any adviser can submit
  for any section today), has **no past-date/future-date/weekend validation**,
  and implements **no EOD lock** (spec §4.2: past days locked unless admin
  override).
- **Backend gap C (notifications not fired):** spec §4.2 requires absent/late
  → parent (in-app + email per `notification_prefs`). The bulk route calls
  `recomputeRisk` per student but never `fanoutNotification` (`src/lib/notify.ts`
  exists and is used by the anecdotal module) — nothing notifies parents today.
- Related plans: `PLANS/teacher-students.md`, `PLANS/teacher-grade-flags.md`;
  role docs: `docs/role-modules/teacher-adviser-plan.md`.

## Functional requirements (from §4.2 — source of truth)

### Page — `/teacher/advisory/attendance` (adviser only; 404 for non-advisers)

- 👁 Date picker (default: today; past dates viewable, future dates disabled).
- 👁 Session tabs: **Morning (AM)** / **Afternoon (PM)**.
- 👁 Roster rows (advisees only): avatar initials, name, LRN, term attendance-rate
  chip beside the name.
- ✎ Per-row status radio: **Present / Absent / Late / Excused** (default:
  last submitted value for that date+session, else Present).
- ✎ Bulk actions row: Mark all present, Clear; Submit button (`POST
  /api/attendance/bulk`, one payload per date+session).
- ✎ Edit today's entry freely; past dates read-only once locked (lock rule below).
- 👁 After submit: inline success state; the per-student attendance page and the
  advisory risk chips reflect the new marks (risk recomputes server-side).
- 🔒 No other sections, no behavior notes, no grades on this page.

### Lock + notification rules (server-side, not UI hints)

- **EOD lock:** submissions for a date are editable until end-of-day; past days
  reject with 403 unless an admin-override flag is present on the request.
- **Notifications:** each newly-recorded absent/late fires parent notification
  (in-app + email per prefs); edits that don't change status fire nothing.

## Implementation plan

### Phase 0 — Decisions (recommend before Phase 1)

1. **EOD lock clock:** server-local end-of-day vs fixed 23:59 UTC+8 window?
   (Recommended: fixed Philippines-time EOD — school operates on local time.)
2. **Admin override shape:** which roles + request field (e.g. `override: true`
   + `overrideReason`, registrar/principal only)?
3. **Default status for untouched rows:** pre-select Present (recommended —
   fastest path for the common full-attendance day) vs force explicit choice?
4. **Weekend/holiday taking:** hard-block weekends in API (recommended) or
   allow with override?

### Phase 1 — Backend (no new tables)

- Harden `POST /api/attendance/bulk`: verify `sectionId` is in the caller's
  advisory sections (403 otherwise); reject future dates + weekends (422);
  enforce EOD lock on past dates (403 unless valid admin override).
- Fire `fanoutNotification` to linked parents on newly-recorded absent/late
  (dedup: only when the stored status newly becomes absent/late, not on every
  resubmit).
- Unit tests (DB-free, vitest): lock-window helper (pure date math), status
  enum mapping; route tests stay live-smoke only (existing convention).
- Seed: nothing required (live taking is the data source; backfilled history
  already covers the axis).

### Phase 2 — Frontend (`frontend/src/app/teacher/advisory/attendance/`)

- Follow the established `teacher/*` conventions: `page.tsx` assembles
  components from `components/`, **each component with its own CSS module**;
  left-aligned compact header + back link pattern (detail-page style, not the
  centered hero); shadcn `Card`/`Table`/`RadioGroup`/`Tabs`/`Calendar`(date
  picker) primitives; React Query with invalidation of `["advisory-students"]`
  and `["advisee-attendance", id]` on submit.
- Components: `AttendanceSheetHeader` (date picker + AM/PM tabs + section label),
  `AttendanceSheetTable` (rows + radios + per-row rate chip), `SheetToolbar`
  (mark-all-present, clear, submit w/ dirty + submitting states),
  `attendance-sheet-data.ts` (types + `fetchSheet(date, session)` via existing
  reads + `submitSheet(payload)`).
- Prefill: load existing marks for the date+session (records endpoint shape
  already known) so resuming mid-day edit works.
- Sidebar link `teacher-sidebar.tsx:54` already points here — no nav change.

### Phase 3 — Verification & gates

- Backend: `tsc --noEmit`, `vitest run`, `tsc -p tsconfig.json` (build).
- Frontend: `tsc --noEmit`, `eslint`, `next build`.
- Smoke test: login as adviser → sheet lists only advisees → mark AM mix →
  submit 201 → per-student page shows the marks → resubmit same payload is a
  no-op notification-wise → past date without override → 403 → subject teacher
  → route blocked → parent of an absent student has a notification row.
- Data-consistency audit: submitted marks reconcile with the per-student
  attendance page and the advisory risk chips (0 mismatches).

## Out of scope / explicit non-goals

- Changing the approved §4.2 spec (build order only).
- Excuse-letter upload/approval flow (no spec exists yet).
- Class-level (subject teacher) attendance — advisers only per spec.
- Mobile attendance screens.

## Decisions log (to fill before Phase 1)

- [ ] EOD lock clock (local fixed vs server-local).
- [ ] Admin override shape (roles + fields).
- [ ] Untouched-row default (pre-select Present vs explicit choice).
- [ ] Weekend/holiday taking (hard-block vs override).
