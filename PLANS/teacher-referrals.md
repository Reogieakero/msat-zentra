# Plan: Teacher Referrals page (`/teacher/advisory/referrals`)

> Focused implementation plan for the adviser **referrals** surface — tracking
> referrals the adviser originated from their own anecdotal records.
> Spec source of truth: `docs/role-modules/teacher-adviser-plan.md` §4.4
> (Referrals), §5 (cross-cutting rules), §7 (sidebar), §8 (API surface);
> `PLAN.md` §3.5 (referral spine), §5 (API), §6.4 (ADM state machine). This
> plan adds the build order, endpoint inventory, and verification gates — it
> does not change the spec.

## Route shape (explicit)

- **Collection page only:** `/teacher/advisory/referrals` — there is **no
  `[id]` dynamic segment**. This page is `page.tsx`, not `page.tsx` under
  `[id]/`.
- Referral detail opens in a **dialog/drawer on the same page** (selected-card
  state, same pattern as `RaiseFlagDialog` / the advisory-students drawer) —
  never a `/teacher/advisory/referrals/[id]` route.

## Context (current state & gaps found in codebase)

- **Frontend gap A (dead nav link):** `frontend/src/components/teacher-sidebar.tsx:56`
  already links `{ title: "Referrals", href: "/teacher/advisory/referrals" }`,
  but **no `frontend/src/app/teacher/advisory/referrals/` route exists** → the
  user hits a 404 on click. Only `advisory/students/` (plus `[id]/attendance`,
  `[id]/academic`) exists under `/teacher/advisory`.
- **Backend gap B (no teacher read):** `backend/src/modules/referrals/referrals.routes.ts`
  has `GET /` and `POST /:id/status`, but both are gated to
  `requireRole("guidance_counselor", "nurse", "adm_coordinator", "principal")`
  (`referrals.routes.ts:34`, `:15`) — **adviser/subject_teacher are excluded**,
  so the teacher page has nothing to read. There is no `?mine=true` filter
  (spec §8: `GET /api/referrals?mine=true` → originated + participant).
- **Backend gap C (create is anecdotal-driven only):** the only create path is
  `POST /api/anecdotal/:id/refer` (`anecdotal.routes.ts:85-101`, adviser-only,
  body: `referredToRole` ∈ nurse/guidance_counselor/adm_coordinator/principal +
  `reason` + `termId`). There is **no standalone `POST /api/referrals`** — per
  spec §4.4 ("adviser-only source: anecdotal-driven") that is correct, and the
  page's "New referral" flow must start from one of the adviser's own anecdotal
  records, not a blank form.
- **Spec/code conflict D (kanban columns vs status enum):** spec §4.4 lays out
  four columns — `Referred → Meeting scheduled → Home visit (if needed) →
  Resolved/Referred out` — but the schema enum is three-state
  (`ReferralStatus`: pending/in_progress/resolved, `schema.prisma:586-602`).
  The middle columns have no direct status value; they must be **derived from
  downstream rows** (`adm_parent_meetings`, `home_visitation_records` existence)
  or the enum must be extended. See Phase 0 decision 1.
- **Spec/code conflict E (`referral_participants` does not exist):** spec §4.4
  says an adviser may see others' referrals when listed as a participant, but
  **no such table exists** in `schema.prisma` and nothing writes to it. See
  Phase 0 decision 2 (recommended: v1 = originated-only).
- **No meeting-outcome / home-visit-request endpoints:** spec §4.4 lists "add
  meeting outcome (if I attended)" and "request home visit (when parent
  no-showed)" as adviser writes, but no routes exist for either. Note
  `home_visitation_records.referral_id` is **nullable** (GC self-initiation per
  `PLAN.md` §3.6), so a teacher "request" is at most a follow-up note /
  notification ping, not a state write. See Phase 0 decision 3.
- Related plans: `PLANS/teacher-students.md` (drawer confidentiality pattern),
  `PLANS/teacher-anecdotal.md` (refer composer entry point),
  `PLANS/teacher-attendance.md`; role docs:
  `docs/role-modules/teacher-adviser-plan.md`.

## Functional requirements (from §4.4 — source of truth)

### Page — `/teacher/advisory/referrals` (adviser only; 404 for non-advisers)

- 👁 **Board of my originated referrals** (`referredBy = me`), newest-first.
  Layout per decision 1 (default: status-grouped sections mirroring the spec
  kanban order). Card per referral: student (name + section), target role
  (Guidance / Nurse / ADM Coordinator / Principal), source category (from the
  linked anecdotal record), status chip, age (days since referral).
- 👁 Filters: status chips [All][Pending][In progress][Resolved], target-role
  picker, student search (advisees only — server filters, never ships others'
  rows).
- ✎ **New referral** → picker of my own anecdotal records without a referral
  yet → reason + target role → `POST /api/anecdotal/:id/refer` (existing).
- 👁 Click card → **detail drawer** (same page, no `[id]` route):
  - Linked anecdotal summary — full text only if I am the observer (always
    true for originated referrals); otherwise metadata-only (per §6 rule).
  - Referral timeline: created + status changes (read from `audit_logs`
    `referral_status_change` rows for this `source_id`).
  - Downstream stage label only (parent-meeting scheduled/attended,
    home-visit done, ADM stage) — **no clinical columns**: no health
    diagnosis/treatment, no home-visit notes, no ADM recommendation text
    (spec §4.4/§4.5 + `PLAN.md` §4.3 status-only rule).
