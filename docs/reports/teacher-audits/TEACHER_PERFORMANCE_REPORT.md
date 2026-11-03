# Teacher Role — Performance Audit & Optimization Report

**Project:** E-zentra (Zentra)
**Scope:** Entire Teacher role — frontend, API, database, caching, realtime, skeletons, dialogs
**Date:** October 6, 2026
**Mode:** Audit first, then implement. No rewrites, no redesigns — architecture, business logic, routes, schema, permissions, and styling conventions preserved.

**Verification:** `frontend tsc` clean · `frontend eslint` (teacher scope) 0 errors · `frontend build` clean · `backend typecheck` clean · `backend build` clean · `backend tests` 95/96 (the single failure is an `ocform01` Excel-template test that times out only under full-suite parallel load; it passes 8/8 in isolation and touches none of the changed code paths).

---

## 1. Teacher Pages Audited

All 23 routes under `/teacher/*`, plus the shared shell and infrastructure:

| URL | Source |
|---|---|
| `/teacher/overview` | `frontend/src/app/teacher/overview/page.tsx` (+ 12 `overview/components/*`) |
| `/teacher/overview/students` | `overview/students/page.tsx` + `student-list-data.ts` |
| `/teacher/overview/reports` | `overview/reports/page.tsx` |
| `/teacher/advisory/list` | `advisory/list/page.tsx` |
| `/teacher/advisory/attendance` | `advisory/attendance/page.tsx` + `AdvisoryAttendanceList.tsx` |
| `/teacher/advisory/schedule` | `advisory/schedule/page.tsx` |
| `/teacher/advisory/students` | `advisory/students/page.tsx` + `AdvisoryGradesTable.tsx` |
| `/teacher/advisory/students/[id]/academic` | `[id]/academic/page.tsx` + Academic components |
| `/teacher/advisory/students/[id]/attendance` | `[id]/attendance/page.tsx` + Attendance components |
| `/teacher/advisory/referrals` | `advisory/referrals/page.tsx` (server-paged + debounced) + 10 components |
| `/teacher/advisory/adm-cases` | `advisory/adm-cases/page.tsx` (server-paged) + components |
| `/teacher/classes` | `classes/page.tsx` + `MyTimetable.tsx` et al. |
| `/teacher/grading` | `grading/page.tsx` + `grading-data.ts` |
| `/teacher/grading/[assignmentId]` | `[assignmentId]/page.tsx` + `ClassWorkspace`, `ScoreGrid`, `AssessmentList`, dialogs |
| `/teacher/attendance` | `attendance/page.tsx` + `AttendanceSheet`, `AttendanceRosterTable`, `attendance-taking-data.ts` |
| `/teacher/chat` | `chat/page.tsx` (Suspense) + `Bama*` components |
| `/teacher/anecdotal` | `anecdotal/page.tsx` + Anecdotal components |
| `/teacher/anecdotal/folders`, `/folders/student/[studentId]` | folders pages |
| `/teacher/grade-flags` | `grade-flags/page.tsx` + `FlagHistory`, `RaiseFlag*`, `ResolveFlagDialog` |
| `/teacher/schedule`, `/teacher/schedule/[sectionId]` | schedule pages + `WorkspaceCards`, `ScheduleWeekSetup`, `CatalogCards` |
| `/teacher/settings` | `settings/page.tsx` + `ProfileCard`, `PaletteCard` |

**Shell:** `teacher/layout.tsx` (`TeacherShell`: sidebar, notifications bell, adviser-claim gate, term badge, `useTeacherRealtime()`, `queryClient.clear()` on logout).
**Stack:** TanStack Query (`keepPreviousData`/`placeholderData`, `staleTime` 15–60s) + axios `apiClient` (`x-school-year-id`/`x-term-id` headers, single-flight 401 refresh) + `useSession` + `useTerm` (`termKey = schoolYearId:termId`). Toasts via `sileo`/`toast` (`components/ui/sonner.tsx`, same backend). No `loading.tsx`/`error.tsx` under `teacher/**` — loading is inline skeletons + `aria-busy` shells. No `router.refresh` / `location.reload` anywhere in Teacher code.

