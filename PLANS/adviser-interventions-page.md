# Adviser › Interventions page

Status: implemented (read-only adviser monitoring desk).
Owner session: `ses_e4a36a96fffe88J4upz12BjL1R` (plan-mode decisions locked: read-only, full session detail, include flagged advisees with no plan yet).

## Goal

Advisers already receive intervention notifications (`intervention_detected`,
`intervention_session`, …) through the teacher realtime channel, but there is no
page to open: `/api/interventions/*` is guidance-only. Add a read-only desk under
the teacher/adviser shell so an adviser can monitor the interventions and risk
flags for **only their own advisory section(s)**.

## Route & navigation

- Route: `/teacher/advisory/interventions`
- Nav: "Interventions" in the Advisory group, right after Referrals
  (`frontend/src/components/teacher-sidebar.tsx`). The sidebar `NAV` feeds the
  shell's global search automatically.

## Backend (no schema change, no migration)

### `backend/src/services/teacher/interventions.service.ts`

`listAdvisoryInterventions(ctx, query)`:

1. `adviserSectionsOr404(ctx.userId, ctx.schoolYearId)` → `404 NOT_ADVISER` for
   pure subject teachers (they can open the route by role, but have no desk).
2. Term from `ctx.termId` (already resolved by `attachTermScope` for teachers).
3. Load `StudentProfile` + `StudentRoster` scoped by `sectionId`, dropping roster
   rows whose LRN already has a profile (same merge rule as the advisory list).
4. Load this term's `Intervention` rows for those learner ids, including the
   assignee and every `counselingSession` (type, schedule, venue, status, notes,
   outcome, cancel reason, completed date, attachment count). Latest intervention
   per learner wins (`orderBy id desc`).
5. Latest `RiskSnapshot` date per learner (`groupBy _max(snapshotDate)`), falling
   back to the intervention's `assignedAt`, for `detectedAt`.
6. Build rows from the **profile/roster risk flags** (same source as the rest of
   the teacher shell, so counts agree), compute the factor chips + summary.
7. Filters `level` / `factor` / `outcome` (including `none` = no plan yet) /
   `sectionId` / `q`, risk-first sort, standard **15/page** envelope.

Response: `{ summary, sections, learners, page, pageSize, total, totalPages }`.
`summary` = `{ high, moderate, low, ongoing, resolved, unresolved, noPlan, total }`.

### `backend/src/modules/teacher/interventions.routes.ts`

- `GET /api/teacher/advisory/interventions` — `requireAuth`,
  `requireRole(...TEACHER_ROLES)`, Zod query schema, `cache` tagged
  `[teacher, interventions]`, TTL dashboard (15s), `etag`.
- Mounted in `backend/src/modules/teacher/advisory.routes.ts`.
- No `:id` endpoint: the list already returns the full session detail, so the
  detail overlay renders from the row.

## Frontend

- `frontend/src/services/teacher/interventions.service.ts` — typed
  `useAdvisoryInterventions` via `usePaginatedQuery` (`preset: "live"`), module
  key `advisory-interventions`.
- `frontend/src/lib/realtime/teacherKeys.ts` — register
  `["advisory-interventions"]` in `TEACHER_QUERY_KEYS` and the `advisory` scope,
  so the page auto-refreshes on `intervention_*` notifications.
- `frontend/src/app/teacher/advisory/interventions/page.tsx` + `components/`:
  - summary strip (High / Moderate / Ongoing / Resolved / No plan yet)
  - filters (risk level, factor, outcome incl. "No plan yet") + debounced search,
    URL-synced via `useUrlPager`
  - learner cards with risk + factor `Pill`s, section filter only when the
    adviser has more than one section, "No plan yet" state
  - detail overlay (`KanbanOverlay`): factors, recommended action, intake notes,
    assignee, approval/outcome, full session timeline, and links to the
    advisee's Academic / Attendance / Anecdotal pages
  - skeleton + empty state ("No advisees flagged this term")
- Shared pieces only: `Pagination` + `useUrlPager`, `Pill`,
  `lib/labels/status-tone.ts`, `TeacherEmptyCard`.
- Update `AGENTS.md` §7 with the new desk.

## Edge cases

- Roster-only learners (`roster:<id>`) and LRN dedupe against profiles.
- Multiple advised sections → section filter shown only when >1.
- Only current-term interventions; a learner may appear as "No plan yet" even
  with an older resolved case.
- ADM-exempt learners keep whatever flags exist (attendance factor already
  suppressed upstream).
- Non-advisers get `404 NOT_ADVISER`.

## Verify

- `cd backend && npm run typecheck`
- `cd frontend && npx tsc --noEmit -p tsconfig.json`
- Runtime sanity: adviser with a section sees only its learners; guidance writes
  bust the `teacher` cache tag so the desk refreshes within one TTL.

## Risk

The page shows confidential counseling notes to the section adviser (explicitly
chosen). Server-side scoping is `Section.adviserId`, but this is a real
confidentiality widening — worth confirming with the guidance desk.
