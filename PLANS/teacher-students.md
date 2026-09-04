# Plan: Teacher Students page (`/teacher/advisory/students`)

> Focused implementation plan for the teacher/adviser **Students** surface.
> Spec source of truth: `docs/role-modules/teacher-adviser-plan.md` §4.1
> (Advisory Students), §3 class-workspace Students tab, §5 (cross-cutting
> rules), §7 (sidebar), §8 (API surface). This plan adds the build order,
> endpoint inventory, and verification gates — it does not change the spec.

## Context (current state & gaps found in codebase)

- Roles (`frontend/src/components/auth/LoginForm.tsx:76`): `subject_teacher` and
  `adviser` both land on `/teacher/overview`. Adviser-ness comes from
  `Section.adviserId` rows (single adviser per section in code; no
  `section_advisers` table).
- **Frontend gap A (dead nav link):** `frontend/src/components/teacher-sidebar.tsx:53`
  already links `{ title: "Students", href: "/teacher/advisory/students" }`,
  but **no `frontend/src/app/teacher/advisory/` route exists** → the user hits
  a 404 on click. Only `overview/`, `classes/`, and `grade-flags/` exist under
  `/teacher`. (Same pattern grade-flags had before it was built; same for the
  Attendance / Anecdotal / Referrals / ADM Cases links — those are separate
  pages, out of scope here.)
- **Backend gap B (no roster endpoint):** no dedicated advisory-students route
  exists. Reusable pieces already live and tested:
  - `GET /api/teacher/overview` (`backend/src/modules/teacher/teacher.routes.ts`
    ~lines 246–282) already returns advisory students (name, section, risk
    level, flag categories) — the roster can start from this shape.
  - `GET /api/risk/students/:id` (`backend/src/modules/risk/risk.routes.ts:124`)
    exists but its advisee-scope gating is **unverified** — audit it in Phase 1.
  - `GET /api/grades/students/:id/final-grades` (grades.routes.ts:68) and
    `GET /api/attendance/students/:id/attendance-rate` (attendance.routes.ts:665)
    exist for the drawer (read-only).
  - No new tables needed.
- **Spec (already approved):** §4.1 — filter chips [All][Low][Mod][High] +
  quick filters (open flag, attendance < 80%, anecdotal count), student cards
  (avatar, name, LRN, risk chip, category chips — never write-up text), click
  card → drawer (subject grades read-only, attendance rate, anecdotal
  count + tier badge, referrals + ADM stage). §3 — subject-teacher Students tab
  is a read-only list (LRN, name, gender; no contact info).
- Related plans: `PLANS/teacher-grade-flags.md`; role docs:
  `docs/role-modules/teacher-adviser-plan.md`; list pattern to mirror:
  `frontend/src/app/principal/risk/students/`.

## Functional requirements (from §4.1 + §3 — source of truth)

### Page — `/teacher/advisory/students` (adviser only; 404 for non-advisers)

- 👁 Advisory section context (section name, SY/term) + roster of advisees only.
- 👁 Filter chips: [All][Low][Moderate][High] by `risk_level`; quick filters:
  has open grade flag, attendance < 80%, has anecdotal (count).
- 👁 Student cards (grid): avatar initials, name, LRN, `risk_level` chip,
  behavioral-category flag chip **only** — never write-up text.
- 👁 Click card → drawer with:
  - Subject grades (read-only, all subjects in this section).
  - Attendance rate (read-only, current term).
  - Anecdotal count + confidentiality-tier badge (no content unless I own it
    or have approved access — §6 flow).
  - Active referrals + ADM case status (stage only).
- 🔒 Never shows non-advisee students or other advisers' advisees. No contact
  info, no addresses, no health detail, no ADM confidential columns.

### States

- Loading: skeleton card grid. Empty (no advisees assigned): "No advisory
  section assigned. Contact the school office."
- 404 surface for pure subject teachers (server-side gate, not a redirect).

## Implementation plan

### Phase 0 — Decisions (recommendations; confirm before Phase 1)

1. **Roster layout:** cards per §4.1 spec (recommended) vs dense sortable table.
2. **Drawer v1 scope:** read-only drawer first (recommended) vs wiring the
   Write-anecdotal / Refer / Request-access entry points now.