---

## 2. Data Flow (verified per desk area)

```text
Page → Component → Hook (termKey-scoped key, keepPreviousData) → apiClient (+term headers)
 → requireAuth → requireRole(subject_teacher, adviser) → teachable/ownership gate
 → batched prisma findMany → JS join / LRN-dedupe / sort → narrow-select payload
 → placeholderData cache → rendered UI (+ sileo toast on mutations)
```

**Backend mounts serving Teacher:** `/api/teacher` (3,258-line `teacher.routes.ts`: overview `?scope=critical|secondary|gradebook|full` cached `ttl:300`, student-list cached, schedule board, claim/verify/grant), `/api/teacher/grading` (workspace + components/preset/assessment CRUD), `/api/teacher/grade-flags` (paginated), `/api/teacher/advisory` (roster, enlist, advisee academic/attendance/anecdotal, marks, drawer, claim), plus `/api/attendance` (`POST /bulk`), `/api/grades` (score upsert, final lock), `/api/anecdotal`, `/api/referrals/mine` (cached), `/api/notifications` (`take:50`, the realtime poll surface).

---

## 3. Critical Problems Found (all fixed)

| ID | Severity | Problem | Fix |
|---|---|---|---|
| C1 | Critical | `useTeacherInvalidate()` + realtime `TEACHER_KEYS` invalidated ~24–28 query prefixes on **every** mutation and **every** realtime event — one attendance save refetched schedule + grading + overview | Scoped invalidators; type-mapped realtime invalidation |
| C2 | Critical | `POST /api/attendance/bulk` (subject + legacy paths): per-record `update/create` awaits, per-student `recomputeRisk` awaits, per-flagged-student `parentStudentLink.findMany` — all inside loops | Single `$transaction`, parallel risk recompute, one batched parent-link query |
| H1 | High | `attendance/page.tsx` rebuilt sorted/grouped `pairs` (O(N²)) and `slotCards` sort/filter on every 60s clock tick and every search keystroke | `useMemo` + Map-based grouping + 250ms debounced search |
| H2 | High | Split/stale query keys: `grade-flags/options` under two keys; `teacher-schedule-subjects/teachers` and `attendance-section-matrix` missing `termKey` | Unified keys, all term-scoped |
| H4 | High | Assessment max-rescale: N per-score updates | Single `$transaction` (refresh was already keyed + parallel) |
| M1 | Medium | `FlagHistory` fired 3×100-row 7-join fetches on mount regardless of tab | Tab-gated queries; advisership via small shared sections query |
| M2 | Medium | Un-debounced search in sheet/score/catalog/list filters | `useMemo` + shared `useDebouncedValue` |
| M3 | Medium | Sequential claim-release loop | `Promise.allSettled` |
| M4 | Medium | Generic skeletons (anecdotal, advisory list, student list, roster table, week setup) | Geometry-matched skeletons |

**Deliberately untouched (already correct):** no full-page reloads; `classDetailKey` teacher+term isolation; `keepPreviousData` back-nav; `markSelfNotified` echo suppression; `requestIdleCallback` prefetch; double-submit guards; `ClassWorkspaceSkeleton` + `attendance-skeleton` (used as conversion templates); weight/preset full-subject recompute (semantically required — weights affect everyone).

---

## 4. API Improvements

