# Plan: Principal Academics Page (Mock Data + UI Design Only)

## Goal
Build `/principal/academics` for the **"View school-wide student academic
performance and progress"** requirement — **UI + hardcoded mock data only**.
No backend endpoint, no `apiClient`, no real data wiring. The page must render
correctly and look production-ready so a later task can swap mock data for the
real `/api/academics/summary` response (shape documented at the bottom).

This is the 2nd functional requirement only. ADM, Honor Roll, Risk, Reports are
out of scope (their sections are shown as a small preview strip per spec, but not
built as full modules).

## Scope guard
- ✅ Build React components, mock data, styling.
- ❌ Do NOT add backend routes, services, or `apiClient` calls.
- ❌ Do NOT implement export (CSV/PDF) logic beyond a disabled/placeholder button.
- ❌ Do NOT add edit/lock grade capabilities (view-only).

## Route & access
- Add `frontend/src/app/principal/academics/page.tsx` (a `"use client"` page).
- It renders inside the existing `principal` layout (already wraps `/principal/*`),
  so no new layout needed. Sidebar already links `/principal/academics`.

## UI structure (from principal.md §3, lines 178–209)
```
TopBar: [Grade▾][Section▾][Term▾][Subject▾] ............ [Export ▾]
Summary Table (sticky header, monospaced grades)
  Section | Grade | Avg Transmuted | Pass% | Fail% | #At-Risk   (expand ▸ students)
Pass/Fail distribution (stacked bar per grade) + Honor-roll preview strip
Expandable student list per section (LRN, name, risk badge, overall avg, attendance%)
Click student → Grade Breakdown drawer (view-only)
```

## Files to create
1. `frontend/src/app/principal/academics/page.tsx`
   - `"use client"`. Imports `mockAcademics` from `./mockData.ts`.
   - Holds filter state (grade/section/term/subject) initialized to "All".
   - Renders `AcademicFilters`, `SectionSummaryTable`, `PassFailChart`,
     `HonorRollStrip`, `GradeBreakdownDrawer`.
2. `frontend/src/app/principal/academics/mockData.ts`
   - Typed mock dataset (shapes below). Enough rows to fill 6 grades × 3 sections
     and ~6–10 students per section. Deterministic, realistic DepEd-style numbers
     (transmuted grades 75–98, remarks Passed/Failed, riskLevel H/M/L).
   - Include a `termOptions`, `gradeOptions`, `sectionOptions`, `subjectOptions`
     arrays for the filter `<Select>`s.
3. `frontend/src/app/principal/academics/components/AcademicFilters.tsx`
   - Uses `@/components/ui/select` (Select/SelectTrigger/SelectContent/
     SelectItem). Four filters + an Export button (placeholder, disabled or no-op).
   - Filters are local state; parent derives the visible subset via `useMemo`.
4. `frontend/src/app/principal/academics/components/SectionSummaryTable.tsx`
   - Uses `@/components/ui/table` (Table/TableHeader/TableBody/TableRow/TableHead/
     TableCell). Sticky header. Monospaced grades (`font-mono` / tabular-nums).
   - One row per section in scope. Expandable row (chevron) reveals that section's
     student list (LRN, name, risk `Badge`, overall avg, attendance %).
   - Clicking a student row sets `selectedStudent` → opens drawer.
   - `#At-Risk` cell = count of H/M students in the section.
5. `frontend/src/app/principal/academics/components/PassFailChart.tsx`
   - Uses `@/components/ui/chart` + recharts stacked bar, one bar per grade,
     segments Passed (green) / Failed (red). Mirrors `AttendancePanel` styling.
6. `frontend/src/app/principal/academics/components/HonorRollStrip.tsx`
   - Horizontal strip of top candidates (overall avg ≥ 90, no failing remark).
     Each item: name + avg. Links are placeholder (#) — full module is separate.
7. `frontend/src/app/principal/academics/components/GradeBreakdownDrawer.tsx`
   - Uses `@/components/ui/sheet` (Sheet/SheetContent/SheetHeader/SheetTitle/
     SheetDescription). Right-side drawer, view-only.
   - Shows selected student's per-subject breakdown: component weights
     (Written Work / Performance Task / Quarterly Exam), computed average,
     DepEd-transmuted grade, remarks. Data taken from `student.subjects` in mock.
8. `frontend/src/app/principal/academics/academics.module.css`
   - Module styles following `attendance-heatmap.module.css` conventions:
     `rounded-md`, 1px border, soft off-white surface, sticky header, monospaced
     grades, minimal micro-motion. Honor the existing CSS variables in
     `globals.css` (background, card, border, primary, muted-foreground).
   - Include skeleton styles for the loading state even though mock is instant
     (so the later real-API swap has a ready state).

## Mock data shapes (TypeScript types in mockData.ts)
```ts
type RiskLevel = "High" | "Moderate" | "Low";
type Remarks = "Passed" | "Failed";

interface StudentRow {
  studentId: string; lrn: string; name: string;
  riskLevel: RiskLevel; overallAverage: number; attendanceRatePct: number;
  subjects: { subject: string; computedAverage: number; transmutedGrade: number; remarks: Remarks }[];
}
interface SectionSummary {
  sectionId: string; section: string; grade: string;
  avgTransmuted: number; passPct: number; failPct: number; atRiskCount: number;
  students: StudentRow[];
}
interface PassFailByGrade { grade: string; passed: number; failed: number; }
interface HonorRollCandidate { studentId: string; name: string; overallAverage: number; }

interface AcademicsMock {
  termLabel: string;
  sections: SectionSummary[];
  passFailByGrade: PassFailByGrade[];
  honorRollPreview: HonorRollCandidate[];
}
```

## Filtering logic (client-side, no backend)
- `gradeOptions` from distinct `section.grade`; `sectionOptions` filtered by
  selected grade; `termOptions`/`subjectOptions` static lists (Term 1/2/3,
  core subjects). Selecting a grade/section narrows `sections` shown. Term/Subject
  are display-only selectors in this mock pass (no real scoping needed) but must
  still update UI state so the later API swap is a drop-in.

## Design language (principal.md visual notes)
- Calm overview: soft off-white `#FAFAF9`, one brand accent (green), `rounded-md`,
  1px borders, data-dense tables with sticky headers, monospaced IDs/grades.
- Risk badges: High = red, Moderate = amber, Low = muted/green. Reuse
  `@/components/ui/badge` with `variant` or custom classes.
- Honor Roll strip: card-like chips, accent border.

## States
- Loading skeleton (table + chart) — included even though mock is instant, ready
  for real API.
- Empty (no finals): "No finalized grades for this term."
- Zero-filter: "No sections match."

## Validation (no backend)
1. `cd frontend && npx tsc --noEmit` clean.
2. `npm run lint` clean on new files; `npm run build` succeeds.
3. `npm run dev`, log in as principal, open `/principal/academics`:
   - Table shows 6 grades × sections with avg transmuted, pass/fail %, at-risk.
   - Expand a section → student list with risk badges + attendance %.
   - Click student → drawer shows subject breakdown (view-only).
   - Grade/Section filters narrow the table; Term/Subject update state.
   - Pass/Fail chart renders per grade; Honor Roll strip shows top candidates.
   - Empty/zero-filter messages render when forced.
4. Confirm no `apiClient`/fetch calls exist in these files (grep).

## Out of scope (future task)
- Real `GET /api/academics/summary` backend + wiring (response shape = the
  `AcademicsMock` interface above, minus `subjects` detail which comes from
  `GET /api/grades/students/:id/final-grades`).
- Export CSV/PDF functionality.
- Honor Roll / ADM / Risk full modules.
