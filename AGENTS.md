# AGENTS.md — E-zentra (Zentra) working memory

> Built 2026-10-17. Read this first; do not re-scan the whole repo.
> Deep-dive docs: `SYSTEM_UNDERSTANDING.md` (best onboarding), `PLAN.md`
> (spec + resolved design decisions), `docs/zentra-progress-report.md`
> (2026-09-23 audit — partly outdated), root `*_REPORT.md` (dated audits).

## 1. PROJECT OVERVIEW

- Zentra = Student Information & Management System for **Mati School of Arts and Trades**, Grades 7–12, **trimester** (3 terms per school year).
- 10 roles (Prisma `Role`): student, parent, subject_teacher, adviser, nurse, adm_coordinator, guidance_counselor, record_keeper (band G7–10), registrar (band G11–12), principal.
- 8 staff web shells exist; **student/parent can log in but have no desk** (login fallback routes 404 — see Gotchas).
- Features: grading workspace + DepEd transmutation + finals lock/approve; attendance (legacy AM/PM + per-subject) with auto-absent sweep; anecdotal records (GCForm‑01) + folders/signatures; referral pipeline (triage → counseling/nurse sessions → interventions) and ADM case flow (profile → meetings → certification → principal sign → modules/devices → completion); SF10 records (upload/OCR, versions, verify→validate→release); rule-based risk engine; dashboards/heatmaps/reports/honor-roll/audit; notifications fan-out; per-role realtime; print record sheets.

## 2. TECH STACK

- **Frontend** (`frontend/`): Next.js 16.3.2 (App Router), React 19.2.8, TypeScript, TanStack Query 5, Axios, Tailwind 4 + shadcn + radix-ui, **CSS Modules** for shell/page layout, lucide/hugeicons, recharts, dnd-kit, zod 4, sileo toasts, jspdf/exceljs/html-to-image exports.
- **Backend** (`backend/`): Node + Express 4, TypeScript **ESM** (imports end in `.js`), Prisma 7.10 + `@prisma/adapter-pg`, argon2id, jsonwebtoken, Zod 3, pino, helmet, cors, express-rate-limit, multer, exceljs, tesseract.js (SF10 photo OCR), `@upstash/redis` (response cache), `@supabase/supabase-js` (Storage only).
- **DB**: PostgreSQL on Supabase pooler (`DATABASE_URL`); 47 Prisma models; RLS in `backend/prisma/migrations/0001_rls.sql` (applied manually).
- **Realtime**: Supabase `postgres_changes` channels per role — `frontend/src/lib/realtime/*Channel.ts` (all 8 shells wired).
- **Hosting**: nothing deployed in this repo. PLAN proposes Vercel (web) + Railway/Render/VPS (backend). UNVERIFIED.
- **Mobile**: not in this repo; branches `origin/mobile`, `origin/mobileDevice` exist. UNVERIFIED.
- **Tests**: Vitest 2 + Supertest 7 (`backend/tests/`, no live DB). Playwright is a frontend devDependency but no config/e2e suite found. UNVERIFIED.
- CI: Node 20 (`.github/workflows/ci.yml`).

## 3. ARCHITECTURE