- 🔒 Cannot see referrals I did not originate (v1; participant visibility only
  if decision 2 adds the table). Cannot change status (status writes stay with
  the receiving roles via `POST /api/referrals/:id/status`). No contact info,
  no health detail, no ADM confidential columns.

### States

- Loading: skeleton board. Empty: "No referrals yet — refer from an anecdotal
  record." New-referral validation errors inline; submit shows spinner +
  disables (attendance-sheet pattern); success closes and invalidates the board.

## Implementation plan

### Phase 0 — Decisions (recommend before Phase 1)

1. **Kanban columns vs 3-state enum:** derive middle columns from downstream
   rows (recommended — zero migration: `in_progress` + `adm_parent_meetings`
   row = "Meeting scheduled", + `home_visitation_records` row = "Home visit";
   otherwise "Referred"; `resolved` = "Resolved") vs extend `ReferralStatus`
   with `meeting_scheduled` / `home_visit` values (migration + writer updates
   in every receiving role's flow).
2. **Participant visibility:** v1 originated-only (recommended — matches schema;
   `referral_participants` stays a spec-only concept) vs add the table +
   readers/writers now.
3. **Meeting-outcome / home-visit-request writes:** v1 read-only downstream
   labels + follow-up note on the source anecdotal (`POST /:id/followups`,
   already exists, fires `new_followup` notification to the case owner) vs new
   endpoints for teacher-written meeting outcomes.
4. **Board layout:** status-grouped columns per spec §4.4 (recommended) vs dense
   sortable table (students-page pattern) — columns collapse to stacked
   sections on narrow screens either way.

### Phase 1 — Backend (no new tables on the recommended path)

- New `GET /api/referrals/mine` (or `GET /api/referrals?mine=true` per spec §8)
  in `backend/src/modules/referrals/`: gate
  `requireRole("adviser", "subject_teacher")` + 404 unless adviser
  (`Section.adviserId = me`); returns rows with `referredBy = me`, newest-first,
  including student (name, section), linked anecdotal (id, category,
  observationDatetime, observerId), status, target role, downstream existence
  flags (`hasParentMeeting`, `meetingAttended`, `hasHomeVisit`, `admStage`) —
  **booleans/labels only, never clinical text**.
- Reuse for create: `POST /api/anecdotal/:id/refer` unchanged, except verify it
  rejects records the caller did not observe (currently any adviser may refer
  from any record — add an `observerId = me` check) and add the timeline read
  (`audit_logs` by `sourceTable=referrals`, `sourceId` already written on
  create + status change).
- Unit tests (DB-free, vitest): adviser-gate helper (non-adviser → 404),
  column-derivation mapping (decision 1 matrix), zod schemas.
- Seed: 2–3 referrals originated by the test adviser across target roles and
  statuses (one with a parent-meeting row, one resolved) tied to existing seed
  sections.

### Phase 2 — Frontend (`frontend/src/app/teacher/advisory/referrals/`)

- Follow the established `teacher/*` conventions: `page.tsx` assembles
  components from `components/`, **each component with its own CSS module**
  (mirrors `advisory/students/`, `grade-flags/`); left-aligned compact header +
  divider (workspace pattern); shadcn `Card`/`Dialog`/`Badge`/`Select` for UI
  primitives only; React Query with invalidation on create.
- Components: `ReferralsHeader` (title + New-referral button), `ReferralFilters`
  (status chips + target-role picker + student search), `ReferralBoard`
  (grouped columns/sections + cards + skeleton rows), `ReferralDetailDrawer`
  (summary + timeline + stage labels), `NewReferralDialog` (own-anecdotal
  picker → reason + target role), `referrals-data.ts` (types + api fns, wired
  from the start — no mocks).
- Sidebar link `teacher-sidebar.tsx:56` already points here — no nav change;
  verify active-state highlight for the new route.
- Drawer confidentiality: stage labels only; grep the drawer for clinical
  fields (`diagnosis`, `treatmentGiven`, visit/home-visit notes, ADM
  recommendation) in review — none may render.

### Phase 3 — Verification & gates

- Backend: `tsc --noEmit`, `vitest run`, `tsc -p tsconfig.json` (build).
- Frontend: `tsc --noEmit`, `eslint`, `next build`.
- Smoke test: login as adviser → board shows only originated referrals →
  filters work → detail drawer shows timeline + stage labels, no clinical text
  → new referral from own anecdotal appears in "Referred" → refer from another
  adviser's record returns 403 → login as pure subject teacher
  (`teacher.subject@zentra.test`) → page is blocked → receiving-role status
  change (`POST /api/referrals/:id/status`) still works and reflects on the
  board after refetch.
- Data-consistency audit (same bar as prior audits): board count + statuses
  reconcile with the advisory-students drawer referral entries and the
  principal referrals board for the same students (0 mismatches); every create
  carries a `referral_status_change` audit row.

## Out of scope / explicit non-goals

- Changing the approved §4.4 spec (build order only).
- `referral_participants` backend (unless Phase 0 decision 2 says otherwise).
- Receiving-role surfaces (guidance/nurse/ADM triage queues) and the principal
  status-only board.
- ADM Cases page (`/teacher/advisory/adm-cases`, separate surface).
- Status-write UI for teachers (teachers never flip referral status).
- Mobile screens.

## Decisions log (to fill before Phase 1)

- [ ] Kanban columns: derived from downstream rows vs extended status enum.
- [ ] Participant visibility: originated-only v1 vs `referral_participants` table now.
- [ ] Meeting-outcome / home-visit-request: follow-up-note v1 vs new endpoints.
- [ ] Board layout: status-grouped columns vs dense table.
