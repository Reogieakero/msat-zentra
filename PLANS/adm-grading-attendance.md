# ADM Learners — Grading & Attendance Handling

> Status: **implemented 2026-11-04** (Option B). See §11 for what shipped and what is still open.
> Owner decisions applied 2026-11-04 (§10): no module-based attendance, separate ADM series, exemption only after Principal signature, no GradeFlag special-casing.
> Repo: `msat-zentra` (Zentra). Author: planning pass, 2026-11-04.

---

## 1. Problem statement

Learners with an active ADM case are treated identically to regular learners in two places where they should not be:

| Symptom | Where | Effect |
| --- | --- | --- |
| Auto-absent sweep marks them absent on days they don't physically attend | `backend/src/services/autoAbsent.ts:52` (`sweepAutoAbsent`) | Fake absences accumulate every school day |
| Attendance rate < 80% flag | `backend/src/services/risk.ts:42-48` (`flagsFromParts`) | False "High risk" classification |
| No indication that a learner is an ADM case | `/teacher/grading`, attendance sheets | Teacher scores them as if in-class; nobody knows to grade from modules |

`evaluateRisk` / `evaluateBothRisk` (`risk.ts:145`, `risk.ts:189`) never look at `AdmLearnerProfile`. `riskBoard.service.ts:67` only *tags* cases for display; the flag math is unaffected.

## 2. Policy position (what "correct" actually means)

ADM (Alternative Delivery Mode) is a **delivery mode, not a curriculum**. Under DepEd ADM policy the grading system is unchanged:

- Same `GradeComponent` weights (WW / PT / Exam) per subject + term
- Same DepEd transmutation
- Same `FinalGrade` row per learner / subject / term

The only difference is the **source of evidence** (module outputs and home-visitation work instead of in-class activities). Therefore:

- **Grading must NOT diverge.** Current behavior (identical weights, per-learner scores) is already correct.
- **Attendance must diverge**, because seat-time is the wrong metric for home-based delivery. Engagement should be evidenced by module/submission activity logged on the ADM desk.

> Verify against the capstone panel's spec: if they require "module completion counts as attendance", see §7 Option C.

## 3. Current state (verified)

- `AdmLearnerProfile` (`backend/prisma/schema.prisma:1082`) carries `studentId`, `referralId`, `termId`, `stage` (`AdmStage`), `eligibilityStatus` (`AdmEligibility`), `returnedAt`.
- **No delivery-mode field exists.** `venue` (`school` / `home`) lives only on `AdmParentMeeting` (`schema.prisma:1113+`), so "is this learner home-based right now" cannot be answered from the schema.
- `AttendanceStatus` = `present | absent | late | excused` (`schema.prisma:56`). There is no ADM/self-paced state.
- Grading workspace roster is section-based and ADM-blind: `services/teacher/grading.service.ts:47-61`.
- `autoAbsent` builds roster maps purely from `studentProfile` / `studentRoster` by `sectionId` (`autoAbsent.ts:108-142`).

## 4. Recommended solution — Option B (exemption layer)

### 4.1 Definition of an "ADM-exempt" learner

Derived, no new table/column. A learner is exempt for a given term **only once the Principal has approved and signed the case**. Exemption starts exactly when `principalApprove` succeeds — that transition sets `approvedBy`, `approvedAt` and `stage: enrollment_monitoring` (`services/adm/profiles.progression.service.ts:328`).

```
approvedBy IS NOT NULL
AND stage IN (enrollment_monitoring, completion)
AND termId = <term being evaluated>
AND returnedAt IS NULL          -- principal-returned cases are not active ADM
```

Owner decision (2026-11-04): pre-certification **and** post-certification-but-unsigned learners keep normal attendance. A case sitting at `certification` or `principal_approval` is not exempt yet — the signature is the switch. `principalReturn` clears `approvedBy` and sets `returnedAt` (`profiles.progression.service.ts:398-411`), which automatically revokes the exemption.

Term rollover: `AdmLearnerProfile.termId` is term-scoped. When a learner has no case for the term being evaluated, the helper falls back to the most recent approved case for that learner (stage `enrollment_monitoring`/`completion`, `approvedBy` set) unless a newer non-approved case exists. Flagged in §8 as the one assumption to confirm.

