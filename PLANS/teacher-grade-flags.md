# Plan: Teacher / Adviser Grade Flags page (`/teacher/grade-flags`)

> Focused implementation plan for the **Grade Flags** page of the teacher +
> adviser surface. Spec source of truth: `docs/role-modules/teacher-adviser-plan.md`
> §3.4 (page spec), §5 (cross-cutting rules), §7 (sidebar), §8 (API surface).
> This plan adds the build order, schema, and verification gates — it does not
> change the spec.

## Context (current state & gaps found in codebase)

- Roles (`frontend/src/components/auth/LoginForm.tsx:76`): `subject_teacher` and
  `adviser` both land on `/teacher/overview`. In the DB both map to
  `users.role = teacher`; adviser-ness comes from `section_advisers` rows
  (per `teacher-adviser-plan.md` §0).
- **Frontend gap A (dead nav link):** `frontend/src/components/teacher-sidebar.tsx:47`
  already links `{ title: "Grade Flags", href: "/teacher/grade-flags", icon: Flag }`,
  but **no `frontend/src/app/teacher/grade-flags/` route exists** → the user hits
  a 404 on click. Only `overview/` and `classes/` exist under `/teacher`.
- **Backend gap B (no storage or endpoints):** no `GradeFlag` model exists in
  `backend/prisma/schema.prisma` (models present: `StudentGrade`, `FinalGrade`,
  `TeacherSubjectAssignment`, `Section`, `AuditLog`, …) and no `grade-flags`
  routes exist under `backend/src/modules/` (academics, grades, risk, teacher,
  …). The overview's risk-flag breakdown (`backend/src/modules/teacher/teacher.routes.ts`
  ~lines 243–287) is computed from grades/attendance/anecdotals — it is
  **detection**, not the teacher-raised `grade_flags` workflow; the two must not
  be conflated.
- **Spec (already approved, §3.4):** two stacked tables — **Raised by me**
  (open + resolved) and **Raised against my gradebook**; any teacher may raise a
  flag on any student's grade; only the gradebook owner resolves; server-side
  escalation after `escalation_threshold_days` feeds the Principal's
  escalated-flags dashboard; every raise/resolve writes an `audit_logs` row.
- Related plans: `PLANS/record-keeper.md`, `PLANS/registrar-workspace.md`;
  role docs: `docs/role-modules/teacher-adviser-plan.md`, `docs/role-modules/principal.md`.

## Functional requirements (from §3.4 + adviser specifics — source of truth)

### Page layout — `/teacher/grade-flags` (all teachers; adviser sees same page)

- 👁 **Table 1 — Raised by me** (open + resolved): columns flag type/reason,
  student, subject, section, term, owner teacher, status (`open` / `resolved` /
  `escalated`), age (days open).
- 👁 **Table 2 — Raised against my gradebook**: flags anyone raised on grades
  in sections/subjects I own (via `TeacherSubjectAssignment`); same columns.
- 👁 Adviser extra scope: flags on **advisees' grades** are visible here even
  when the gradebook owner is another teacher (read-only unless I raised it) —
  advisers need the full flag picture for their section.
- ✎ **Raise flag** → modal: student picker (scoped: my students + advisees),
  subject, section, term, reason/category, free-text note → creates row with
  `raised_by=me`, `status=open`.
- ✎ **Resolve** (gradebook owner only) → resolution note → `status=resolved`,
  `resolved_by=me`, `resolved_at`, audit row.
- 🔒 Cannot resolve flags on gradebooks I do not own. Cannot see flags for
  students/sections outside my assignments + advisory section. No bulk resolve.
- **Escalation (server-side, not UI):** `escalation_threshold_days` pass with
  `status=open` → row becomes `escalated` and surfaces in the Principal's
  escalated-flags dashboard; the original teacher still owns resolution.

### States

- Loading: skeleton tables. Empty: "No flags raised yet." / "No flags on your
  gradebook." Filters: status chips [All][Open][Escalated][Resolved], search by
  student name/LRN.

## Implementation plan

### Phase 0 — Decisions to confirm (blockers before build)

1. **Flag reasons taxonomy:** free-text only, or enum (e.g. `wrong-score`,
   `missing-assessment`, `transmutation-error`, `late-submission`, `other`)?
   (Recommended: enum + note, so Principal dashboard can aggregate.)
2. **Grade-flag auto-resolution on edit:** does editing the underlying grade
   auto-resolve an open flag? (Open question carried over from
   `teacher-adviser-plan.md` §9 — needs a product answer before Phase 1.)
