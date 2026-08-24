# Wire Principal Academics KPIs to Backend

## Problem
`frontend/src/app/principal/academics/` renders KPIs and breakdowns from a static
`mockData.ts` — there is **no API call** and **no `/api/academics` backend route**.
The overview page is the only principal page wired to the backend. Goal: make the
academics page fetch real data, computed from `FinalGrade`/`StudentProfile`/`Section`,
with mock fallback (matching the overview pattern).

## Backend (new module `backend/src/modules/academics/`)

1. `academics.service.ts` — `getAcademicsSummary()`:
   - Resolve active term (`schoolYear.isActive` → first `Term` by `termNumber`).
   - Load sections (`prisma.section.findMany` with `students` + `finalGrades` where `termId`).
   - For each student compute `overallAverage` = mean of `transmutedGrade` across their
     final grades for the term (guard nulls). Use `student.riskLevel` (already maintained
     by `recomputeRisk`) for `High`/`Moderate`/`Low`.
   - Build per-section `SectionSummary` (sectionId, section, grade, avgTransmuted = mean of
     student overallAverages, passPct/failPct by `overallAverage >= 75`, atRiskCount,
     students array with subjects = final grades mapped to `StudentSubject`).
   - Build `passFailByGrade` (passed/failed per grade) and `honorRollPreview`
     (overallAverage >= 90 && riskLevel !== High, top 12).
   - Return `{ termLabel, sections, passFailByGrade, honorRollPreview }` matching
     `AcademicsMock` shape so the frontend type fits unchanged.

2. `academics.routes.ts` — `GET /` with `requireAuth`, `requireRole("principal")`,
   mirroring `overview.routes.ts`. Calls the service, returns JSON.

3. `app.ts` — import and mount `app.use("/api/academics", academicsRoutes);`
   (after the overview mount, line 37).

## Frontend (refactor, keep mock as fallback)

4. `frontend/src/app/principal/academics/mockData.ts` — export `MOCK: AcademicsMock`
   (rename `mockAcademics` → keep export, plus named `MOCK` alias) so it can be used as
   fallback. No behavior change to shape.

5. `frontend/src/app/principal/academics/page.tsx`:
   - Add `useState<AcademicsMock | null>(null)` + `error`.
   - In `useEffect`, `apiClient.get<AcademicsMock>("/api/academics")`, set data on
     success, log + keep mock on failure (same pattern as overview `page.tsx:30-47`).
   - Use `data ?? MOCK` for `termLabel`, `sections`, `gradeTabs`, `hasFinals`,
     and `selectedSectionId`/`gradeTab` initial state (fall back when `data` null).
   - `loading` = `!data && !error`. Remove the fake 400ms `setTimeout`.
   - Pass `loading` and real `sections` into `AcademicsKpis`, `SectionSummaryTable`,
     `AverageGradeByLevel`, `SectionStudentsPanel`, `GradeBreakdownDrawer` (these already
     accept `SectionSummary[]`/`StudentRow` — same shape from backend).

6. `AcademicsKpis.tsx` — already props-driven (`sections`, `loading`); no change needed
   beyond ensuring it receives backend data. Keep as-is.

## Verification
- `cd backend && npx tsc --noEmit` (or existing lint) for the new module.
- `cd frontend && npx tsc --noEmit` (or existing lint).
- Start backend + frontend, sign in as principal, open `/principal/academics`:
  KPIs/sections render from `/api/academics`; if API is down, mock fallback shows.