Create one helper in `backend/src/services/adm/`:

```ts
// services/adm/attendancePolicy.ts (new)
export async function admExemptStudentIds(termId: string): Promise<Set<string>>
export async function isAdmExempt(studentId: string, termId: string): Promise<boolean>
```

Both return only `studentId`-based learners (roster-only learners cannot be ADM cases — `AdmLearnerProfile.studentId` is required).

### 4.2 Attendance sweep (`autoAbsent.ts`)

- After loading `profiles`, subtract exempt user IDs from `profilesBySection`.
- Exempt learners then produce **no** synthesized `absent` rows (neither the whole-missing-sheet path nor the unmarked-student backfill path).
- Do **not** rewrite/delete historical rows — the sweep only inserts missing rows, so past fake absences remain. Provide a one-off maintenance script instead (§4.7).
- Return counter should report `exemptSkipped` so the hourly log stays honest.

### 4.3 Risk engine (`risk.ts`)

- In `evaluateRisk` and `evaluateBothRisk`, resolve exemption once per call and pass a new optional input to `flagsFromParts`:
  `attendanceExempt?: boolean` → forces `attendanceFlag = false`.
- Do **not** zero out `attendanceTotal` — that would silently change academic/behavioral math. Only suppress the attendance flag.
- Score/level still computed from academic + behavioral flags, so an ADM learner with a failing average is still flagged (correct).
- `riskRefresh.ts` hourly snapshots pick this up automatically; also recompute on `principalApprove` (exemption granted), `principalReturn` (revoked), and case completion.

### 4.4 Attendance taking (teacher/registrar UI)