- `POST /api/attendance/bulk` (both subject and legacy AM/PM paths): N sequential write round-trips → **one atomic `$transaction`**; N sequential risk recomputes → **`Promise.all`**; N parent-link lookups → **one batched `findMany … WHERE studentId IN […]`**; `records` capped at 300 via zod (class-size bound + abuse cap).
- `GET /api/teacher/grade-flags`: fetch-all-then-slice-in-memory → **real `skip/take` + `count`** (run in parallel), with case-insensitive DB-side `q` across student name, LRN, and subject. Response shape unchanged (`{data, rows, total, unfilteredTotal, summary, page, totalPages, limit, pageSize}`); legacy bare-array shape preserved when no pagination params are sent.
- `PATCH /teacher/grading/assessments/:id` (max rescale): N per-score updates → **one `$transaction`**.
- `GET /api/referrals/mine` **intentionally unchanged**: its sort key (`referredAt`) derives from the audit timeline rather than a column, and `?highlight=` deep-linking requires full ordering; per-teacher queues are small and the endpoint is already server-searched. Changing it would trade correctness for appearance.

## 5. Database Improvements

- Write batching above: one round-trip per attendance sheet instead of N (atomic as a bonus).
- **No new indexes added — verified unnecessary.** The schema already covers every hot path: `AttendanceRecord (sectionId,subjectId,termId)`, `(studentId,termId)`, uniques on `(studentId|rosterId, subjectId, date, slot)`; `StudentGrade` uniques on `(assessmentId, studentId|rosterId)`; `FinalGrade` uniques + `(studentId,termId)`; `GradeFlag (status,ownerId)`, `(raisedBy)`, `(studentId)`.

## 6. Caching Improvements

- **Scoped invalidation** (`frontend/src/app/teacher/components/use-teacher-invalidate.ts`): `marks / grading / schedule / overview / referrals / advisory / anecdotal / flags / settings` (+ `all` reserved for logout-type resets). All 16 mutation call sites migrated to their scope; every scope still bumps `["teacher-notifications"]` so the bell badge stays live.
- **Scoped realtime** (`frontend/src/lib/realtime/teacherChannel.ts`): `Notification.sourceTable/type` → minimal affected prefixes (attendance → marks keys; score/final-grade → grading keys; timetable/teacher → schedule keys; referral → referral keys; anecdotal → anecdotal keys; roster/intervention → advisory keys; grade-flag → flags). Unknown events invalidate nothing but the bell badge. The 2s throttle, `seenIds` dedupe, `markSelfNotified` suppression, 5s poll transport (required — the anon Supabase client cannot receive row-scoped events), `document.hidden` skip, and focus repoll are unchanged.
- **Key normalization:** `["grade-flags","options",termKey]` unified; `termKey` added to `teacher-schedule-subjects`, `teacher-schedule-teachers`, and both `attendance-section-matrix` consumers. Prefix invalidation still matches; one-time cache bust is expected and safe.
- Term/user/role isolation preserved on every key (`teacherId`, `termKey`); `queryClient.clear()` on logout untouched.

## 7. Mutation Improvements

- Academic-record policy applied throughout: **per-row/cell spinner + `Saving…` button state, no optimistic flip** — `sileo.success` only after server confirmation, prior state + `sileo.error` on failure.
- Missing `if (saving) return` guards added to `ScoreGrid.handleSaveAll`, `WeightsDialog.handleSave`, `AddAssessmentDialog.handleSave` (previously `disabled`-only, double-Enter could double-fire).
- Every Teacher dialog now locks via CardModal `dismissable={!pending}` (Escape / overlay / X all disabled mid-flight).

## 8. Skeleton Improvements (position · width · height · spacing · structure verified per page)

