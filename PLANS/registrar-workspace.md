# Plan: Registrar Workspace (frontend + required backend)

> Updated to reflect the full registrar functional requirements and transaction spec provided by the user,
> plus a backend gap analysis. Supersedes the earlier registrar-workspace.md scope.

## Context (carry forward)
- Stack: Next.js 16 (App Router, Turbopack), Tailwind + shadcn/ui, React 19, axios (`apiClient`).
- Design language: stone-50 `#FAFAF9` bg, 1px stone-200 borders, ONE brand accent (school deep green `oklch(0.45 0.09 150)`), `rounded-md`, border-over-shadow, fluid bg on auth/error surfaces, 8px grid, `prefers-reduced-motion`.
- Roles (`frontend/src/lib/auth/roles.ts`): `registrar` = "Registrar", grade band **11–12**. No `app/registrar` folder exists yet (only `app/{errors,login,principal}`).
- Registrar is a **transactional validation / records-custody** role for grades 11–12 ONLY. It is NOT oversight (that's Principal) and NOT grade encoding (that's Adviser/Subject Teacher).

## Functional requirements (user-provided — source of truth)
The system shall allow the registrar/record keeper to:
1. Receive locked final grades and manage student records.
2. Upload and extract SF10 records using OCR technology.
3. Validate and manage digitized SF10 records submitted by teachers.
4. Configure academic year and user roles. *(See contradiction below — registrar does NOT set school year/grading periods per the transaction spec.)*

### Transaction spec — "9. Registrar"
**How they get an account:** Set up directly by the school (fixed login). Seed exists: `registrar@zentra.test` / `Zentra2025!`.

**What they see on their page:**
- New account requests from Grade 11–12 students and their parents, waiting for approval.
- Locked grades for Grade 11–12 students.
- Pending adviser access requests waiting for a decision (Grade 11–12 advisers).

**What they can do:**
- Approve or reject Grade 11–12 student sign-ups, and the linked parent account in the same step.
- Assign teachers to Grade 11–12 classes.
- Create sections and subjects for Grade 11–12 (matching the 11–12 grade-band split).
- Manage Grade 11–12 report cards.
- Scan and digitize paper report cards into the system.
- Approve or deny an Adviser's request for extra access to their advisees' full records (Grade 11–12 advisers).
- Set up the school year and grading periods — incl. all status transitions (upcoming → active → completed). *(CONTRADICTED — see below.)*

**What they CAN'T see:**
- The Grade 7–10 approval queue.
- Private counseling / health / ADM notes.
- School year / grading-period setup — **that's Principal-only.**

## Critical contradictions resolved
1. **School year / grading periods:** The transaction spec lists "Set up the school year and grading periods" under registrar *can do*, but the clarifying note explicitly says *"The Registrar has no role in setting up the school year or grading periods — that's Principal-only"*. **Resolution: registrar gets NO school-year/grading-period UI.** Principal owns it. This is enforced.
2. **"Lock grades for Grade 11–12":** Backend `POST /api/grades/final-grades/:id/lock` is `adviser`-only. Registrar cannot raw-lock. **Resolution:** registrar's "locked grades" view = list of finals in `locked` status (11–12) awaiting registrar **approval** (`registrar-approve`). The registrar *action* is approve/validate, not lock. The "lock" wording in the spec is interpreted as "see locked finals + approve them."
3. **OCR upload role:** Backend `POST /api/sf10/upload` and `GET /api/sf10/ocr/:jobId` are `adviser`-only. Registrar spec says "Upload and extract SF10 records using OCR." **Resolution:** registrar surfaces an OCR upload/extract UI; backend guard for `upload`/`ocr` must be widened to include `registrar` (see Backend section B1). Registrar then validates/releases.

