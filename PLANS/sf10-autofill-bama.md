# Plan — SF10 Auto-fill in Bama Chat

> Status: planning. No code written yet.
> Goal: let an adviser fill a learner's SF10 subject rows from **adviser-approved finals** through the Bama chat, without uploading/re-scanning the SF10.

## 1. Confirmed decisions

| Decision | Choice |
|---|---|
| Who can run it | Adviser with an approved SF10 access grant for the section |
| Grade source | `FinalGrade.lockStatus = "adviser_approved"` only |
| Fill scope | Merge into the **current grade level** rows; keep prior years and add-ons |
| Term → quarter mapping | Q1–Q3 = Terms 1–3, Q4 blank; subject rating = mean of the 3 terms |

## 2. Current state (verified)

- Bama lives at `/teacher/chat` and is **adviser-only** (`frontend/src/app/teacher/chat/page.tsx`).
- Chat types today: `grade-flag`, `anecdotal`, `sf10-access` (`bama-conversations.ts`).
- The SF10 Access flow only **requests read access** (`useSf10AccessFlow.ts`).
- SF10 subjects live in `Sf10Record.ocrExtractedData.subjects` as:
  ```ts
  { rawName, norm, grade, rating, gradeLevel, quarters[4], semFinals?, remarks }
  ```
- Every SF10 write already appends a `Sf10RecordVersion` and an audit row through `storeOcrPayload` (`backend/src/services/sf10/records.service.ts`).
- `Sf10Source.auto_populated` already exists and `PLAN.md §7` says SF10 should be "auto-populated from `final_grades`/`attendance_records` where overlapping".
- Grades are per term (trimester, 3/year); SF10 expects 4 quarters. This plan fills Q1–Q3 and leaves Q4 blank.
- `FinalGrade` rows can hang off `studentId` **or** `rosterId` (dual-identity), so the query must cover both.

## 3. UX flow

New chat type `"sf10-autofill"` ("SF10 Auto-fill").

### Starter
Add a starter card on the Bama welcome board:

- Title: **SF10 Auto-fill**
- Description: “Fill SF10 from your approved grades”
- Accent: reuse the SF10 blue (`FolderOpen` icon)

Also add it to the history sidebar meta, `BAMA_CHAT_TYPES`, `TYPE_LABELS`, `GREETINGS`, and `FREE_FOLLOWUPS`.

### Guided phases (same shell as `useSf10AccessFlow`)

1. **Section** — advisory section picker; auto-advance when the adviser has a single section.
2. **Students** — advisees that have an SF10 record and a grant.
   - Each card shows `subjects ready` (e.g. “6 subjects · 3/3 terms”).
   - Disabled states with plain reasons: `No SF10 record`, `Access not yet approved`, `Record already released`, `Roster-only learner`.
3. **Preview** — per-student table:
   - Subject, Q1, Q2, Q3, final rating, action (`add` / `update`).
   - Skipped subjects listed with reason (`2/3 terms approved`, `no grades`).
   - Header shows the school year being written.
4. **Submit** — dock task (`kind: "sf10-autofill"`), then a result card:
   - `Updated N · Skipped M · Failed F`
   - Per-student breakdown.
   - Link to `/teacher/advisory/sf10-access`.

State is snapshotted per conversation in `localStorage`, following `useSf10AccessFlow` (`zentra.bama.sf10-autofill.v1`).

## 4. Backend

### Routes

New file `backend/src/modules/teacher/sf10-autofill.routes.ts`, mounted from `advisory.routes.ts` (or appended to `sf10-access.routes.ts`).

All routes:

- `requireAuth`
- `requireRole(...TEACHER_ROLES)`
- Section ownership: `section.adviserId === req.user.id` (same as `createAccessRequest`)
- GETs cached with `CACHE_TAGS.teacher` / `"adviser-access"` and `CACHE_TTLS.list`

| Method & path | Purpose |
|---|---|
| `GET /api/teacher/advisory/sf10-autofill/candidates?sectionId=` | Advisees with a fillable record + per-student counts/skip reasons |
| `GET /api/teacher/advisory/sf10-autofill/preview?sectionId=&studentLrns=` | Computed rows and skip reasons; no writes |
| `POST /api/teacher/advisory/sf10-autofill` | Execute `{ sectionId, studentLrns }`; returns `{ updated, skipped, failed, results[] }` |

POST invalidates the registry/teacher SF10 cache tags (`registrar`, `registrar-sf10`, `registrar-overview`, `record-keeper`, `record-keeper-overview`, `teacher`, `adviser-access`, `overview`, `principal`) and the teacher query keys on the client.

### Service

New file `backend/src/services/advisory/sf10-autofill.service.ts`.

