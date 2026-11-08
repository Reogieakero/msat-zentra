# Teacher — Term Selection, Term-Scoped Data & Roster Carry-Over Confirmation

## Goal

Make the teacher's term picker unambiguous: **every page shows only data inside
the selected term**, and when the adviser's roster/class list carries over from
the previous term, the adviser confirms it once instead of wondering whether the
board is broken or stale.

Nothing is ever copied forward. Grades, attendance, anecdotal records,
referrals, interventions and risk stay empty/fresh per term by design. The
confirmation is an **acknowledgement + snapshot**, not a data clone.

## Ownership (corrected)

The advisory roster is **adviser-owned**, not registrar-owned:

- `POST /api/teacher/roster` → `enlistRoster()` in
  `backend/src/services/advisory/roster.service.ts:32`
- It resolves the caller's advisory sections via
  `adviserSectionsOr404(teacherId, yearId)`, so only the section's adviser can
  enlist or edit a learner.
- Class lists (`TeacherSubjectAssignment`, `SectionTimetableEntry`) are
  **per term** and created by academics/registrar — they already refresh with
  the term and need no confirmation, only the term banner.

## Current state (verified)

| Data | Scope | Behaviour on term switch |
|---|---|---|
| `GradeComponent`, `Assessment`, `StudentGrade`, `FinalGrade` | `termId` | fresh |
| `AttendanceRecord`, `AnecdotalRecord`, `Referral`, `Intervention`, `RiskSnapshot`, `GradeFlag` | `termId` | fresh |
| `TeacherSubjectAssignment`, `SectionTimetableEntry` | `termId` | class list refreshes |
| `Section` | `schoolYearId` | unchanged within a year |
| `StudentRoster` | `@@unique([lrn, schoolYearId])` | unchanged within a year |
| `StudentProfile.sectionId` | global pointer | unchanged |
| `AdvisoryModule` | `termId` (+ `sectionId`) | fresh: only the selected term's modules |

So inside one school year Terms 1–3 share the exact same roster rows, and
`StudentRoster` has **no `createdAt` and no `termId`** — "was this learner
enlisted this term?" cannot be answered from the data today. That gap is what
the schema step below fixes.

## Decisions (defaults, applied in this plan)

1. **Roster truth**: add `createdAt` + `enlistedTermId` to `StudentRoster`
   (additive migration) **and** store an acknowledgement snapshot per term.
2. **Persistence**: new `TermRosterConfirmation` table (survives device change,
   auditable), not `localStorage`.
3. **Prompt timing**: only when the roster actually changed since the last
   acknowledgement, or on first visit to a newly selected term. Never more than
   once per `(user, term, kind)`.
4. **New school year**: no previous roster → notice + link to Advisory List, no
   confirmation.
5. **`AdvisoryModule` term-scoping**: implemented 2026-11-08 (see below).
6. **Who sees what**: advisers see the roster confirmation; subject teachers
   only see the term banner.

## Backend

### Schema (`backend/prisma/schema.prisma`)

```prisma
model StudentRoster {
  // …existing fields…
  createdAt      DateTime @default(now())
  // Term the learner was enlisted in. Null = legacy row created before this
  // column existed; treated as "not newly enlisted", never as "new this term".
  enlistedTermId String?
  enlistedTerm   Term?    @relation("RosterEnlistTerm", fields: [enlistedTermId], references: [id])
  @@index([enlistedTermId])
}

model Term {
  // …existing fields…
  rosterEnlistments     StudentRoster[]            @relation("RosterEnlistTerm")
  rosterConfirmations   TermRosterConfirmation[]
}

model TermRosterConfirmation {
  id                String   @id @default(uuid())
  userId            String
  termId            String
  kind              String   // "roster" | "classes"
  rosterFingerprint String   // sha256 of sorted "lrn:sectionId" pairs
  acknowledgedAt    DateTime @default(now())
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  term              Term     @relation(fields: [termId], references: [id], onDelete: Cascade)
  @@unique([userId, termId, kind])
  @@index([termId])
}
```

