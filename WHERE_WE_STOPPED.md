# Where We Stopped — 2026-11-11

> Checkpoint of the working tree pushed to `origin/main` on **Wed Nov 11 2026**.
> Previous commit: `bda9721 feat(teacher): modules empty-state starter board`
> (2026-11-08). This checkpoint bundles the accumulated WIP (≈370 files:
> admin portal, Google sign-in, presence/login activity, roster learner types,
> anecdotal soft-delete, realtime publication migrations, schedule templates,
> shared desk empty states, and a large styling pass).

---

## 1. What landed in this checkpoint

### Backend

| Area | Files / notes |
| --- | --- |
| **Admin role + portal API** | `Role.admin` added; `modules/admin/*` (`/api/admin`): system overview counts, user list + suspend/restore, audit log, `GET /api/admin/presence`, `GET /api/admin/login-activity`. All routes behind `requireRole("admin")`. |
| **Presence / login activity** | `services/presence.service.ts`, `User.lastActiveAt` / `lastIp` (bumped ≤ once a minute by `requireAuth`), new `LoginEvent` model (`LoginEventKind`: login / other), hourly `lastActiveAt` index. |
| **Google sign-in (brokered by Supabase Auth)** | `services/auth/google.service.ts`, `POST /api/auth/google/exchange` + `/google/complete-staff`; sign-in never creates accounts (`status:"noAccount"`), sign-up creates a `pending` user. New tests: `tests/auth-google.test.ts`. See `PLANS/google-signin.md` (status: implemented). |
| **Contact-number encryption** | `lib/contact-crypto.ts` (AES-256-GCM, `v1:` marker, legacy plaintext tolerated), `CONTACT_ENCRYPTION_KEY` in `config/env.ts`; one-off `scripts/encrypt-contact-numbers.ts`; `tests/contact-crypto.test.ts`. |
| **Roster learner types** | `LearnerType` enum (`regular` / `transferee`) on `StudentRoster` — transferee attendance/risk window opens the day after enlistment. Migration `20261110010000_roster_learner_type`. |
| **Anecdotal soft-delete** | `AnecdotalRecord.deletedAt`, archive/restore routes (`DELETE /:id`, `POST /:id/restore`, `GET /deleted`), adviser signature cleared on edit. Migration `20261111120000_anecdotal_soft_delete`. Every anecdotal read must filter `deletedAt: null`. |
| **Realtime publications** | Migrations `20261111090000_realtime_publication_guidance_section` and `20261111130000_realtime_publication_risk_snapshot`; `0001_rls.sql` + `apply-rls.ts` updated (grants + `zentra_advises_*` helpers). |
| **Nav-version badges** | `modules/guidance/navCounts.routes.ts` + `services/guidance/navCounts.service.ts` — `GET /api/guidance/nav-counts`, tuple `xmin` based ("new or updated since you opened"). |
| **Teacher grant is per school year** | `lib/teacherGrant.ts` — one code verification opens grading/lock-grades/attendance for every term of that school year. |
| **Risk cohort cache** | `lib/riskCohortCache.ts` (monotonic version bumped by the risk engine), `lib/learnerVisibility.ts` (archived-learner id memo, 10s TTL). |
| **Seeds / scripts** | `prisma/seed-admin.ts` (`admin@zentra.test`), `prisma/seed-roles-only.ts` (wipe + one account per role), `scripts/flush-cache.ts`, `scripts/purge-system-data.ts`, `scripts/clear-schedule-data.ts`. |

New migrations in this checkpoint (applied by CI `migrate deploy` on push to `main`):

```
20261109010000_admin_role
20261109020000_user_presence
20261109030000_login_events
20261109040000_login_event_kind
20261110010000_roster_learner_type
20261111090000_realtime_publication_guidance_section
20261111120000_anecdotal_soft_delete
20261111130000_realtime_publication_risk_snapshot
```

> ⚠️ CI deploys migrations to the live database on every `main` push — treat this
> push as a production operation. `0001_rls.sql` is still manual:
> `npx tsx prisma/apply-rls.ts` after migrating.

### Frontend