- `GET` attendance-roster endpoints: include `admExempt: boolean` per learner.
- Sheet UI: render exempt learners in a separate, visually distinct group ("ADM — home-based"), disabled from present/absent toggles, with a link to the ADM case desk / adviser module board.
- Backend guard: reject `POST` attendance for exempt learners with `409 ADM_EXEMPT_LEARNER` (defense in depth; the UI hides the control but API must enforce).
- Attendance rate/heatmap services: **owner decision (2026-11-04) — report exempt learners as a separate "ADM" series, not excluded from the class denominators.** The class rate keeps its denominator (so a section's rate is not silently inflated by ADM cases); the desk displays "Section rate" and "ADM learners" as two series, with ADM engagement evidenced on the adviser module board instead of seat time. Heatmaps render exempt learners as a distinct band rather than absent cells.

### 4.5 Grading workspace (`services/teacher/grading.service.ts`)

Display-only change — **weights stay shared**:

- Add `isAdm: boolean` (same helper as §4.1, so the chip only lights up on a signed case) plus `admStage` to each learner in `getClassWorkspace`'s `students[]`, via one query: `admLearnerProfile.findMany({ where: { studentId: { in: studentIds } } })`.
- Frontend `/teacher/grading`: ADM chip on the row, subtle helper text near the component weight header: "Weights are shared class-wide. ADM learners are scored from module evidence." No new inputs, no new endpoints, no separate weight editor.
- Optional later: a filter "ADM only".
- **Grade flags: unchanged.** `GradeFlag` logic (`services/gradeFlags.ts`) keeps treating ADM and regular learners identically (owner decision 2026-11-04) — a low grade is a low grade regardless of delivery mode.

### 4.6 Cross-desk visibility

- Risk board: keep existing ADM tag, add "attendance exempt" reason label so the flag suppression is explainable.
- Reports / honor roll: no change (grading untouched). Adviser roster: ADM chip.

### 4.7 One-off cleanup script

`backend/scripts/` (per AGENTS.md convention) — `clear-adm-auto-absents.ts`:

- Finds `absent` rows for newly exempt learners with no teacher-written record — heuristic: rows where the same learner has no `present`/`late`/`excused` record for the same sheet, or rows created by the sweep (if a distinguishing marker exists; otherwise dry-run report first).
- **Dry-run by default**, `--apply` to write. Log counts. Do not touch teacher-entered rows.

## 5. Implementation order

1. `services/adm/attendancePolicy.ts` helper + unit test (predicate over `approvedBy` / stage / `returnedAt` / term, with rollover carry-forward).
2. `autoAbsent.ts` exemption + counter; test with a stubbed prisma.
3. `risk.ts` flag suppression; test both `evaluateRisk` and `evaluateBothRisk` paths.
4. Attendance roster payload `admExempt` + POST guard (backend).
5. Frontend attendance sheet grouping + separate ADM series on the rate views; grading workspace `isAdm` chip.
6. Risk recompute hook on `principalApprove` (grant), `principalReturn` (revoke) and case completion.
7. Cleanup script (dry-run first).

## 6. Testing

- `backend/tests/adm-attendance-exemption.test.ts` (new):
  - exempt: `approvedBy` set + stage `enrollment_monitoring`/`completion`, same term
  - **not** exempt: `pending`/`eligible` at `certification` or `principal_approval` (unsigned), returned cases, other-term cases without carry-forward
  - sweep inserts nothing for exempt learners; risk `attendanceFlag === false` while academic/behavioral flags survive
- `backend/tests/autoAbsent.test.ts` (extend): non-exempt behavior byte-identical.
- `backend/tests/grading.test.ts` (extend): `isAdm` present, weights identical for ADM and non-ADM learners in the same section, `GradeFlag` output unaffected.
- Frontend: typecheck + manual pass on `/teacher/grading` and attendance sheet (grouping + separate ADM series).

## 7. Option C — fully compliant model (schema change, deferred)

If in-school ADM learners must keep normal attendance while home-based ones are exempt, add:

```prisma
enum AdmDeliveryMode {
  in_school
  home_based
  blended
}
// AdmLearnerProfile: deliveryMode AdmDeliveryMode @default(in_school)
```

Consequences: migration (+ RLS review of `AdmLearnerProfile`), `prisma:generate` (committed client regen), coordinator desk input for the mode, and sweep/risk/attendance all keying on `deliveryMode = home_based` instead of the approval predicate.

**Explicitly rejected (owner decision 2026-11-04):** module submissions do **not** count as attendance evidence. `AdmModule` completion stays a progress/oversight signal on the adviser and coordinator desks only; it never feeds `AttendanceRecord`, attendance rates, or the risk attendance flag.

Also considered for C: `attendance` value on `AttendanceStatus` (e.g. `modular`) — rejected for now because it forces every rate query and heatmap to special-case a fifth status; better to keep exemption as a property of the learner, not of a row.

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Exemption widens silently (stage drift) | Single helper, one predicate, unit-tested matrix; log skip counts hourly |
| Historical fake absences remain | Documented cleanup script, dry-run first |
| Learners abuse ADM to dodge attendance | Exemption only after Principal signature (`approvedBy`); returned cases revoke instantly |
| Case signed late in the term | Absences auto-synthesized before the signature stay; cleanup script (§4.7) can clear them per learner, dry-run first |
| Term rollover drops the exemption | Helper carries forward the most recent approved case when no case exists for the new term (confirm with owner, §10) |
| Reports/honor roll regressions | Grading and `GradeFlag` untouched by design; verify no report reads attendance denominators without the separate-series split |
| Risk board looks "wrong" (ADM learner with no attendance flag) | Explicit "attendance exempt" reason on the board |
| CI migrates production DB on `main` push | Option B ships **no migration**, which is a deliberate advantage |

## 9. Files touched (Option B)

Backend
- `src/services/adm/attendancePolicy.ts` (new)
- `src/services/autoAbsent.ts`
- `src/services/risk.ts`
- `src/services/riskRefresh.ts` (recompute hook only)
- `src/services/teacher/grading.service.ts`
- attendance roster/rate services + route guard (`modules/attendance/*`)
- `scripts/clear-adm-auto-absents.ts` (new)
- `tests/adm-attendance-exemption.test.ts` (new)

Frontend
- `src/app/teacher/grading/**` (chip, helper text)
- teacher/registrar attendance sheet components (grouping)
- `src/services/teacher/*.types.ts` (`isAdm`, `admExempt`)

Docs
- `AGENTS.md` §7 gotchas entry + brief note in `docs/architecture/system-architecture.md`

## 10. Owner decisions (resolved 2026-11-04)

1. **Module submissions as attendance evidence — NO.** `AdmModule` work never feeds attendance or the risk attendance flag. It stays an oversight signal only.
2. **Rate denominators — SEPARATE SERIES.** Exempt learners are reported as their own "ADM" series alongside the class rate; denominators are not silently reduced.
3. **Exemption trigger — PRINCIPAL APPROVAL ONLY.** Not pre-certification, not post-certification. A case qualifies when the Principal has approved and signed it (`approvedBy` set, stage `enrollment_monitoring`/`completion`).
4. **Grade flags — NO special treatment.** `GradeFlag` behaves identically for ADM learners.

Remaining item to confirm: term-rollover carry-forward of the approved case (§4.1, §8).

---

## 11. Implementation status (2026-11-04)

### Shipped

| Area | Change | Files |
| --- | --- | --- |
| Policy helper | `isExemptCase` (pure) + `admExemptStudentIds` / `admCaseSnapshot` / `isAdmExempt`; latest case per learner with same-school-year carry-forward | `backend/src/services/adm/attendancePolicy.ts` (new) |
| Auto-absent sweep | Skips exempt learners in both the missing-sheet and backfill paths; returns/logs `exemptLearners` | `backend/src/services/autoAbsent.ts` |
| Risk engine | `attendanceExempt` suppresses only the attendance factor in `flagsFromParts` + `computeRiskFactors`; wired into `evaluateRisk`/`evaluateBothRisk` | `backend/src/services/risk.ts` |
| Risk refresh on transition | `principalApprove` recomputes (grant), `principalReturn` recomputes (revoke) | `backend/src/services/adm/profiles.progression.service.ts` |
| Attendance API guard | Both submit paths reject exempt learners with `409 ADM_EXEMPT_LEARNER` | `backend/src/services/attendance/taking.service.ts` |
| Attendance payloads | `admExempt` on section students + section roster | `backend/src/services/attendance/sections.service.ts` |
| Advisory list | `admExempt` row flag + attendance-factor suppression | `backend/src/services/advisory/students.list.service.ts`, `roster.service.ts` |
| Grading (display only) | `isAdm` / `admStage` on workspace learners; ADM chip in encode table + finals card | `backend/src/services/teacher/grading.service.ts`, frontend grading components |
| Attendance UI | Separate "ADM — home-based" group, excluded from marks/save; roster table shows ADM chip, `—` rate, "Exempt — not marked" | `frontend/.../AttendanceSheet.tsx`, `AttendanceRosterTable.tsx` |
| Cleanup | Dry-run-first script deleting pre-signature synthesized absences | `backend/scripts/clear-adm-auto-absents.ts` |
| Tests | Predicate matrix + risk suppression | `backend/tests/adm-attendance-exemption.test.ts` |

### Still open / follow-up

1. **Separate ADM series on aggregate rate surfaces** — heatmaps, section stats and at-risk boards still render seat-time rates inline. Class denominators are intentionally unchanged (owner decision 2); a dedicated "ADM" series needs a small chart/data slice on those desks.
2. **At-risk list filter** — `attendance/students.service.ts::getAtRiskStudents` still lists exempt learners below 80% (their risk flag is cleared; the raw list is not).
3. **Cleanup script run** — dry-run against the live DB, then `--apply` once confirmed.
4. **Deep link** — the attendance sheet hints at the modules desk but does not link to the learner's ADM case yet.

### Verification

- `backend`: `npm run typecheck` clean; targeted suites (`adm-attendance-exemption`, `risk-factors`, `attendance-engine`, `attendance-subject`, `section-attendance`, `grading`) — 70 passed.
- Full backend suite: 9 failures in `sf10-*`, `term-scope`, `app` — reproduced on a stashed clean tree, so pre-existing and unrelated.
- `frontend`: `npx tsc --noEmit` clean; ESLint on every touched file — 0 errors (5 pre-existing errors in untouched files remain).