- Two apps: `backend/` REST API under `/api/*`; `frontend/` Next App Router with one route tree + layout per role shell.
- Backend layering: `modules/<domain>/*.routes.ts` (thin handlers, Zod via `validate` middleware) → `*.repository.ts` / `services/<domain>.ts` (domain logic) → Prisma. Shared kernel in `backend/src/lib/`.
- Auth: JWT access (localStorage `zentra.access`) + refresh in httpOnly cookie; 401 → single-flight refresh → retry → `/errors/403` (`frontend/src/lib/api/client.ts`). Claims: `sub`, `role`, `gradeBand`. Guards: `requireAuth`, `requireRole`, `requireOwnershipOrRole` (`backend/src/middleware/auth.ts`), `gradeBandGuard` (`middleware/gradeBand.ts`).
- Term scoping (`backend/src/lib/termScope.ts`, mounted via `app.ts` → `attachTermScope`): only **term-steering roles** (subject_teacher, adviser, principal — `canSteerTerm` in `backend/src/lib/roles.ts`) may steer term via `?termId`/`?schoolYearId` or `x-term-id`/`x-school-year-id`; every other role resolves server-side (active school year → date-picked term). The principal picks one scope in `/principal/settings` (stored per user in localStorage, like teachers) and every principal page follows it. Exception: `GET /api/reports` (principal) accepts explicit `termId`/`schoolYearId` query params for the reports scope picker — they default to the server-resolved active scope and are looked up/validated by the service.
- Caching: Upstash Redis GET-cache keyed method+path+qs+role+user+term-scope, tag invalidation (`lib/cache.ts`, `lib/cacheTags.ts`); TTLs dashboard 15s / list 30s / semiStatic 300s / lookup 3600s; ETag middleware; `ReportSnapshot` DB fallback for reports. Redis absent → fail-open, caching off.
- Pagination: **15/page, max 15, everywhere** — two exceptions, both guidance-desk boards that lay out a 4×4 card grid: the referrals queues (nurse kanban boards — ADM cases + Clinic matters — and guidance queues) accept up to **16/page** (`NURSE_QUEUE_MAX_PAGE_SIZE` in `modules/referrals/referrals.schemas.ts`), and the guidance interventions queue does too (`INTERVENTIONS_QUEUE_MAX_PAGE_SIZE` in `modules/interventions/interventions.schemas.ts`); the global ceiling in `lib/pagination.ts` is unchanged. Desk services that merge several sources into one board (guidance alerts desk → `/api/guidance/alerts/cases`) load each source up to the internal-only `INTERNAL_AGGREGATE_ROW_CAP` (400) and page the merged list themselves — never wired to a client query param. Envelope `{data,total,page,pageSize,totalPages}`; frontend shared `Pagination` + `usePaginatedQuery` (`keepPreviousData` + next-page prefetch + AbortSignal).
- Writes: `writeAudit` (`lib/audit.ts`; pass the tx client inside `prisma.$transaction` or it fails loudly), `fanoutNotification` (`lib/notify.ts`, `source_table:action` → type map), `invalidateTags([...])`, live risk recompute.
- Background sweeps from `backend/src/index.ts` hourly: grade-flag escalation, auto-absent, risk snapshots.
- Frontend data flow: page → `services/<role>/*.service.ts` hook (TanStack Query, canonical `queryKey`/`CACHE_PRESETS`) → `apiClient` (+term headers for teachers) → API. Lists use URL-synced page/filters.
- Design rules live in `.kilo/skills/zentra-design/` (rounded-md, 1px borders, one accent, micro-motion 120–180ms).
- Shared desk UI: `components/ui/kanban-board.tsx`, `kanban-overlay.tsx` (modal shell) and `pill.tsx` (status/metadata chips) are the standard; role wrappers (`PrincipalEmptyCard`, `GuidanceEmptyCard`, `*PageHeader`) alias `components/shared/*`. Status chip colours come from `lib/labels/status-tone.ts` — add new statuses there, never inline a `Badge` variant map.

## 4. DIRECTORY MAP

