# Plan: Redesign Principal Interventions (RiskSnapshot-driven)

## Context
The first implementation listed `Intervention` rows and only allowed approve/reject.
Per the corrected product model, the Interventions page should:
- Show **all students in `RiskSnapshot`** (the engine-flagged at-risk students) for the
  active term — this is the principal's working queue of "who might need an intervention".
- Let the principal **create an intervention** for a student and **assign it to a staff
  member** (all staff roles: guidance_counselor, nurse, adm_coordinator, adviser,
  subject_teacher). That write becomes an `Intervention` record.
- Existing `Intervention` rows (if any) are surfaced per-student where they already exist,
  showing assignment + approval + outcome state.

Key discovery: all 360 seeded `Intervention` rows have `riskLevelAtFlag = "Low"` (seed.ts
hardcodes it). The page is driven by `RiskSnapshot` now, so the Low-seed artifact no longer
blocks the list. `RiskSnapshot` holds `studentId, riskLevel, riskCount, termId` (no factor
column — factor must be derived live or shown as risk level + count).

## Schema change
`Intervention` model (schema.prisma) — add staff-assignee field:
- `assignedTo String?`  (nullable User id; the staff handling the intervention)
- `assignedAt DateTime?`
Relation: `assignee User? @relation("InterventionAssignee", fields: [assignedTo], references: [id])`
Keep `reviewedBy` (principal reviewer) as-is.

New migration SQL (new file under prisma/migrations/<ts>_intervention_assignee/migration.sql):
```
ALTER TABLE "Intervention" ADD COLUMN "assignedTo" TEXT;
ALTER TABLE "Intervention" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_assignedTo_fkey"
  FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Intervention_assignedTo_idx" ON "Intervention"("assignedTo");
```
Then `npm run prisma:generate`.

## Backend
File: `backend/src/modules/risk/interventions.service.ts` (rewrite) + `risk.routes.ts`.

1. `GET /api/risk/interventions` (principal)
   - Active term via `resolveActiveTermId()`; active school year for principal scope.
   - List `RiskSnapshot` rows for the active term, scoped to
     `student: { section: { schoolYearId } }`.
   - Filters: `riskLevel?` (High|Moderate), `hasIntervention?` (true|false), `page`, `pageSize`.
   - For each snapshot student, attach any existing `Intervention` (latest) for that student
     (join `intervention.findFirst where studentId orderBy createdAt desc` or a grouped map)
     to show assignment/approval/outcome inline.
   - Response `{ students: [...], total, page, pageSize }` where each item:
     `studentId, lrn, studentName, section, gradeLevel, riskLevel, riskCount,
      intervention: { id, assignedTo, assignedStaffName, approvalStatus, outcomeStatus,
      recommendedAction } | null`.

2. `POST /api/risk/interventions` (principal) — create + assign
   - Body: `{ studentId, recommendedAction, assignedTo, riskLevelAtFlag? }`.
   - Validate `assignedTo` is a staff user (role != student/parent/principal? Actually
     "all staff roles" includes adviser/teacher/specialists; principal is the creator, not
     assignee). Enforce assignee role ∈ {subject_teacher, adviser, nurse, adm_coordinator,
     guidance_counselor, record_keeper, registrar}.
   - Set `reviewedBy = req.user.id` (principal), `approvalStatus = "pending"`,
     `riskLevelAtFlag` from the student's active RiskSnapshot (or body), `outcomeStatus =
     "ongoing"`.
   - Return created `Intervention`.

3. `PATCH /api/risk/interventions/:id` (principal) — keep existing rules:
   - set `approvalStatus` (approve/reject) and `outcomeStatus` (only if approved).
   - ADD: principal may update `assignedTo` / `recommendedAction` on a pending intervention.

## Frontend
Route dir: `frontend/src/app/principal/risk/interventions/` (reuse files, rewrite behavior).

- `types.ts` — `RiskSnapshotStudent`, `InterventionLink`, filters, unions.
- `api.ts` — `fetchInterventionStudents(filters,page)`, `createIntervention(body)`,
  `updateIntervention(id, body)`.
- `page.tsx` — header "Interventions", subtitle "school-wide at-risk students · assign &
  track". Toolbar with Risk-level filter (High/Moderate) + "Has intervention" toggle.
  Table of RiskSnapshot students with an inline "Assign / View" action.
- `components/InterventionsTable.tsx` — columns: Student (name+LRN), Section, Risk,
  Factors/count, Intervention status (None / Assigned / Approved / Resolved), Action button
  (opens drawer).
- `components/InterventionDrawer.tsx` — shows student risk detail; if no intervention:
  principal form (recommended action textarea + staff select) → Create. If intervention
  exists: show assignee, allow re-assign (pending only), Approve/Reject, Outcome segmented
  control (if approved). Calls POST/PATCH.
- `components/InterventionFilters.tsx` — High/Moderate risk chips + has-intervention toggle.
- `interventions.module.css` — reuse tokens; add form/select styles.

## Behavior / UX
- Loading via Skeleton; empty + error states (mirror records page).
- Drawer actions show inline pending state; on success, refetch list.
- `prefers-reduced-motion`; 120–180ms transitions; bg `#FAFAF9`; no gradients.

## Verification
- `tsc --noEmit` (backend), `eslint` + `tsc --noEmit` (frontend).
- Run `prisma generate` + apply migration to Supabase.
- Restart dev servers; open `/principal/risk/interventions`; confirm RiskSnapshot students
  load, filters work, drawer create+assign persists, approve/reject + outcome PATCH works.
- Confirm principal-only auth on all three endpoints.
