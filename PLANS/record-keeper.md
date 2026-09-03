# Plan: Record Keeper Workspace (frontend + required backend)

> Working plan for making the **Record Keeper** a fully operational role (Grades 7–10 scope),
> matching the role-workflow transaction spec. Supersedes any earlier assumption that the
> Record Keeper shares the Registrar shell with no differentiation.

## Context (current state & gaps found in codebase)

- Stack: Next.js 16 (App Router, Turbopack), Tailwind + shadcn/ui, React 19, axios (`apiClient`).
- Roles (`frontend/src/lib/auth/roles.ts`): `record_keeper` = "Record Keeper", grade band **7–10**.
- Backend already has `record_keeper` in `requireRole(...)` arrays and a **grade-band guard**
  (`backend/src/middleware/gradeBand.ts`): `record_keeper` → G7–10, `registrar` → G11–12.
- **Frontend gap A (login 404):** `LoginForm.tsx:75` redirects `record_keeper` →
  `/record-keeper`, but **no `app/record-keeper` route exists** → the user hits a 404 on login.
- **Frontend gap B (no role gating):** `/registrar/*` layout + `registrar-sidebar.tsx` are role-blind.
  A record keeper who manually opens `/registrar/*` sees the same pages/menu as a registrar (no G7–10
  vs G11–12 distinction).
- **Frontend gap C (missing routes):** the sidebar links `/registrar/report-cards`, but no such
  directory exists (the nav item is a dead link) — same issue applies to a record-keeper report-card view.
- **Backend state:** `registrar.routes.ts` allows `record_keeper` on some endpoints
  (`requireRole("registrar","record_keeper")`: overview/records reads ~lines 35, 280, 429, 769) and
  blocks it on registrar-only endpoints (`requireRole("registrar")`: ~lines 499, 584, 711, 720, 732).
  `academics.routes.ts` and `sf10.routes.ts` also list `record_keeper` with band filtering.
- Existing plans near this one: `PLANS/registrar-workspace.md`, `PLANS/academics-backend-wiring.md`,
  `PLANS/registrar-overview-backend.md`; role docs in `docs/role-modules/registrar.md`.

## Functional requirements (user-provided — source of truth)

The system shall allow the registrar/record keeper to receive locked grades, manage records, and
upload/extract/validate SF10 records. Record Keeper specifics below.

### Transaction spec — "8. Record Keeper"

**How they get an account:** Set up directly by the school (fixed login).

**What they see on their page:**
- New account requests from **Grade 7–10** students and their parents, waiting for approval.
- Locked grades from adviser for **Grade 7–10** students.
- Final grade records and reports for **all grade levels** (this part of the job is NOT split by band).
- Pending adviser access requests waiting for a decision (Grade 7–10 advisers).
- Scan and digitize paper report cards into the system (SF10 / report cards).

**What they can do:**
- Approve/reject Grade 7–10 student sign-ups and the linked parent account in the same step.
- Assign teachers to Grade 7–10 classes.
- Create sections and subjects for Grade 7–10 (matches the 7–10 band split).
- Manage Grade 7–10 report cards.
- Generate official reports for the whole school.
- Approve/deny an Adviser's request for extra access to their advisees' full records.
- Set up the school year and grading periods — incl. all status transitions (upcoming → active → completed).
  *(NOTE: matches the spec for this role, but the registrar plan says setup is Principal-only; confirm the
  division of power before building this item — see Decisions below.)*

**What they CAN'T see:**
- Private counseling / health / ADM case notes.
- The Grade 11–12 approval queue (that's Registrar).
- Registrar-only setup flows.

## Implementation plan

### Phase 0 — Decisions to confirm (blockers before build)
1. **Shell strategy:** dedicated `/record-keeper/*` app+sidebar (recommended) vs. reused `/registrar/*`
   with role-aware menu hiding.
2. **School year / grading-period setup:** which role owns it (spec conflict between Record Keeper and
   Registrar plans; Principal-only per earlier plan).
3. **G7–10 test data:** is a G7–10 dataset available (students, sections, subjects, grades, advisers,
   pending account requests), or must we seed it?

### Phase 1 — Routing & authentication scaffold
- Create `frontend/src/app/record-keeper/layout.tsx` (mirror `registrar/layout.tsx` shell) and
  `frontend/src/components/record-keeper-sidebar.tsx`.
- Fix `LoginForm.tsx:73-77` redirect map — ensure `record_keeper` → `/record-keeper/overview`.
- Add a role guard so `record_keeper` cannot access `/registrar/*` and `registrar` cannot access
  `/record-keeper/*` (shared `RequireRole` / layout check wrapper).

### Phase 2 — Sidebar + Overview
- Sidebar groups (scoped to G7–10 duties):
  - **Overview** — Overview `/record-keeper/overview`
  - **Records** — Final Grades (locked, G7–10), Account Approvals (G7–10), Adviser Access Requests (G7–10),
    Sections & Subjects (G7–10), Report Cards (G7–10), SF10 Records, School Reports
- Overview page: counts (pending account approvals, locked grades, pending adviser requests),
  reuse the registrar overview layout pattern, driven by a `record_keeper` token.

### Phase 3 — Grade-band-aware pages (reuse & parameterize)
- Decide whether pages are copied into `/record-keeper/*` or shared components from `/registrar/*`.
  Priority order:
  1. **Account Approvals** (G7–10) — approve/reject student + parent link in one step.
  2. **Sections & Subjects** (G7–10) — create sections/subjects, assign teachers (reuse academics components,
     band-filtered).
  3. **Adviser Access Requests** (G7–10) — approve/deny.
  4. **Final Grades / Report Cards** (G7–10; final-grades/reports are school-wide, not band-split).
  5. **SF10 Records** — keep drag-drop attach + digitize flow (shared, band-aware; also resolve the open
     SF10 student-association decision noted in the latest audit).
- Verify each reused endpoint responds for a `record_keeper` token; add band filtering where the frontend
  currently doesn't filter (backend already guards via `gradeBandGuard` / `resolveGradeBand`).

### Phase 4 — Data & seeding
- If no G7–10 dataset exists, write/extend seed data: G7–10 advisers, sections, subjects, students +
  parent links, pending account requests, locked grades, adviser access requests.
- Provide `recordkeeper@zentra.test` logins + a known test seed for smoke tests.

### Phase 5 — Verification & gates
- Backend: `tsc --noEmit`, `vitest run`, `tsc -p tsconfig.json` (build).
- Frontend: `tsc --noEmit`, `eslint`, `next build`.
- Smoke test: login as record_keeper → lands on `/record-keeper/overview` (no 404), each page renders,
  G7–10 data shows, `/registrar/*` is blocked.

## Out of scope / explicit non-goals
- Private counseling / health / ADM note access for the Record Keeper (never exposed).
- Grade encoding/editing (that is Adviser/Subject Teacher's job).
- Principal-only flows (final ADM approval, audit review) unless explicitly granted.

## Decisions log (to fill as they are answered)
- [ ] Shell strategy (dedicated vs shared).
- [ ] Grading-period/school-year setup ownership.
- [ ] G7–10 data source (existing vs seed).
- [ ] Copy-vs-share page components.
- [ ] SF10 upload student association (open from prior audit).
