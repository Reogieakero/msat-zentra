# Wire Registrar Overview to Real Backend (remove all mock data)

## Goal
The `/registrar/overview` page currently renders 100% static mock data from
`frontend/src/app/registrar/overview/components/data.ts`. Replace it with live
data from a new backend endpoint. Remove all mock constants/files and the
"MOCK" UI tags. Keep the frontend display consistent with what the backend returns.

## Backend: new registrar overview endpoint
Add `backend/src/modules/registrar/registrar.routes.ts` exporting a router, mount at
`/api/registrar` in `backend/src/app.ts`. Single `GET /overview` route:

- `requireAuth`, `requireRole("registrar", "record_keeper")` (record_keeper shares 11-12 authority per gradeBand.ts but overview is registrar-scoped; allow both for parity with sf10).

Compute live (G11–12 only, matching registrar authority):
- `pendingAccounts`: `user.count({ where: { status: "pending", role: { in: [...] } } })` — keep simple: count of pending users. (Registrar reviews account approvals.)
- `pendingAdviserAccess`: advisers with `status: "pending"` → `staffProfile` joined to `user` where `isAdviser: true && user.status: "pending"`. (No dedicated "access request" model exists; this is the real source of adviser accounts awaiting activation.)
- `lockedFinalsAwaiting`: `finalGrade.count({ where: { lockStatus: "locked", student: { gradeLevel: { in: ["G11","G12"] } } } })` awaiting registrar approval (see grades.routes registrar-approve).
- `sf10Released`: count of `sf10Record` where `status: "released"` and student gradeLevel G11–12.
- `sections`: `section.count({ where: { gradeLevel: { in: ["G11","G12"] }, schoolYear: { isActive: true } } })`.
- `subjects`: `subject.count({ where: { gradeLevel: { in: ["G11","G12"] } } })`.
- `reportCards`: count of `finalGrade` rows for G11–12 students (one row ≈ one report-card subject entry). Define clearly in response comment.
- `latestAttachments[]`: recent `sf10Record` with `status: "attach"` (G11–12), ordered by `validatedAt`/`updatedAt` desc, take 5 → `{ student: user.fullName, lrn, grade: gradeLabel, when: <ISO timestamp> }`. Frontend formats relative time.
- `missingSf10[]`: students G11–12 with no sf10Record OR record status missing → `{ student, lrn, grade }`. Derive as students without a released/available/attach record.
- `pendingStudents[]`: students G11–12 whose `user.status === "pending"` (newly enrolled awaiting approval) → `{ name: user.fullName, lrn, grade: gradeLabel, parent: first linked parent fullName or "—" }`.
- `sf10Students[]`: students G11–12 who have an sf10Record (any status), take 5 → `{ name, lrn, grade }`.

Return shape MUST match the existing `RegistrarOverviewData` type exactly
(field names + types) so the frontend only swaps the data source.

## Frontend changes
1. `frontend/src/app/registrar/overview/components/data.ts`:
   - Keep the `type` definitions (RegistrarOverviewData + sub-types).
   - DELETE the `MOCK` constant. Add `when` as ISO string in Sf10Attach type (already string; will hold ISO).
2. `page.tsx`: replace `const m = MOCK` with `useEffect` + `apiClient.get<RegistrarOverviewData>("/api/registrar/overview")`, following the principal overview pattern (loading + error states). Add `loading`/empty fallbacks (counts 0, empty arrays) so no crash before load.
3. Components: remove `MOCK` tags in `AcademicsKpis.tsx:20` and `AttentionPanel.tsx:27`. Add a relative-time formatter for `latestAttachments[].when` (ISO → "2m ago" style) so the display stays consistent.
4. Verify all components consume only fields present in the real payload (they already do — same type).

## Consistency checks
- Every number shown comes from the same query family, no double-counting.
- `missingSf10.length` (AttentionPanel) equals the backend missing count — use the array length, not a separate number, so the two panels never disagree.
- `lockedFinalsAwaiting` KPI and AttentionPanel value both read the same field from one payload.

## Verification
- Start backend + frontend (npm run dev in each), log in as registrar@zentra.test.
- Hit `GET /api/registrar/overview` and confirm real numbers + lists.
- Load `/registrar/overview` — no MOCK tags, no console errors, values match API.