| Page | Before | After |
|---|---|---|
| Anecdotal repo | Generic centered 3-line pulse | Wired the existing-but-unused `skelPanel/skelFolderGrid/skelCard` CSS: same grid (`1fr + 17rem` rail), panel header + search + 6 folder cards, rail summary cards, responsive collapse |
| Advisory list | 5× generic `h-10` rows | Same card + header/filter widths, 4 real columns (Student 220 two-line / Risk 130 / Factors 180 / Section 140), 8 rows, pager footer |
| Student list | 2× generic blocks | Same heading + rail grid: table card (Student / Attendance / Academic Grade, badge-pair rows), section-rail cards |
| Roster table | 5× generic `h-10` rows | Same card + filter/Blocks/Save header, 4 columns (Student 220 / Attendance 100 / Status 180 boxes / Meetups 360 dot strip), 8 rows |
| Week setup | Generic `h-8 + h-72 + pills` | Same bordered table: time gutter + 5 day columns, 8 `min-h-14` rows |
| Gradebook workspace, attendance sheet/rail, flag-history board, overview | Already geometry-matched | Untouched (used as templates) |

Cached-data rule holds everywhere: skeleton only when `isPending` with no data; cached data renders instantly with background revalidation (existing `placeholderData`/`keepPreviousData` pattern extended, never regressed).

## 9. Dialog → CardModal Conversion (28 files, ~35 instances)

All `Dialog`/`AlertDialog` usage under `teacher/**` converted to the shared `CardModal` (`components/ui/CardModal.tsx` — `null` when closed, body-scroll lock, Escape + overlay-click, `dismissable` flight lock, `watchKey` scroll-hint refresh), following the in-repo precedents (`AdviserClaimGate`, `BamaFlowDialogs`, coordinator confirm dialogs):

- **Confirms:** `SubmitConfirmDialog`, `AttendanceSheet` edit-confirm, `AttendanceRosterTable` save, `ScoreGrid` empty/range notices, `AssessmentList` delete, `ReferralDeleteDialog`, `BamaChat` delete-chat, `MyTimetable` leave-term, `schedule/page` clear-all.
- **Forms:** `AddAssessmentDialog`, `WeightsDialog`, `SlotEntryDialog`, `ScheduleConfigDialog`, `CatalogCards` ×4 (add-teacher, add-subject, subject list, teacher list), `ScheduleWeekSetup` ×3 (note, unlock, clear), advisory enlist, `ReferralCancelDialog`, `ReferralComposer` choice, `RaiseFlagDialog`, `ResolveFlagDialog`.
- **Readers:** `ReferralTrackDialog`, `ReferralStepDialog`, `FlagDetailDialog`, `AllAssessmentsDialog`, `ClassDetailDialog`, `AnecdotalComposer`, `AnecdotalDetail`.

Mapping: `DialogTitle/Description` → `title/description` props, `sm:max-w-sm` → `size="sm"`, `sm:max-w-md`/default → `size="md"`, tall readers → `size="lg"`/scroll body, footers → right-aligned action rows, `onOpenChange`-pending locks → `dismissable={!pending}`. Overlay-only `.dialog` width classes retired in 7 CSS modules. Zero `Dialog*`/`AlertDialog*` imports remain under `teacher/**`. Side benefit: closed modals now render `null` (no hidden dialog DOM × ~35 instances). No copy, validation, or behavior changes.

## 10. Realtime Improvements

- Per-event scoped invalidation (Section 6) replaces the blanket 28-prefix refetch; the 2s burst throttle, toast-per-row semantics, and echo suppression are unchanged.
- Poll transport kept at 5s by necessity (documented anon-client constraint) with hidden-tab skip and focus repoll.

## 11. Before / After (architectural deltas)

| Surface | Before | After |
|---|---|---|
| Any Teacher mutation | ~24–28 prefix refetches | 1 scope (≤6 prefixes) + bell badge |
| Realtime event | Full-desk refetch (throttled 2s) | Affected scope only (≤7 prefixes) |
| Attendance submit (60 students) | ~60 sequential writes + ~60 sequential risk recomputes + K parent queries | 1 transaction + 1 parallel recompute + 1 parent query |
| Grade-flag board mount | 3 × up-to-100-row 7-join fetches | Visible tab only (+ tiny shared sections probe) |
| Assessment max-rescale (60 scores) | N updates | 1 transaction |
| Attendance rail | Sort + filter rebuilt per tick/keystroke | Memoized; search debounced 250ms |
| 26 dialog files | Radix Dialog/AlertDialog trees | Single CardModal overlay; `null` when closed |
| 5 skeleton surfaces | Generic pulses/rows | Geometry-matched layouts |