## Backend gap analysis (what exists vs. what's needed)
| Capability | Endpoint | Status |
|---|---|---|
| Approve pending user (student/parent) | `POST /api/auth/approve/:userId` (`record_keeper, registrar`, grade-band guarded) | ✅ exists (`auth.routes.ts:106`) |
| List pending account requests (G11–12) | none | ❌ add `GET /api/auth/pending` |
| Approve student + linked parent in one step | only single-user approve | ⚠️ add batch `POST /api/auth/approve-batch` |
| Approve/deny adviser extra-access request | none | ❌ add `adviser-access` routes |
| Assign teachers to G11–12 classes | none | ❌ add `academics/assign` |
| Create sections (G11–12) | none | ❌ add `academics/sections` |
| Create subjects (G11–12) | none | ❌ add `academics/subjects` |
| Manage / scan G11–12 report cards | none | ❌ add `report-cards` module |
| Lock grades (raw) | `POST /api/grades/final-grades/:id/lock` (`adviser` only) | 🚫 registrar excluded by design |
| Approve locked finals (11–12) | `POST /api/grades/final-grades/:id/registrar-approve` | ✅ exists (`grades.routes.ts:102`) |
| List final grades (read) | `GET /api/grades/students/:id/final-grades` (registrar allowed) | ✅ exists |
| SF10 summary (read) | `GET /api/sf10/summary` | ✅ exists |
| SF10 OCR upload | `POST /api/sf10/upload` (`adviser` only) | ⚠️ widen to registrar (B1) |
| SF10 OCR extract get | `GET /api/sf10/ocr/:jobId` (`adviser` only) | ⚠️ widen to registrar (B1) |
| SF10 validate | `POST /api/sf10/:id/validate` (`record_keeper, registrar`) | ✅ exists |
| SF10 release | `POST /api/sf10/:id/release` (`record_keeper, registrar`) | ✅ exists |

## Goal
Build a complete Registrar workspace that mirrors the Principal shell (sidebar, topbar, account menu, grade-basis toggle, fluid/brand styling) and surfaces EVERY transaction in the spec, wiring to existing endpoints and adding the missing backend routes listed below.

## Scope

### A. Frontend — `frontend/src/app/registrar/`
1. **`layout.tsx`** — clone `principal/layout.tsx` shell (SidebarProvider + GradeModeProvider + account menu). Create `frontend/src/components/registrar-sidebar.tsx` mirroring `staff-sidebar.tsx` with Registrar nav (below).
2. **`page.tsx` (Dashboard / Overview)** — registrar home:
   - "Action Required" panel: pending G11–12 account requests count + pending adviser-access requests count, linking to respective pages.
   - SF10 summary cards (G11–12: attach/available/missing/released) via `GET /api/sf10/summary`.
   - KPI: # locked finals awaiting approval (11–12), # SF10 records missing/released.
3. **`final-grades/page.tsx` (Final Grade Approvals)** — core action:
   - List locked final grades band 11–12 awaiting registrar approval.
   - Table: LRN, name, subject, term, computed avg, transmuted, status.
   - Row action **Approve** → `POST /api/grades/final-grades/:id/registrar-approve` (confirm via `AlertDialog`); optimistic update + `sonner` toast.
4. **`accounts/page.tsx` (Account Approvals)** — NEW:
   - List pending G11–12 student + linked parent sign-ups via `GET /api/auth/pending`.
   - Approve (student + parent same step) → `POST /api/auth/approve-batch`; Reject → `POST /api/auth/reject/:userId` (or batch). Honor grade band 11–12.
5. **`adviser-access/page.tsx` (Adviser Access Requests)** — NEW:
   - List pending G11–12 adviser extra-access requests; Approve/Deny → `adviser-access` routes.
6. **`academics/page.tsx` (Sections & Subjects)** — NEW:
   - Create G11–12 sections (`POST /api/academics/sections`), create G11–12 subjects (`POST /api/academics/subjects`), assign teachers to classes (`POST /api/academics/assign`). Grade-band constrained to 11–12.
7. **`report-cards/page.tsx` (Report Cards)** — NEW:
   - Manage G11–12 report cards; "Scan & digitize" action → OCR upload (`POST /api/sf10/upload`, widened) + extract (`GET /api/sf10/ocr/:jobId`). Read/manage digitized cards.
8. **`sf10/page.tsx` (SF10 Records)** — custody + validate/release:
   - Per-grade breakdown via `/api/sf10/summary` + records table (status attach/available/missing/released).
   - Row actions: **Validate** (`POST /api/sf10/:id/validate`), **Release** (`POST /api/sf10/:id/release`). Detail drawer optional (v1).

### B. Backend additions (new routes — `backend/src/modules/`)
**B1. SF10 guard widen:** add `registrar` to `requireRole` on `POST /api/sf10/upload` (`sf10.routes.ts:65`) and `GET /api/sf10/ocr/:jobId` (`sf10.routes.ts:84`).
**B2. Account requests:**
   - `GET /api/auth/pending` — `requireRole("record_keeper","registrar")`, grade-band guarded, returns users with `status:"pending"` in band 11–12 + linked parent (via `parentOf`/`studentProfile.parentId`).
   - `POST /api/auth/approve-batch` — approve a student and their linked parent in one transaction (audit both).
   - `POST /api/auth/reject/:userId` — set `status:"rejected"`, audit.
