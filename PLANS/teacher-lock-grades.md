# Teacher — Lock Grades (single page, two modes)

## Goal

Give subject teachers one place to lock final grades for the classes they
actually teach, and give advisers a read-only view of their advisees' subject
lock statuses — on **one** page, not two.

No grade approval UI. Approvals remain registrar/record-keeper terrain.

## Route

`/teacher/lock-grades` → sidebar **Workspace → Lock Grades** (below Gradebook).

- Subject teacher only → **My Classes** mode.
- Adviser only → **My Advisees** mode.
- Both → tabs “My Classes” / “My Advisees”.
- Neither → empty card.

## Mode A — My Classes (write)

- Only timetable-linked subject × section classes, gated exactly like the
  gradebook: teacher code linked + active term entered (`TeacherTermGrant`).
- Gate cards mirror `/teacher/grading` (“Link code” / “Enter term”).
- KPI strip: Classes · Learners · Ready to lock · Locked · Approved.
- One card per class: subject, section, grade level, learner count, segmented
  progress bar (ready / locked / approved), **Lock grades (n)**.
- Expanding a class loads its learners through the existing
  `GET /api/teacher/grading/classes/:assignmentId` (`useClassDetail`) and shows
  computed, transmuted, remarks, status, plus a per-learner **Lock** action.
- Bulk lock reuses `LockGradesButton` + `LockGradesModal` (teacher code) and
  the shared lock dock.
- Locking reuses:
  - `POST /api/grades/final-grades/lock-batch`
  - `POST /api/grades/final-grades/:id/lock`
- Adviser-only teachers see this mode empty (they teach nothing).

## Mode B — My Advisees (read-only)

- Lists the adviser's advisory-section learners, including roster-only
  advisees (`roster:<id>`).
- Section picker when the adviser has more than one advisory section.
- Each advisee shows every subject in the section with computed / transmuted
  grade and lock status:
  - `Unlocked` — waiting for the subject teacher
  - `Locked` — locked, awaiting adviser approval
  - `Adviser approved`
- Applies the same student-data-sharing visibility rules as the advisory
  academic detail (`resolveGradeOwnerIds` → `sharingMap` →
  `canBypassSharing`); hidden subjects render as hidden.
- **No Lock, no Approve** buttons in this mode.

## Backend

One endpoint:

`GET /api/teacher/lock-grades?view=classes|advisees`

- Teacher roles only (`subject_teacher`, `adviser`), term-scoped.
- `classes` → `gates { linked, termGrant }`, `isSubjectTeacher`,
  `isAdviser`, and class summary rows:
  `{ id, subjectId, subject, subjectCode, sectionId, section, gradeLevel,
  learners, computed, ready, locked, approved }`.
  `ready` = unlocked with a computed average.
- `advisees` → advisory sections and advisee rows:
  `{ studentId, name, lrn, section, sectionId, hasAccount, subjects[],
  summary }` where each subject carries
  `{ subject, subjectId, computedAverage, transmutedGrade, remarks,
  lockStatus, hiddenByTeacher? }`.
- Cache tags `teacher` + `grades`, dashboard TTL, ETag.
- No schema change, no new lock endpoint.

New files: `backend/src/services/teacher/lockGrades.service.ts`,
`backend/src/modules/teacher/lock-grades.routes.ts`, query schema in
`teacher.schemas.ts`, mount in `teacher.routes.ts`.

## Frontend

- `frontend/src/services/teacher/lockGrades.service.ts` — types + query hooks.
- `frontend/src/app/teacher/lock-grades/page.tsx` + `components/` (board,
  class card, learner rows, advisee card, skeleton, CSS module).
- Sidebar nav item + `NAV_ICONS.lockGrades` (`Lock`).
- Breadcrumb workspace label `/teacher/lock-grades → Workspace`.
- Register `["teacher-lock-grades"]` in `teacherKeys.ts` under `grading`, and
  invalidate it from `LockGradesButton` after a bulk lock (optional
  `onLocked` callback).
- Locks invalidate `teacher-lock-grades`, advisory and gradebook caches, and
  the existing realtime `grade_locked` scope already refreshes grading.

## Edge cases / guards

- Adviser who also teaches: both tabs; the advisee side stays read-only.
- Adviser cannot lock subjects they do not teach — the API ownership check
  (`assertAssignment`) still applies; Mode B exposes no lock action at all.
- No link code / term not entered → gate card, no class data.
- Zero learners / zero computed grades → “Nothing ready to lock yet”.
- ADM learners and regular learners follow the existing finals rows unchanged.

## Verification

- Backend: `npm run typecheck`, targeted tests.
- Frontend: `npx tsc --noEmit -p tsconfig.json`, `npm run lint`, `npm run build`.
