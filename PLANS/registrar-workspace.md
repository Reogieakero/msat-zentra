# Plan: Registrar Workspace (frontend)

## Context (carry forward)
- Stack: Next.js 16 (App Router, Turbopack), Tailwind + shadcn/ui, React 19, axios (`apiClient`).
- Design language: stone-50 `#FAFAF9` bg, 1px stone-200 borders, ONE brand accent (school deep green `oklch(0.45 0.09 150)`), `rounded-md`, border-over-shadow, fluid background on auth/error surfaces, 8px grid, `prefers-reduced-motion`.
- Roles (`frontend/src/lib/auth/roles.ts`): `registrar` = "Registrar". No `app/registrar` folder exists yet (only `app/{errors,login,principal}`).
- Registrar backend permissions (from `backend/src/modules/*`):
  - **Grades**: `POST /api/grades/final-grades/:id/registrar-approve` — `requireRole("record_keeper","registrar")` + `gradeBandGuard` (registrar = grades **11–12**). Validates final is `locked`, then sets `finalizedBy/finalizedAt`. (Route defined; needs a UI to list locked finals & approve.)
  - **SF10**: `GET /api/sf10/summary` — `requireRole("principal","registrar","record_keeper")`. Returns per-grade counts: `attach / available / missing / released`. (Needs a UI dashboard.)
  - **Auth**: registrar is a valid role; grade band 11–12.
  - Read access to final grades (`requireOwnershipOrRole` includes registrar).
- Contrast with Principal: Principal is oversight/read + ADM approval. Registrar is **transactional validation**: approve locked final grades (11–12) and manage SF10 learner records custody.

## Goal
Build a Registrar workspace that mirrors the Principal shell (sidebar, topbar, account menu, grade-basis toggle, fluid/brand styling) with role-appropriate pages and the two registrar write actions surfaced as real UI.

## Scope (files to create)
Under `frontend/src/app/registrar/`:

1. **`layout.tsx`** — clone `principal/layout.tsx` shell:
   - Reuse `StaffSidebar` (already generic) + `SidebarProvider` + `GradeModeProvider` + account menu (theme, grade basis, logout).
   - Add a `registrar` nav config (new `NAV` array in a local sidebar or extend `staff-sidebar`). Decision: create `frontend/src/components/registrar-sidebar.tsx` mirroring `staff-sidebar.tsx` with Registrar nav, to avoid coupling Principal nav.

2. **`page.tsx` (Dashboard / Overview)** — Registrar home:
   - SF10 summary cards (per grade 11–12: attach/available/missing/released) via `GET /api/sf10/summary`.
   - Quick stats: pending final-grade approvals (11–12), records missing.
   - "Action Required" panel linking to Approvals.

3. **`final-grades/page.tsx` (Final Grade Approvals)** — the core registrar action:
   - List locked final grades in band 11–12 awaiting registrar approval.
   - Table: student LRN, name, subject, term, computed avg, transmuted, status.
   - Row action: **Approve** → `POST /api/grades/final-grades/:id/registrar-approve` (confirm via `AlertDialog`). On success: optimistic update + toast (`sonner`).
   - Honor grade-band guard client-side (only 11–12 shown).

4. **`sf10/page.tsx` (SF10 Records)** — learner record custody view:
   - Use `/api/sf10/summary` to show per-grade breakdown + a records table (read-only status: attach/available/missing/released). Detail drawer optional (out of scope v1 unless needed).

5. **Shared components** under `registrar/components/`:
   - `Sf10SummaryCards.tsx`, `FinalGradeApprovalTable.tsx`, `RegistrarKpi.tsx` (reuse `Card`, `Button`, `Table`, `Badge`, `AlertDialog`, `sonner` from `components/ui`).
   - Reuse `components/errors/StatusPage` for error states; reuse fluid bg styling.

6. **API helpers** in `registrar/api.ts`:
   - `fetchSf10Summary()`, `fetchPendingFinalGrades()`, `approveFinalGrade(id)`.

## Non-goals (this pass)
- No new backend routes (all endpoints exist). If `fetchPendingFinalGrades` lacks a dedicated endpoint, reuse `GET /api/grades/students/:id/final-grades` aggregated, or add a lightweight `GET /api/grades/pending-registrar` — flag for backend if missing.
- No grade encoding, attendance, or ADM approval (not registrar perms).
- No auth/role changes.

## Design tokens applied
- Cards: `bg-card` + `1px border` (stone-200), `rounded-md`.
- Primary actions: brand green `bg-primary`. Destructive/return: `destructive`.
- Typography: display for numbers/titles, Inter body, mono for LRN/IDs.
- Spacing: 8px grid (`0.5rem`/`1rem`/`1.5rem` concrete rem, NOT `var(--spacing-*)` — confirmed those tokens are undefined in this project).
- Motion: 120–180ms ease-out, respect reduced-motion.

## Acceptance criteria
- `npm run build` succeeds; `/registrar`, `/registrar/final-grades`, `/registrar/sf10` prerender or render.
- Registrar can see locked 11–12 finals and approve one (mock or live API); approval writes audit server-side.
- SF10 summary renders counts per grade.
- Uses shadcn `Button`/`Card`/`Table`; styled per design system; no gradient text/blobs.
- No `Event handlers cannot be passed to Client Component props` errors (mark interactive pages `"use client"`).
- Lint passes (no new errors).

## Verification
1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run build`
4. (Manual) `npm run dev` → login as registrar → check 3 pages + approve action.