- `backend/src/index.ts` — server entry (listen, timeouts, hourly sweep timers). `backend/src/app.ts` — middleware order + router mounts (single source of API mounts).
- `backend/src/modules/<domain>/` — route files per domain: `auth`, `grades`, `attendance`, `anecdotal`, `referrals`, `interventions`, `adm`, `sf10`, `risk`, `notifications`, `audit`, `overview`, `academics`, `reports`, `registrar`, `record-keeper`, `registry` (shared kernel, no routes), `teacher`, `guidance`, `nurse`, `principal`, `sessions` (mounted `/api/my-sessions`).
- `backend/src/services/` — cross-module domain logic: `risk.ts`, `grading.ts`, `attendance*.ts`, `autoAbsent.ts`, `gradeFlags.ts`, `enrollment.ts`, `riskRefresh.ts`, `mascot.ts`, plus role subfolders (`adm/`, `teacher/`, `guidance/`, …).
- `backend/src/lib/` — kernel: `prisma.ts`, `jwt.ts`, `auth`-adjacent `roles.ts`, `termScope.ts`, `pagination.ts`, `cache.ts`, `cacheTags.ts`, `etag.ts`, `audit.ts`, `notify.ts`, `storage.ts`, `upload.ts`, `errors.ts`, `grades.ts`, `perf.ts`, `lrnMatch.ts`, `sessionActors.ts`.
- `backend/src/middleware/` — `auth.ts`, `gradeBand.ts`, `termScope.ts`, `validate.ts`, `rateLimit.ts`.
- `backend/src/config/env.ts` — Zod env schema (fail-fast). `backend/src/generated/prisma/` — **committed** generated client (import `../generated/prisma/client.js`).
- `backend/prisma/` — `schema.prisma`, `migrations/` (74 timestamped + `0001_rls.sql`), `apply-rls.ts`, many `seed-*.ts` + count/audit scripts (npm scripts in `backend/package.json`).
- `backend/tests/*.test.ts` — Vitest suites per area. `backend/scripts/` — one-off data/QA helpers.
- `frontend/src/app/` — `layout.tsx`/`page.tsx` (landing), `login/{,staff,students,parents}`, `register`, `errors/[code]`, `(print)/record/...`, and role shells: `principal/`, `coordinator/`, `nurse/`, `guidance/`, `teacher/`, `record-keeper/`, `registrar/` — each `layout.tsx` + feature folders with page-local `components/`.
- `frontend/src/components/` — shared feature kits (`adm-queue`, `anecdotal`, `dock`, `registry`, `risk-dashboard`, `session-booking`, …), `ui/` (shadcn primitives), `shared/` (pagination, headers, skeletons, empties), role sidebars (`*-sidebar.tsx`).
- `frontend/src/services/<role>/` — query hooks + `*.types.ts` (teacher, guidance, nurse, coordinator, principal, registry, settings, anecdotal).
- `frontend/src/lib/` — `api/` (client, queryKeys, usePaginatedQuery, useOptimisticMutation), `auth/`, `term/`, `realtime/`, `supabase/`, `notifications/`, `risk/`, `labels/`.
- `docs/` (role-module specs, ERD, stack notes — partly stale), `PLANS/` (per-role wiring plans + `qa-output/TRANSACTION_INVENTORY.md`), `qa-output/` (**gitignored** QA artifacts), `supabase/config.toml`.
- Root: `PLAN.md`, `SYSTEM_UNDERSTANDING.md`, dated audit reports, `push.bat`.
- `frontend/AGENTS.md` + `frontend/CLAUDE.md` are auto-managed by `next dev` — leave them alone.

## 5. COMMANDS