- Migration is **additive**; no backfill of real enlist dates is possible, so
  legacy rows keep `enlistedTermId = null` and `createdAt = now()`.
- `enlistRoster()` must set `enlistedTermId: ctx.termId` going forward.
- Add `rosterConfirmations` relation to `User`.
- Regenerate the committed client (`npm run prisma:generate`) and keep
  `backend/prisma/migrations/0001_rls.sql` in sync if RLS covers new tables.
- CI auto-deploys migrations to the live DB — treat this as a production op.

### Service — `backend/src/services/teacher/termContext.service.ts` (new)

`getTermContext(ctx)`:

1. Resolve selected term + previous term (`termNumber - 1` in the same school
   year; if `termNumber === 1`, the last term of the previous school year).
2. Advisory sections for the selected school year (`adviserSectionsOr404`,
   `.catch(() => [])` so non-advisers get an empty block, not a 404).
3. Roster rows for those sections → `learners[]`, `fingerprint` (sha256 of
   sorted `lrn:sectionId`).
4. `newLearners` = rows where `enlistedTermId === selectedTermId`.
5. `previous` block: same computation for the previous term (roster is shared,
   so the only real diff is `enlistedTermId`), plus class ids
   (`subjectId|sectionId`) from `TeacherSubjectAssignment` +
   approved `SectionTimetableEntry` for each term.
6. `changed` = fingerprint differs from the stored
   `TermRosterConfirmation.rosterFingerprint` **or** `newLearners.length > 0`.
7. `needsConfirmation` = `isAdviser && changed && !alreadyAcknowledged`.

`acknowledgeTermContext(ctx, { kind, fingerprint })`:

- Upsert `TermRosterConfirmation` for `(userId, termId, kind)`; reject when the
  submitted fingerprint no longer matches the current roster (409
  `ROSTER_CHANGED`, so the adviser re-reads the diff).
- `writeAudit` (`sourceTable: "term_roster_confirmation"`), `invalidateTags`
  for `teacher`, `advisory`, `overview`.

### Routes — `backend/src/modules/teacher/term-context.routes.ts` (new)

- `GET /api/teacher/term-context`
- `POST /api/teacher/term-context/confirm`

Both `requireAuth` + `requireRole(TEACHER_ROLES)`, term-scoped, cached
(`CACHE_TAGS.teacher`, short TTL) with tag invalidation on confirm and on
roster writes. Mount in `backend/src/app.ts` alongside the other teacher
routers.

### Roster enlistment

`enlistRoster()` (`services/advisory/roster.service.ts:68`) gains
`enlistedTermId: ctx.termId` and invalidates the `teacher` term-context tag.

## Frontend

### Service — `frontend/src/services/teacher/termContext.service.ts` (new)

- `useTermContext()`, `useAcknowledgeTermContext()`.
- Query key `["teacher-term-context", schoolYearId, termId]` added to
  `frontend/src/lib/api/queryKeys.ts` (`teacherKeys`), invalidated by
  `TermContext`'s switch invalidation and the `teacher` realtime scope.

### Banner — `frontend/src/components/term/TermScopeBanner.tsx` (new)

- `SY 2026–2027 · Term 2 · Nov 4 – Feb 12` + one muted line:
  "Grades, attendance, anecdotal records and reports are Term 2 only."
- Rendered once in `frontend/src/app/teacher/layout.tsx`, under the topbar.
- Uses `Pill` + existing popover/border tokens; no new CSS module needed beyond
  a small one for spacing.

### Confirmation — `frontend/src/components/term/RosterCarryOverOverlay.tsx` (new)

Reuses `KanbanOverlay` (`width="md"`):

- **Same roster** → "Same 34 learners as Term 1. Continue with fresh Term 2
  data." → [Continue].
- **Changed** → pill diff: `+2 newly enlisted` (names), `−1 removed`,
  `+1 new class` / `−1 class removed` → [Use this roster].