1. Resolve section and validate the adviser owns it.
2. Validate each LRN belongs to the section (export/reuse `sectionLrns` from `sf10-access.service.ts`).
3. Per LRN:
   - Resolve `StudentProfile` (roster-only learners are skipped).
   - Find the `Sf10Record` matching the learner's grade band:
     - G7–G10 → `record_keeper`
     - G11–G12 → `registrar`
   - Enforce the adviser SF10 grant.
4. Load `FinalGrade` for the **active school year** (server-resolved, not the teacher term scope):
   - `lockStatus = "adviser_approved"`
   - `(studentId = profile.userId OR rosterId = current roster row)`
   - include `subject` and `term.termNumber`
5. Group by subject. Require **all 3 terms approved**; partial subjects become “skipped: n/3 terms”.
6. Build SF10 rows:
   - `rawName = subject.name`
   - `norm = normalizeSubjectName(subject.name)`
   - `gradeLevel = student.gradeLevel`
   - `quarters = [t1, t2, t3, null]`
   - `rating = round(mean of the three)`
   - values use `transmutedGrade`, fallback `computedAverage`
   - `remarks = rating >= 75 ? "PASSED" : "FAILED"`
   - `grade = rating`
7. Merge into `ocrExtractedData`:
   - Keep every prior row whose `gradeLevel` differs (prior years).
   - Keep untagged rows (add-ons).
   - Replace current-grade rows whose `norm` matches an auto row.
   - Append subjects that are not yet present.
   - Preserve `learner`.
   - Set `confidence: 1`, `engine: "grading-auto-fill-v1"`, `ocrStatus: "ready"`, `needsReview: false`.
8. Write with `storeOcrPayload` so the version + audit trail stays automatic:
   - Reason: `"SF10 auto-filled from adviser-approved finals"`.
   - Do **not** change `Sf10Record.source`.
9. Status handling:
   - Skip `released` records.
   - For `available` (verified) records, clear `verifiedBy` / `verifiedAt` so the records desk re-verifies, and notify that desk.

## 5. Guardrails

- **No record creation.** Learners without an SF10 record are listed as skipped; the records desk owns record creation.
- **Only `adviser_approved` grades.** `unlocked` and `locked` never feed the SF10.
- **Active school year only.** The preview shows the school year explicitly.
- **No free-form editing in Bama.** Manual corrections stay on `PATCH /api/sf10/:id/ocr`.
- **Grant mismatch to fix:** `assertAdviserSf10Access` today only accepts a whole-request `approved` status, while the SF10 Access UI also grants per-student LRNs and exposes `canEdit`. Extend the helper to accept an LRN in `approvedLrns` so Bama writes and the existing edit path agree. This is the security-adjacent shared change — flag it in review.
- Audit action reuses `sf10_update`; no schema migration needed.

## 6. Files

### Frontend

- `frontend/src/app/teacher/chat/components/bama-conversations.ts` — new type + message card fields
- `frontend/src/app/teacher/chat/components/useSf10AutofillFlow.ts` — new hook
- `frontend/src/app/teacher/chat/components/BamaChat.tsx` — greeting, labels, submit handlers
- `frontend/src/app/teacher/chat/components/BamaThread.tsx` — starter card, pickers, preview card
- `frontend/src/app/teacher/chat/components/BamaSidebar.tsx` — type meta
- `frontend/src/app/teacher/chat/components/BamaSubmitDock.tsx` — submit labels if needed
- `frontend/src/services/teacher/sf10Autofill.service.ts` — fetchers + hooks
- `frontend/src/components/dock/dock-types.ts` — add `"sf10-autofill"`

### Backend

- `backend/src/modules/teacher/sf10-autofill.routes.ts` (new) + mount in `advisory.routes.ts`
- `backend/src/services/advisory/sf10-autofill.service.ts` (new)
- `backend/src/services/advisory/sf10-access.service.ts` — export section/LRN helper
- `backend/src/modules/sf10/sf10.repository.ts` — per-LRN grant in `assertAdviserSf10Access`
- `backend/src/services/sf10/records.service.ts` — expose the payload writer for reuse

## 7. Tests

- `backend/tests/sf10-autofill.test.ts` — pure helpers:
  - term → quarter mapping
  - average + remarks
  - complete vs partial subject filter
  - merge preserves other grade levels and add-ons
- Route test for ownership/grant denial where practical (live-DB tests in this repo).
- Frontend: `npx tsc --noEmit -p tsconfig.json` + lint only (no e2e suite).

## 8. Open risk

- **Partial subjects.** Default is to write a subject only when all 3 terms are `adviser_approved`. Relaxing to “1+ terms” would fill earlier but should mark those rows `needsReview: true`.