Backend (`cd backend`):
- Install: `npm ci`; env: copy `.env.example` → `.env` (required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`; Redis optional).
- Dev: `npm run dev` (tsx watch, port 4000). Build: `npm run build` (+ copies anecdotal assets) → `npm start`.
- Quality: `npm run typecheck`, `npm test`, `npm run test:watch`.
- Prisma: `npm run prisma:generate` (after schema edits), `npm run prisma:migrate`, `npm run prisma:deploy`.
- Seeds: `npm run prisma:seed`, `prisma:seed:school` (+`:small`/`:dry`), `prisma:gradebook`, `prisma:seed100`, `prisma:seed:wipe`, `prisma:seed:guidance-session-docs`, `prisma:seed:reogie-adm`, etc. (full list in `backend/package.json`).
- RLS (manual, no npm script): `npx tsx prisma/apply-rls.ts`.

Frontend (`cd frontend`):
- Install: `npm ci`; env: copy `.env.example` → `.env.local` (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — build-inlined).
- Dev: `npm run dev` (port 3000). Build/start: `npm run build` → `npm start`.
- Quality: `npx tsc --noEmit -p tsconfig.json`, `npm run lint` (eslint; react-compiler gate).

CI (`.github/workflows/ci.yml`): backend prisma generate → migrate deploy (**main pushes only**, needs `DATABASE_URL` repo secret) → typecheck → test → build; frontend tsc → lint → build.
Helper: `push.bat "msg"` = `git add -A` → commit → `push origin main`. No root package.json/workspaces — run commands per folder.

## 6. CONVENTIONS

- Backend: strict TS, ESM, `.js` specifiers on relative imports; routes thin, logic in repository/service; throw `AppError(status, CODE, message, fields?)`; Prisma error codes mapped in `lib/errors.ts` (P2002→409 DUPLICATE, P2003→400, P2025→404, connection codes→503); Zod schemas in `*.schemas.ts` + `validate` middleware; comments explain *why* (incl. measured perf notes) — keep style.
- Frontend: `"use client"` pages/hooks; page-local `components/`; react-compiler lint gate — follow existing `eslint-disable` patterns rather than fighting; query keys via `lib/api/queryKeys.ts`; lists via `usePaginatedQuery`; mutations via optimistic helper + `invalidateQueries`; term headers only for teacher roles.
- Lists always server-paged at 15 with the shared envelope (referrals queues: 16); URL-sync page/filters on list pages.
- Tests: `backend/tests/<area>.test.ts`, Vitest; stub env vars in `beforeAll`; dynamic-import `../src/app.js`; Supertest for HTTP; no DB required.
- Commits: conventional (`feat(scope): …`, `fix(area): …`, `chore: …`, `refactor(frontend): …`). Branches kebab-case (`feat/...`, `chore/prod-readiness`); direct pushes to `main` are normal here.

## 7. KEY MODULES

Backend (paths relative to `backend/src/`):
- `modules/auth/*` — register (student/parent/staff), login/refresh/logout (argon2id + JWT + refresh cookie), pending list, LRN match, approve/reject (banded).
- `modules/grades/grades.routes.ts` + `services/grading.ts` + `lib/grades.ts` — components/weights, assessments, scores, DepEd transmutation, finals lock → adviser-approve.
- `modules/attendance/*` + `services/attendance*.ts` — bulk AM/PM and per-subject taking (PH/weekend/future guards), rate service, heatmaps, legacy tables.
- `modules/anecdotal/*` — records, folders, signatures, OCForm‑01 Excel workbook (`ocform01.workbook.ts`; assets copied on build).
- `modules/referrals/*` — intake, queues, status pipeline (escalate/reassign/note/follow-up/dismiss), sessions + attachments, timeline; close-out needs ≥1 completed session.
- `modules/interventions/*` — queue + case sessions, approvals, outcomes (auto-created by risk engine).
- `modules/adm/*` — profiles/meetings/invitees/attachments/devices/meta; ADM stage machine + eligibility + principal approve. `monitoring.routes.ts` serves the adviser ADM monitoring desk (`GET /api/adm/my-cases/:caseId`, module create/patch) — module upload links live on `AdmModule.submissionUrl` (saving one auto-marks the module submitted); access is resolved through `Section.adviserId`, and `/api/adm/my-cases` lists every ADM case in the adviser's section (any filer). The case desk's module board **merges** that case's `AdmModule` rows with the section's `kind: adm` `AdvisoryModule` rows (read-only, per-learner status from `AdvisoryModuleSubmission`; edited on `/teacher/advisory/modules`) and computes progress over both.
- `modules/sf10/*` — records + lifecycle (verify→validate→release), append-only versions, desk banding, storage.
- `modules/risk/*` + `services/risk.ts` (flags: grade avg <75, attendance <80%, ≥1 anecdote); attendance uses `sectionAttendanceTotals(sectionIds, termId)` — section meetups elapsed from the **term start date** (timetable-derived, recorded-sheet fallback), never the learner's add date — passed as `attendanceTotal`, `services/riskRefresh.ts` (hourly snapshots).
- `modules/teacher/*` — overview scopes, roster/students, grading workspace, grade flags, advisory (roster/advisee academics/attendance), claim/verify codes, timetable, settings, sf10-access, advisory modules (`modules.routes.ts` + `services/advisory/modules.service.ts`: section-wide module release + per-learner submissions). Biggest router.
- `modules/registrar/*` + `modules/record-keeper/*` + `modules/registry/registry.repository.ts` — shared (banded) accounts/finals/adviser-access/academics desks.
- `modules/academics/*` — sections/subjects/assignments/advisers/schedule + honor-roll live service.
- `modules/guidance/*` — overview/alerts (at-risk queue)/referrals/anecdotal/schedule/settings. `alertCases.routes.ts` (+ `services/guidance/alertCases.service.ts`) serves the alerts desk's merged referrals + interventions board in one server-paged response.
- `modules/overview`, `modules/principal`, `modules/audit`, `modules/reports`, `modules/notifications`, `modules/sessions`, `modules/guidance/*`, `modules/nurse/*`.
- `lib/notify.ts` — `TYPE_MAP` derives notification types (never pass arbitrary strings). `lib/audit.ts` — audit writes.

Frontend (paths relative to `frontend/src/`):
- `lib/api/client.ts` — axios instance, token, teacher term headers, 401 refresh, logout.
- `lib/api/usePaginatedQuery.ts`, `queryKeys.ts`, `useOptimisticMutation.ts` — the one list/mutation pattern.
- `lib/auth/{useSession,useRoleGuard,roles}.ts`; `lib/term/{TermContext,termStorage}.ts`; `lib/realtime/*Channel.ts` (per-role invalidation).
- `services/<role>/*.service.ts` — all API calls + query hooks + types.
- Advisory Modules desk: `/teacher/advisory/modules` (nav "Modules") → `services/teacher/advisoryModules.service.ts` → `/api/teacher/advisory/modules*`. Same release/submission semantics as ADM modules but section-wide (aggregate status, per-learner submission table). Submissions support three kinds: `link`, uploaded `file` (PDF/Word, ≤10 MB, Supabase storage), and `physical` (passed in person).
- `components/dock/*` (teacher task dock/kanban), `components/registry/*` (SF10 + finals shared UI), `components/shared/*`.

## 8. DATA MODELS

- `backend/prisma/schema.prisma` (49 models; PLAN says "30 tables" — outdated). No `@map` — Prisma names are the DB names.
- Key enums: `Role` (10), `UserStatus` pending|active|suspended; `GradeLevel` G7–G12; `RiskLevel` Low|Moderate|High; `Confidentiality` restricted|confidential; `AttendanceStatus`; `Session` AM|PM; `ComponentType` WRITTEN_WORK|PERFORMANCE_TASK|EXAM; `LockStatus` unlocked|locked|adviser_approved; `ReferralStatus` (7 values); `AdmStage` (8 stages); `AdmEligibility`; `Sf10Source/Status/Desk`; `AccessRequestStatus`; `GradeFlagStatus`; `ApprovalStatus`; `OutcomeStatus`.
- Identity: `User` root → `StudentProfile` / `ParentProfile` / `StaffProfile`; `ParentStudentLink` bridge. **Dual-identity pattern**: `studentId XOR rosterId` (DB CHECK) on `StudentGrade`, `FinalGrade`, `AttendanceRecord`, `AnecdotalRecord`, `Referral`, `Intervention`, `RiskSnapshot` — `StudentRoster` = enlisted learner without account.
- Academic spine: `SchoolYear` → `Term` (3/year) → `Section`/`Subject` → `TeacherSubjectAssignment`; `GradeComponent` → `Assessment` → `StudentGrade` → `FinalGrade`; `AttendanceRecord` (+ legacy); `AnecdotalRecord` → `Referral` → `CounselingSession`/`HealthRecord`/`HomeVisitationRecord`/`AdmLearnerProfile` → `AdmParentMeeting`/`AdmModule`/`AdmDevice`/`AdmForm`; `Sf10Record` → `Sf10RecordVersion`.
- Cross-cutting: `AuditLog`, `Notification`, `RiskSnapshot`, `ReportSnapshot`, `RefreshToken`, `TeacherName`, `TeacherTermGrant`, `AdviserArchivedStudent`, `GradeFlag`, `AdviserSf10AccessRequest`.
- API: ~288 route registrations; mounts in `backend/src/app.ts` (`auth, grades, attendance, anecdotal, referrals, interventions, adm, sf10, risk, notifications, audit, overview, academics, reports, registrar(+academics), record-keeper(+academics), teacher(+grade-flags/advisory/grading), guidance, nurse, principal, my-sessions`); health at `GET /health`. Paginated envelope as in §3.

## 9. GOTCHAS

- **Committed Prisma client** at `backend/src/generated/prisma/` — regenerate after schema edits; it pollutes diffs by design.
- Backend ESM: missing `.js` import extension breaks build; `backend/tsconfig.json` excludes `tests/` and `prisma/`.
- `frontend/AGENTS.md` warns: **Next.js 16 differs from training data** — read `frontend/node_modules/next/dist/docs/` before writing Next-specific code.
- Styling is mixed: CSS Modules for layout + Tailwind utilities (PLAN's "Tailwind scoped to shadcn only" is drift). Match the file you edit.
- Student/parent login lands on `/student`, `/parent` → **404** (fallback `/${role}`, `frontend/src/components/auth/LoginForm.tsx:84-92`); no portals exist.
- `useRoleGuard` only on guidance/nurse/coordinator layouts; other shells render unguarded (backend still enforces). No `frontend/src/middleware.ts`.
- Dead nav: "Report Cards" links in registrar + record-keeper sidebars have no `page.tsx` (404).
- `/api` sets global `Cache-Control: private, no-store`; the cache middleware default `private, max-age=30` is an override owner said to review, not the rule.
- RLS lives in `backend/prisma/migrations/0001_rls.sql`, applied by the manual `apply-rls.ts` script — keep in sync with schema changes.
- Doc drift: `PLAN.md` says bcrypt (actually argon2id); `docs/backend-stack.md` claims Multer/Storage/Redis/RLS unwired — all wired since; `docs/zentra-progress-report.md` (Sept 23) lists issues since fixed (anecdotal POST now responds, registrar `enforceBand: true`, realtime 8/8 shells, record-keeper SF10 page exists) — verify before trusting any old audit.
- `backend/debug-jones.tmp.ts` — committed throwaway debug script; leave alone unless asked.
- Teacher ADM monitoring detail is addressed by a learner-name slug (`/teacher/advisory/adm-cases/ma-juana-dela-cruz`), never the UUID: `frontend/src/lib/slug.ts` ↔ `caseSlug` in `backend/src/services/adm/monitoring.service.ts` must stay in sync; the API still accepts a legacy UUID.
- Principal ADM approval requires a saved drawn signature (same `StaffProfile.signatureImageUrl` master signature as OCForm‑01; `GET/PUT /api/anecdotal/signature` allows `principal`). `principalApprove` returns 409 `NO_SIGNATURE` without one and stores the PNG data URL as the `PRINCIPAL_SIGNAGE` `AdmForm.fileUrl`. Returns are tracked on `AdmLearnerProfile.returnedAt/returnReason` (cleared by `certify`/`principalApprove`); `principalReturn` moves the case to `stage: certification`, and the principal list keeps returned cases in its "Returned" lane until re-certification.
- Working tree often carries large uncommitted WIP (schema + generated client + services; ~109 files as of 2026-10-17) — check `git status` and never revert unrelated work.
- Supabase Storage auto-creates missing buckets (public) and returns public URLs (`lib/storage.ts`); buckets: `STORAGE_BUCKET` (`zentra-docs`), `SF10_STORAGE_BUCKET`, `REFERRAL_STORAGE_BUCKET` (falls back to `CLINIC_STORAGE_BUCKET` then `STORAGE_BUCKET`). Never commit `.env*`; service-role key stays local.
- `backend/tests/ocform01.test.ts` can time out under full-suite parallel load; passes in isolation (known flake).
- CI deploys migrations to the live DB on every `main` push — treat migrations as production ops.

## Speed rules (default mode)

Default execution mode is **fast**. Apply silently — no need to announce it.

Fast mode (small change, bug fix, tweak, question, reading task):
- Read only the file(s) you will edit. Grep for callers ONLY if you change
  a signature, a shared helper, or exported behavior. Skip unrelated tests.
- After editing: run just the typecheck (`npm run typecheck` in backend,
  `npx tsc --noEmit -p tsconfig.json` in frontend). Do NOT run the full
  test suite, lint, or build unless asked.
- If typecheck fails, fix it; then stop.
- Reply short: what changed, which files, risks. No filler, no recap of
  things I already know, no "want me to also...?" unless it's a real risk.

Thorough mode (I say "thorough", or the change touches schema, auth,
term scope, caching, shared libs, middleware, >3 files, or deletes code):
- Full Workflow-rules loop below: callers + tests, lint, build, report.

Cheap habits always: `rg`/grep instead of reading whole files, offset/limit
reads for big files, parallel independent tool calls, skip reading docs when
this file already answers it.

## Workflow rules (apply to EVERY request, automatically)

Before acting:
1. Use this file as the map of the project. Don't re-scan the whole repo.
2. Find the files relevant to my request (search by name/symbol) and READ
   them before changing anything. Also read their direct callers/imports
   and related tests (fast mode: scope this down — see Speed rules).
3. Check existing patterns in similar code and follow them.
4. If my request is vague, state your assumption in one line, or ask one
   short question.

While acting:
5. Small changes (bug fix, tweak): just do it.
6. Large or risky changes (multiple files, refactor, schema, deleting
   code): give a short plan and wait for approval.
7. No new dependencies without asking. Don't touch unrelated code.

After acting:
8. Review your own diff: check for bugs, edge cases, broken callers,
   leftover debug code, and style mismatches.
9. Run the tests/linter/build and report results (fast mode: typecheck
   only — see Speed rules). If something fails, fix it before replying.
10. Reply briefly: what changed, which files, and any risks.
11. If the structure, commands, or conventions changed, update this file.

If I ask for a "review" (no changes), read the relevant code and report
bugs, risks, and improvements ordered by severity, with file paths and
line numbers. Do not edit anything.