**B3. Adviser access:** new `backend/src/modules/adviser-access/adviser-access.routes.ts`:
   - `GET /api/adviser-access/pending` (registrar, band 11–12)
   - `POST /api/adviser-access/:id/approve`, `.../deny` (registrar) — toggles `extraAccessGranted` on the adviser's advisee scope.
**B4. Academics write:** extend `backend/src/modules/academics/academics.routes.ts`:
   - `POST /api/academics/sections` (registrar, band 11–12)
   - `POST /api/academics/subjects` (registrar, band 11–12)
   - `POST /api/academics/assign` (registrar — assign teacher to section/subject)
**B5. Report cards:** new `backend/src/modules/report-cards/report-cards.routes.ts`:
   - `GET /api/report-cards` (registrar, band 11–12), `POST /api/report-cards` (create/manage), `POST /api/report-cards/:id/scan` (digitize/attach OCR).

### C. Shared components — `frontend/src/app/registrar/components/`
`Sf10SummaryCards.tsx`, `FinalGradeApprovalTable.tsx`, `AccountApprovalTable.tsx`, `AdviserAccessTable.tsx`, `AcademicsManager.tsx`, `ReportCardManager.tsx`, `RegistrarKpi.tsx`. Reuse `Card`, `Button`, `Table`, `Badge`, `AlertDialog`, `sonner`, `DropdownMenu` from `components/ui`. Reuse `components/errors/StatusPage` for error states + fluid bg styling.

### D. API helpers — `frontend/src/app/registrar/api.ts`
`fetchSf10Summary()`, `fetchPendingFinalGrades()`, `approveFinalGrade(id)`, `fetchPendingAccounts()`, `approveAccountsBatch(ids)`, `rejectAccount(id)`, `fetchAdviserAccessRequests()`, `decideAdviserAccess(id, decision)`, `createSection(...)`, `createSubject(...)`, `assignTeacher(...)`, `fetchReportCards()`, `scanReportCard(id, fileUrl)`, `validateSf10(id)`, `releaseSf10(id)`.

## Non-goals (explicitly excluded for registrar)
- NO school-year / grading-period setup UI or routes (Principal-only per spec).
- NO Grade 7–10 approval queue, NO counseling/health/ADM private notes.
- NO grade encoding / assessments / attendance entry (Adviser/Subject Teacher).
- NO raw grade-lock action (adviser-only by design); registrar only approves locked finals.
- NO auth/role enumeration changes beyond widening SF10 OCR guard + adding registrar to new write routes.

## Design tokens applied
- Cards: `bg-card` + 1px stone-200 border, `rounded-md`.
- Primary actions: brand green `bg-primary`. Destructive/return: `destructive`.
- Typography: display for numbers/titles, Inter body, mono for LRN/IDs.
- Spacing: 8px grid (concrete rem, NOT `var(--spacing-*)`).
- Motion: 120–180ms ease-out, respect reduced-motion.

## Acceptance criteria
- `npm run build` succeeds; `/registrar`, `/registrar/final-grades`, `/registrar/accounts`, `/registrar/adviser-access`, `/registrar/academics`, `/registrar/report-cards`, `/registrar/sf10` render.
- Registrar can: see + approve a locked 11–12 final; see + approve/reject pending 11–12 accounts (student+parent); approve/deny adviser access; create section/subject + assign teacher (11–12); manage + scan report cards; validate/release SF10.
- SF10 summary renders counts per grade; OCR upload guard includes registrar.
- Uses shadcn `Button`/`Card`/`Table`; styled per design system; no gradient text/blobs.
- No "Event handlers cannot be passed to Client Component props" errors (interactive pages `"use client"`).
- Lint passes (no new errors).

## Verification
1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run build`
4. (Manual) `npm run dev` → login as `registrar@zentra.test` / `Zentra2025!` → exercise all 7 pages + each write action against seeded data.
5. Backend: `npm run test` (or equivalent) for new routes B1–B5 if a test harness exists.

## Implementation order (recommended)
1. Backend B1 (widen SF10 OCR guard) — unblocks report-cards scan.
2. Frontend shell: `layout.tsx` + `registrar-sidebar.tsx` + Dashboard (`page.tsx`).
3. Final-grades approval (existing endpoint) — proves the approve pattern.
4. SF10 validate/release (existing endpoints).
5. Backend B2 + Accounts page.
6. Backend B3 + Adviser-access page.
7. Backend B4 + Academics page.
8. Backend B5 + Report-cards page.
9. API helpers + shared components consolidated; lint/build.