3. **Data strategy:** wired-from-start (recommended — build endpoints first,
   no mock-deletion round-trip) vs mock-first UI.

### Phase 1 — Backend (no new tables)

- New `GET /api/teacher/advisory/students` in `backend/src/modules/teacher/`
  (alongside `teacher.routes.ts` + `grade-flags.routes.ts`): gate
  `requireRole("subject_teacher", "adviser")` + 404 unless
  `Section.adviserId = me`; returns advisees with risk level, flag categories,
  attendance rate, anecdotal count + tier, open-grade-flag marker (reuse
  `computeRiskFactors` / `levelFromFlags` from `services/risk.ts` so the page
  agrees with the risk engine by construction).
- Audit `GET /api/risk/students/:id` gating for the advisee scope; add an
  adviser-advisee check if missing (403 otherwise). Reuse the grades and
  attendance read endpoints for drawer data (verify their role lists already
  admit `adviser`).
- Seed check: G7-A advisory data already exercises this (adviser.g7.a +
  20 students); add nothing unless a gap is found.
- Unit tests (DB-free, vitest): scope-gating helper (non-adviser → 404) and
  any risk-shape mapping added.

### Phase 2 — Frontend (`frontend/src/app/teacher/advisory/students/`)

- Follow the established `teacher/*` conventions: `page.tsx` assembles
  components from `components/`, **each component with its own CSS module**
  (mirrors `overview/`, `classes/`, `grade-flags/`); centered page header +
  `<hr>` divider pattern; shadcn `Card`/`Dialog`/`Badge` for UI primitives
  only; React Query for fetching (grade-flags pattern, incl. 403 → hide).
- Components: `AdvisoryStudentsHeader`, `RiskFilterChips`, `StudentCards`,
  `StudentDrawer`, `advisory-students-data.ts` (types + api fns).
- Sidebar link `teacher-sidebar.tsx:53` already points here — no nav change;
  verify active-state highlight for the new route.
- Drawer confidentiality: tier badges only; write-up text never rendered
  (assert in review, not just by eye — grep the drawer for the content field).

### Phase 3 — Verification & gates

- Backend: `tsc --noEmit`, `vitest run`, `tsc -p tsconfig.json` (build).
- Frontend: `tsc --noEmit`, `eslint`, `next build`.
- Smoke test: login as adviser → roster shows only advisees → filters work →
  drawer opens with grades/attendance/counts, no write-up text → login as pure
  subject teacher (`teacher.subject@zentra.test`) → `/teacher/advisory/students`
  is blocked.
- Data-consistency audit (same bar as prior audits): roster count + risk
  levels reconcile with the teacher-overview advisory list (0 mismatches).

## Out of scope / explicit non-goals

- Attendance / Anecdotal / Referrals / ADM Cases pages (separate dead links,
  separate plans).
- Drawer write actions (anecdotal composer, referral composer, access request)
  unless Phase 0 decides otherwise.
- Changing the approved §4.1 spec (this plan is build order only).
- Mobile teacher screens.

## Decisions log (answered during build — implemented as decided)

- [x] Roster layout: **dense table** (not spec cards) — Student · LRN ·
  Birthday · Gender · At-Risk Level + 3-dots menu, mirroring the
  principal interventions list-table (search + Risk checkbox dropdown + Clear,
  clickable rows, 15/page pagination, skeleton rows).
- [x] Drawer v1 scope: **read-only** — grades, attendance breakdown, anecdotal
  count + tiers, referrals (target + status), ADM stage, grade flags; 3-dots
  menu deep-links into drawer sections (anecdotal / attendance / academic)
  with scroll + highlight. No write actions.
- [x] Data strategy: **wired-from-start** — `GET /api/teacher/advisory/students`
  + `GET /api/teacher/advisory/students/:id`, all mock files deleted.
- [x] Gender has no backend field → added nullable `StudentProfile.gender` +
  migration `20260904010000_student_gender`, seed assignment, live backfill.
- [x] Adviser add-student → **enlist to section roster** (`POST
  /api/teacher/advisory/roster`, LRN + name, 409 on duplicate/registered,
  audited): appears in roster with a "No account" badge; full records unlock
  on registration + approval. No mock append.