3. **`escalation_threshold_days` value + where it lives** (system config row vs
   env vs constant) and whether escalation runs on a cron/job or lazily on read.
4. **Adviser read scope for advisee flags owned by others:** full note text, or
   reason-only? (Spec §4.1 hides anecdotal write-ups from non-owners; decide if
   flag notes follow the same rule.)

### Phase 1 — Backend (Prisma + module)

- New `GradeFlag` model in `backend/prisma/schema.prisma` (+ migration):
  `id`, `student_id` → `StudentProfile`, `subject_id` → `Subject`,
  `section_id` → `Section`, `term_id` → `Term`, `reason` (+ `note`),
  `status` (`open`/`resolved`/`escalated`), `raised_by` → `User`,
  `owner_id` → `User` (gradebook owner, resolved server-side from
  `TeacherSubjectAssignment`), `resolved_by`, `resolved_at`,
  `resolution_note`, `escalation_threshold_days`, `escalated_at`,
  `created_at`/`updated_at`. Index on `(status, owner_id)`, `(raised_by)`.
- New `backend/src/modules/grade-flags/` (or extend `teacher/`): guarded by
  `requireRole("teacher")` (both subject_teacher + adviser map to it):
  - `GET /api/grade-flags?scope=mine` — raised_by = me.
  - `GET /api/grade-flags?scope=against-me` — owner_id = me.
  - `GET /api/grade-flags?scope=advisees` — advisee flags (adviser only,
    gated on `section_advisers`).
  - `POST /api/grade-flags` — any teacher, any student grade; server resolves
    `owner_id`; writes `AuditLog`.
  - `POST /api/grade-flags/:id/resolve` — 403 unless caller is `owner_id`;
    requires `resolution_note`; writes `AuditLog`.
  - Escalation: scheduled job (or lazy check) flipping overdue `open` →
    `escalated` + `escalated_at`; Principal dashboard reads `escalated` rows.
- Seed: 2–3 open flags (one raised by the test teacher, one against their
  gradebook, one escalated) + 1 resolved, tied to existing seed sections.

### Phase 2 — Frontend (`frontend/src/app/teacher/grade-flags/`)

- Follow the established `teacher/*` conventions: `page.tsx` assembles
  components from `components/`, **each component with its own CSS module**
  (mirrors `overview/` and `classes/`); centered page header + `<hr>` divider
  pattern; shadcn `Card`/`Table`/`Dialog`/`Badge` for UI primitives only.
- Components: `GradeFlagsHeader`, `RaisedByMeTable`, `AgainstMeTable`
  (+ `AdviseeFlagsTable` for advisers), `RaiseFlagDialog`, `ResolveFlagDialog`,
  `grade-flags-data.ts` types only (no mock — wire to the Phase 1 API from the
  start, unlike `classes/` which is mock-only by directive).
- Sidebar link `teacher-sidebar.tsx:47` already points here — no nav change;
  verify active-state highlight works for the new route (see `href ===
  "/teacher/overview"` pattern ~line 73).
- Status chips map to theme tokens (`--primary` green active chip, destructive
  for escalated); age column as "3d open".

### Phase 3 — Verification & gates

- Backend: `tsc --noEmit`, `vitest run`, migration applies cleanly on a fresh DB.
- Frontend: `tsc --noEmit`, `eslint "src/app/teacher/grade-flags"`, `next build`.
- Smoke test (teacher token): open `/teacher/grade-flags` (no 404) → both
  tables render seeded rows → raise flag on own student → appears in "Raised by
  me" → resolve as owner → status flips + audit row exists → non-owner resolve
  returns 403 → overdue open flag escalates and appears for principal.
- Data-consistency audit (same bar as the teacher-overview audit): flag counts
  on this page reconcile with the overview "Flags" KPI and the principal
  escalated-flags list (0 mismatches).

## Out of scope / explicit non-goals

- Changing the approved §3.4 spec (this plan is build order only).
- Principal escalated-flags dashboard UI itself (separate surface, only the
  `escalated` rows feed it).
- Push/email notification copy for flag events (fires per `notification_prefs`
  defaults; template work later).
- Mobile teacher screens.

## Decisions log (to fill as they are answered)

- [ ] Flag reasons: enum + note vs free-text.
- [ ] Auto-resolution on grade edit (yes/no).
- [ ] `escalation_threshold_days` value + storage + runner (cron vs lazy).
- [ ] Adviser read scope on others' flag notes (full text vs reason-only).