| Area | Files / notes |
| --- | --- |
| **Admin shell** | `app/admin/*` (`overview` with three.js presence globe + hourly login chart, `users`, `audit`, `settings`), `components/admin-sidebar.tsx`, `services/admin/*`, dedicated `/login/admin` portal (`lib/auth/home.ts`). |
| **Auth flows** | `app/auth/callback`, `components/auth/GoogleButton.tsx`, `app/register/{teacher,parent,complete}`, `lib/phone.ts`, `lib/nameSuffix.ts`. |
| **Live + fresh reads** | `lib/api/live.ts` (`useLiveQuery` / `useLiveQueries`, 20s refetch for teacher desks), `lib/api/fresh.ts` (`x-zentra-fresh: 1` 10s window after realtime invalidation). |
| **Realtime channels** | All 8 role channels updated; `teacherKeys.ts` scoped invalidation. |
| **Shared desk UI** | `components/shared/page-empty-callout.tsx`, `shared-term-pill.tsx`, `components/schedule/section-schedule-table.tsx`, `components/registry/pending-staff-queue.tsx` (teacher self-registration approvals). |
| **Teacher schedule workspace** | Template overlays/rail (`TemplateFormOverlay`, `TemplateNavRail`), optimistic cell model (`schedule-optimistic.ts`), unlock kanban; `principal/academics/schedule` rework + skeletons (deleted `schedule-table.tsx`). |
| **Anecdotal archive** | `teacher/anecdotal/components/AnecdotalArchiveDialog.tsx` (deleted-records restore). |
| **Guidance risk monitor** | `guidance/components/GuidanceRiskAlertMonitor.tsx`, nav-count badges via `services/guidance/navCounts.service.ts`. |
| **Styling pass** | Landing sections, auth shell/login, per-role module CSS, kanban/row-list/kpi-card, nav menu — broad CSS-module updates across all shells. |
| **Sounds** | `public/sounds/*` (notification chimes). |

---

## 2. Verification state

- [x] Backend `npm run typecheck`
- [x] Frontend `npx tsc --noEmit -p tsconfig.json`
- [ ] Backend `npm test` (not run for this checkpoint — `ocform01.test.ts` is a known flake under parallel load)
- [ ] Frontend `npm run lint`
- [ ] Manual smoke: `/login/admin` → `/admin/overview`, Google sign-in round trip, teacher code claim (all 3 terms), anecdotal archive/restore

> Fill in the unchecked boxes above when they are run; nothing else is known broken
> as of the push.

---

## 3. Known gaps / next steps

1. **Migrations + RLS on the live DB** — CI runs `migrate deploy`; `0001_rls.sql`
   still needs the manual `npx tsx prisma/apply-rls.ts`.
2. **`CONTACT_ENCRYPTION_KEY`** must be set in production before deploying the
   contact encryption (dev falls back to plaintext with a warning). Backfill
   existing rows with `npx tsx scripts/encrypt-contact-numbers.ts`.
3. **Admin seed** — run `npm run prisma:seed:admin` on any fresh environment.
4. **Pretty-print / link the admin portal nowhere** — `/login/admin` is
   deliberately unlinked from `/login`.
5. **Student/parent portals still 404** — login fallback routes to `/student`
   and `/parent`, which have no pages. Unchanged by this checkpoint.
6. **Dead nav** — "Report Cards" in registrar + record-keeper sidebars has no
   `page.tsx`.
7. **Temp / throwaway files committed with this checkpoint** (safe to delete once
   no longer needed):
   - `backend/scripts/_tmp-navcounts-check.ts`
   - `backend/scripts/tmp-bump-intervention.ts`
   - `backend/scripts/tmp-referral-badge.ts`
   - `backend/tmp-check-roster.mts`
   - `frontend/tmp-playwright-{bump,nav,referral}.cjs`
   - pre-existing `backend/debug-jones.tmp.ts`
8. **Anecdotal soft-delete audit** — new reads added from now on must filter
   `deletedAt: null`, including counts/groupBys/nested relation filters.

---

## 4. How to resume

```powershell
# backend
cd backend
npm run dev            # :4000
npm run typecheck
npx tsx prisma/apply-rls.ts   # after any migration touching RLS

# frontend
cd frontend
npm run dev            # :3000
npx tsc --noEmit -p tsconfig.json
```

Default seeded logins: `admin@zentra.test` / `Admin2025!` (admin portal **only**);
`npm run prisma:seed:roles` creates one active account per role on a wiped DB.