- **New school year** → "New school year — enlist your section's learners."
  → [Go to Advisory List] (link only, no confirm).
- Footer shows `Acknowledge term context`; submit posts the fingerprint.
- Mounted from `teacher/layout.tsx`, visible only when
  `isAdviser && needsConfirmation`.

### Pages

No per-page changes required — the banner is layout-level and every page already
sends the term headers through `apiClient`. Optional follow-up: empty-state copy
on Gradebook / Attendance / Lock Grades reads "No Term 2 data yet — Term 1
grades are not carried over."

## Out of scope

- Copying grades, attendance, anecdotal records or rosters across terms or
  school years.
- Registrar/principal-side "enrol from previous year" tooling.

## Advisory module term scoping (implemented 2026-11-08)

`AdvisoryModule` gained a nullable `termId` (additive migration
`20261108020000_advisory_module_term`). Existing rows are backfilled to the term
in the section's school year whose date window contains the release (or created)
date; otherwise the nearest term wins. New modules store the teacher's selected
term. Reads now filter by term in:

- `services/advisory/modules.service.ts` — list, load (edit/delete/submissions),
  create.
- `services/student/modules.service.ts` + `modules/student/modules.routes.ts` —
  the learner's current term (`resolveActiveTermId`).
- `services/adm/monitoring.service.ts` — the case desk merges only the case
  term's section ADM modules.
- `services/adm/queues.list.service.ts` — module progress counts per
  section + case term.

## Phases

1. **Schema** — `StudentRoster.createdAt/enlistedTermId`, `TermRosterConfirmation`,
   migration, regenerate client, update RLS if needed.
2. **Backend** — `enlistRoster` writes `enlistedTermId`; `termContext.service.ts`,
   routes, cache tags, tests.
3. **Frontend** — service hooks, query keys, `TermScopeBanner`, overlay, layout
   wiring.
4. **Verification** — backend `npm run typecheck` + `npm test`, frontend
   `npx tsc --noEmit -p tsconfig.json` + `npm run lint`; manual walk-through of
   T1→T2 switch (same roster), mid-term enlist (changed diff), new school year.

## Acceptance criteria

- Switching term shows only that term's grades/attendance/anecdotal/reports on
  every teacher page; no stale T1 rows anywhere.
- Class cards refresh with the term (already true) and never require input from
  the adviser.
- Adviser sees the confirmation **once per term**; the overlay never appears for
  subject-only teachers.
- Enlisting a learner after acknowledgement makes the next visit show the
  `+1 newly enlisted` diff.
- No grade/attendance row is created or modified by the confirmation flow.
- Confirmation survives reload and device change (DB-backed).

## Term date scoping (implemented 2026-11-08)

Term selection now also bounds every date axis to the selected term's
startDate..endDate, not just its termId:

- attendance.date.utils.ts - buildDayAxis(start, end), buildSchoolDayAxis(start, end)
  and schoolDaysToDate(start, end) stop at min(Manila today, termEnd) and
  return no days when start > end (a future term shows an empty sheet
  instead of a full one).
- DisplayTerm carries endDate; passed through the attendance sheets, heatmaps
  (section stats / section heatmap / subject pattern / grade heatmap / session
  pattern / summary), advisory attendance and the academics summary.
- teacher/overview-insights.service.ts anchors its day window on
  min(today, termEnd) and never starts before termStart, so a past term does
  not show last-14-days-from-today drift.

The term-scope denominator fix is display-only; no rows are copied.

SF10 adviser access stays permanent per learner (LRN-scoped, year-based):
term selection does not narrow or reset an approved SF10 grant.

Not-yet-started terms show no records: termHasStarted() in
attendance.date.utils.ts gates the student list / advisory roster, so staged or
seeded finals, attendance and anecdotes for a future term render as empty
(no academic grade) until the term's start date.

Reports follow the same rule: for a not-yet-started term the payload keeps
term/teacher/class structure but zeroes averages, assessments, pass/fail,
attendance, finals state, distribution, at-risk and activity.
