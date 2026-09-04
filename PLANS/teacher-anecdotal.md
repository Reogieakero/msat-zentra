# Plan: Teacher Anecdotal page (`/teacher/advisory/anecdotal`)

> Focused implementation plan for the adviser **anecdotal records** surface —
> listing own records and filing new ones (write-ups, follow-ups, referrals).
> Spec source of truth: `docs/role-modules/teacher-adviser-plan.md` §4.3
> (Anecdotal), §5 (cross-cutting rules), §6 (full-records access). This plan
> adds the build order, endpoint inventory, and verification gates — it does
> not change the spec. Read-only per-student anecdotal already ships at
> `/teacher/advisory/students/[id]/anecdotal` (wired); this plan adds the
> **write** surface, not another view.

## Context (current state & gaps found in codebase)

- **Frontend gap A (dead nav link):** `frontend/src/components/teacher-sidebar.tsx:55`
  already links `{ title: "Anecdotal", href: "/teacher/advisory/anecdotal" }`,
  but **no route dir exists** — the read-only per-student page is not a
  substitute for the workspace (list + composer).
- **Backend gap B (no teacher list):** `backend/src/modules/anecdotal/anecdotal.routes.ts`
  has `POST /` (create, adviser + subject_teacher), `POST /:id/followups`,
  `POST /:id/refer` (adviser) — but reads are principal-only (`GET /records`,
  `GET /:id`). There is **no endpoint for a teacher to list their own records**,
  and **no edit endpoint** (spec §4.3: edit own within a window).
- **Backend gap C (attachments):** spec says max 5 files ≤10MB each, but
  `AnecdotalRecord` has a single `attachmentUrl String?`. Needs a decision
  (child table vs JSON list vs keep-one) plus storage rules. Upload infra
  exists and is reusable (`src/lib/upload.js`, used by `sf10.routes.ts:166`).
- **Spec/code conflict D (confidentiality levels):** spec §4.3 says the composer
  offers `low` / `medium` / `high`, but the schema enum and the create route
  accept only `restricted` / `confidential` (`anecdotal.routes.ts:23`). Must be
  resolved before the composer is built — see Phase 0.
- **No access-request backend:** §6 full-records access (view another adviser's
  write-up on approval) has no table or endpoints; others' records stay
  metadata-only regardless (already enforced on the read page).
- Related plans: `PLANS/teacher-students.md`, `PLANS/teacher-attendance.md`;
  role docs: `docs/role-modules/teacher-adviser-plan.md`.

## Functional requirements (from §4.3 — source of truth)

### Page — `/teacher/advisory/anecdotal` (adviser only; 404 for non-advisers)

- 👁 **List of own records** for advisees: date, student, category
  (behavioral/bullying/academic/attendance/health), confidentiality badge,
  follow-up count, referral status (referred or not).
- 👁 Filters: student picker (advisees), category, date range; search note text
  (own records only — server filters, never ships others' text).
- ✎ **New anecdotal** → composer drawer: student (advisee only), category,
  confidentiality level, observation datetime, location, incident write-up
  (rich text), class performance + attendance summary (optional),
  attachments, → `POST /api/anecdotal`.
- ✎ **Edit own** within the edit window (decision below) → audit row.
- ✎ **Follow-up** on own record → `POST /api/anecdotal/:id/followups`.
- ✎ **Refer** from a record → referral composer pre-linked
  (`POST /api/anecdotal/:id/refer` already exists).
- 🔒 Others' records about my advisees appear as metadata rows only
  (date/category/tier) — same rule as the read page. No other sections, no
  health-detail columns beyond the anecdotal scope.

### States

- Loading: skeleton list. Empty: "No anecdotal records yet — file the first one."
- Composer validation errors inline; submit shows spinner + disables (attendance
  sheet pattern); success closes and invalidates the list.

## Implementation plan

### Phase 0 — Decisions (recommend before Phase 1)

1. **Confidentiality taxonomy:** keep code's `restricted`/`confidential`
   (recommended — zero migration, matches every existing row) and treat spec's
   low/medium/high as documentation wording, vs migrate everything to 3 tiers.
2. **Attachments:** JSON URL list on the record (recommended — no new table,
   capped at 5, reuse `lib/upload.js` array mode) vs child attachment table.
3. **Edit window:** 24h from creation (recommended) vs term-open editing.
4. **Composer scope:** page-level drawer only (recommended) vs also reachable
   from the advisory drawer/3-dots menu (drawer was deleted; re-adding a
   launch point is optional later).

### Phase 1 — Backend (minimal schema touch)

- New `GET /api/anecdotal/mine` (adviser + subject_teacher): own records with
  advisee/student guard (advisees for advisers; own classes for subject
  teachers), filters (studentId, category, from/to), newest-first. Full content
  — caller is the owner.
- New `PATCH /api/anecdotal/:id` (owner only, within edit window): editable
  fields + audit row (`anecdotal_edit`, already in the enum).
- Attachments: `upload.array("files", 5)` on create/update with 10MB-per-file
  cap; store per decision 2; serve via existing storage bucket setup.
- Unit tests (DB-free, vitest): window check (pure date math), zod schemas.
- Seed: a handful of own-records for adviser.g7.a across categories (the 4,021
  existing rows already cover list volume).

### Phase 2 — Frontend (`frontend/src/app/teacher/advisory/anecdotal/`)

- Follow the established `teacher/*` conventions: `page.tsx` assembles
  components from `components/`, **each component with its own CSS module**;
  left-aligned compact header + divider (workspace pattern, like the attendance
  sheet); shadcn `Card`/`Table`/`Dialog`/`Select`/`Textarea` primitives; React
  Query with invalidation on create/edit/follow-up.
- Components: `AnecdotalHeader` (title + New-record button), `AnecdotalFilters`
  (student/category/date/search, interventions-style dropdowns), `AnecdotalList`
  (table + pagination 15 + skeleton rows), `AnecdotalComposer` (drawer form),
  `FollowupComposer` (inline dialog), `anecdotal-workspace-data.ts`.
- Reuse read-page styling tokens (category colors, tier badges) so the two
  surfaces match.
- Sidebar link `teacher-sidebar.tsx:55` already points here — no nav change.

### Phase 3 — Verification & gates

- Backend: `tsc --noEmit`, `vitest run`, `tsc -p tsconfig.json` (build).
- Frontend: `tsc --noEmit`, `eslint`, `next build`.
- Smoke test: login as adviser → own list renders (no others' text) → file new
  record with attachment → appears → edit within window ok, outside window 403
  → follow-up appends → refer creates linked referral → subject teacher cannot
  open the page (404) → 5MB×6th-file and 11MB uploads rejected.
- Data-consistency audit: workspace list count reconciles with the per-student
  read pages for the same advisees (0 mismatches); every create/edit carries an
  `anecdotal_edit` audit row.

## Out of scope / explicit non-goals

- Changing the approved §4.3 spec (build order only).
- §6 full-records access backend (request/approve tables + enforcement).
- Referral kanban, ADM pages (separate surfaces).
- Bulk anecdotal import.
- Mobile screens.

## Decisions log (to fill before Phase 1)

- [ ] Confidentiality taxonomy (2-tier code vs 3-tier spec).
- [ ] Attachment storage (JSON list vs child table).
- [ ] Edit window (24h vs term-open).
- [ ] Composer reach (page-only vs additional launch points).