No timing numbers are claimed — improvements are structural (request counts, query counts, payload bounds, render frequency).

## 12. Remaining Bottlenecks (honest)

1. First-visit overview/schedule-board payloads stay large until those endpoints get DB pagination + select trimming (mitigated by `scope=` + 300s Redis cache).
2. 90-dot roster blocks (~5k spans at 60×90) are unvirtualized — acceptable at current page sizes; `@tanstack/virtual` only if sections exceed ~200 rows (deliberately deferred, package not installed).
3. ≤5s realtime latency is inherent to the poll transport; focus-repoll covers the tab-away case.

## 13. Validation

- `frontend`: `npx tsc --noEmit` clean · `npx eslint src/app/teacher src/lib/realtime/teacherChannel.ts` 0 errors · `npm run build` clean (all 23 teacher routes emit).
- `backend`: `npm run typecheck` clean · `npm run build` clean · `npm test` 95/96 (single `ocform01` timeout under parallel load only; 8/8 in isolation; unrelated paths).
- Manual checks recommended on review: Overview → Attendance → Grading → Advisory → Student → Back navigation; term switch; logout/login cache isolation; dialog open/close/Escape/pending-lock on each converted modal.

## 14. Files Changed (session)

**Frontend:** `use-teacher-invalidate.ts` (scoped API) · `teacherChannel.ts` (scoped realtime) · `attendance/page.tsx` (memo + debounce) · `AttendanceSheet.tsx` (memo + CardModal) · `AttendanceRosterTable.tsx` (scoped invalidate + CardModal + skeleton) · `SubmitConfirmDialog.tsx` · `ScoreGrid.tsx` (guards + CardModals) · `WeightsDialog.tsx` · `AddAssessmentDialog.tsx` · `AssessmentList.tsx` · `AllAssessmentsDialog.tsx` (+css) · `ClassDetailDialog.tsx` (+css) · `MyTimetable.tsx` · `CatalogCards.tsx` (keys + CardModals + memo) · `CopiedSlotCard.tsx` (keys) · `ScheduleWeekSetup.tsx` (keys + CardModals + skeleton) · `SlotEntryDialog.tsx` · `ScheduleConfigDialog.tsx` · `schedule/page.tsx` · `advisory/list/page.tsx` (scoped invalidate + CardModal + skeleton) · `AdvisoryAttendanceList.tsx` (keys) · `teacher-overview-attendance-table.tsx` (keys) · `ReferralActionDialogs.tsx` · `ReferralComposer.tsx` (+css) · `ReferralStepDialog.tsx` (+css) · `ReferralTrackDialog.tsx` · `ReferStudentCard.tsx` · `use-reopen-referral.ts` · `referrals/page.tsx` · `BamaChat.tsx` · `AnecdotalChat.tsx` (keys) · `AnecdotalDetail.tsx` (+css) · `AnecdotalComposer.tsx` (+css) · `anecdotal/page.tsx` (skeleton) · `FlagHistory.tsx` (gating + probe + scoped invalidate) · `FlagDetailDialog.tsx` (+css) · `RaiseFlagChat.tsx` (keys) · `RaiseFlagDialog.tsx` (+css) · `ResolveFlagDialog.tsx` (+css) · `overview/students/page.tsx` (skeleton) · `settings/page.tsx` (parallel releases) · `ProfileCard.tsx` · `PaletteCard.tsx`.
**Backend:** `attendance.routes.ts` (batched bulk ×2 paths, records cap) · `grade-flags.routes.ts` (DB pagination) · `grading.routes.ts` (batched rescale).

---

*End of report.*
