# Teacher / Adviser Realtime Notification — Assessment & Plan

**Date:** 2026-11-04
**Scope:** `teacher` and `adviser` desks (pages, actions, live updates)
**Status:** Phase 0 + Phase 1 + Phase 2 implemented (2026-11-04); ops step pending

### Implementation notes (2026-11-04)

- **Transport:** authenticated push enabled via `NEXT_PUBLIC_SUPABASE_REALTIME_AUTH=true` (set in the local `frontend/.env.local`; **must also be set in the deploy environment**). Requires the Supabase project JWT secret to match backend `JWT_ACCESS_SECRET`. With push on, the HTTP fallback poll backs off from 5s to 60s; with the flag off it stays at 5s.
- **Key registry:** new `frontend/src/lib/realtime/teacherKeys.ts` is the single source of truth (`TEACHER_QUERY_KEYS`, `TEACHER_SCOPE_KEYS`, `scopesForNotification`, `isSelfNotification`, `keysForScopes`). `app/teacher/components/use-teacher-invalidate.ts` re-exports it; `teacherChannel.ts` no longer keeps a duplicate list.
- **Notification routing:** explicit `type → scopes` map with source-table fallback (instead of prefix guessing + invalidate-all); per-scope 2s throttling (coalesced, not dropped) and a 60s push-mode poll; bursts >3 collapse into one "N new updates" toast.
- **Self echoes:** `*_self` types no longer toast (the mutation already did); `markSelfNotified(sourceId)` remains for referral-submission echoes.
- **Deep links:** `teacherNotificationTarget` now resolves `advisory_module_submissions`, `adm_learner_profiles`, `adm_devices`, `student_roster`, `anecdotal_record_followups`, `teacher_names`.
- **Adviser visibility decision:** **no** cross-teacher adviser notification — anecdotal records can only be created by the section adviser (`records.routes.ts:40`), and referral follow-ups already notify the observing adviser. So no new backend fan-outs were needed for Phase 2; existing fan-outs were already sufficient.
- **Verification:** `npx tsc --noEmit -p tsconfig.json` passes. Two-browser acceptance still needs manual verification.
**Related:** [`TEACHER_NOTIFICATION_AUDIT.md`](./TEACHER_NOTIFICATION_AUDIT.md), [`TEACHER_NOTIFICATION_FIXES.md`](./TEACHER_NOTIFICATION_FIXES.md)

---

## 1. Teacher / adviser surface map

Nav (`frontend/src/components/teacher-sidebar.tsx:48-79`) plus `teacher/chat` (Bama, not in nav):

| Page | Main actions | Live data that can change under the user |
|---|---|---|
| `/teacher/overview` (+ `/students`, `/reports`) | navigate, open risk/kanban, open classes | risk, attendance %, grades, referrals, flags, roster |
| `/teacher/classes` | claim/unlink teacher code, open timetable | timetable, assignment changes, code claims |
| `/teacher/grading` + `/[assignmentId]` | components/weights, add/delete assessment, save scores, lock finals | lock → approve by adviser, grade flags, scores |
| `/teacher/attendance` | save/finalise subject or advisory attendance, request unlock | unlock by master/registrar, auto-absent sweep, other subject teachers' submissions |
| `/teacher/grade-flags` | raise/resolve flag, chat | flag opened/resolved by adviser/teacher |
| `/teacher/schedule` + template | add subjects/teachers, move entries, submit, config | principal approve/send-back, master schedule changes |
| `/teacher/settings` | profile, password, adviser claim, master seat, data sharing | adviser seat / master seat changes |
| `/teacher/advisory/list`, `/students`, `/schedule` | enlist/verify/archive learner, watch advisee academics | roster, interventions, grade changes |
| `/teacher/advisory/attendance` | advisory attendance matrix | subject-teacher submissions (adviser notice) |
| `/teacher/anecdotal` + folders | file record, follow-up, refer, export | follow-ups by others |
| `/teacher/advisory/referrals` | file/cancel/reopen referral, track | every downstream desk transition |
| `/teacher/advisory/adm-cases` + `[slug]` | module create/update, submit link, monitor | stage changes, meetings, devices, principal verdict/return |
| `/teacher/advisory/modules` | release/edit/delete modules, see submissions | **learner submissions** |
| `/teacher/advisory/sf10-access` | request access, verify code, view records | registrar/record-keeper decision |
| `/teacher/chat` | Bama assistant | local-only (`localStorage`), no server chat → no realtime needed |

---

## 2. How "realtime" actually works today

`useTeacherRealtime()` mounts in the shell (`frontend/src/app/teacher/layout.tsx:36`) and does **two** things:

1. **Supabase `postgres_changes` INSERT on `Notification`**, filtered `userId=eq.<sub>` (`frontend/src/lib/realtime/teacherChannel.ts:187-212`).
2. **Always-on HTTP fallback poll every 5 s** of `GET /api/notifications/` (`teacherChannel.ts:214-244`), dedup by notification id, max 3 toasts per tick.

Each notification triggers a toast (`toast.info`) plus targeted `queryClient.invalidateQueries`.

**Reality check:** `Notification` has RLS (`backend/prisma/migrations/0001_rls.sql:82-92`) and push only works when `NEXT_PUBLIC_SUPABASE_REALTIME_AUTH=true` (`frontend/src/lib/supabase/client.ts:9-10`). That flag is **not set in `frontend/.env.local`**, and the Supabase project secret must equal `JWT_ACCESS_SECRET`. In the current config the bell/desk is effectively **5-second polling**, not push. Everything below works either way, but true push is an ops switch, not a code switch.

### Update layers

| Layer | Meaning | Today |
|---|---|---|
| L0 | manual page refresh | fallback for most cross-page data |
| L1 | bell badge + toast | notification poll (5 s) |
| L2 | query invalidation (no reload) | partial — coarse/missing mappings |
| L3 | true push | blocked by realtime-auth flag |

---

## 3. Gaps and bugs (ordered by impact)

1. **Adviser Modules board doesn't update live.**
   Student submission fans out (`backend/src/services/student/modules.service.ts:226-235`, type `module_submitted`) and the server invalidates cache, but `advisory_module_submissions` matches no branch in `keysForNotification` → falls to `[]` → invalidates the global list, which **does not contain `["advisory-modules"]`** (`teacherChannel.ts:10-40`, `99-161`). The board stays stale until a manual refetch.

2. **Duplicate, drifted key registries.**
   `TEACHER_KEYS` in `teacherChannel.ts` is a stale copy of `TEACHER_QUERY_KEYS` in `frontend/src/app/teacher/components/use-teacher-invalidate.ts`. The channel lacks:
   `advisory-modules`, `teacher-schedule-conflicts`, `teacher-overview-gradebook`, `teacher-profile-settings`, `teacher-data-sharing`, `advisee-anecdotal`, `adm-monitoring`.

3. **Overview dashboard goes stale on most events.**
   `attendance_records` → attendance-only keys; `student_grades` → grading keys that omit `teacher-overview*`; `referrals`/`interventions` → referral/advisory keys only. Risk widgets, "up next", kanban and gradebook cards don't refresh even though a toast fired.

4. **ADM case detail doesn't refresh.**
   `adm_learner_profiles` / `adm_parent_meetings` / `adm_devices` match no branch → invalidate-all (which still omits `["adm-monitoring", caseId]`). Clicking the bell dead-ends: `teacherNotificationTarget` handles `adm_profiles` (legacy name) but not `adm_learner_profiles` (`frontend/src/lib/notifications/label.ts:316-345`).

5. **Assignment / class changes only refresh the schedule.**
   `teacher_subject_assignments` and `sections` map to schedule keys, but a new assignment also changes the gradebook list, attendance subject picker and overview classes.

6. **Lost invalidations.**
   `invalidate()` drops calls inside a 2 s window (`teacherChannel.ts:249-251`) instead of coalescing per scope. Two different events <2 s apart → the second never invalidates.

7. **Self-notification suppression is regex-based.**
   (`^you…`, referral wording) instead of the deterministic `*_self` types the server already produces (`backend/src/lib/notify.ts:7-104`). Brittle; easy to regress when message text changes.

8. **No deep link for many events.**
   `module_submitted`, `adm_*`, `student_roster`, self `attendance_records` rows → toast/bell rows are informational only.

9. **Poll payload / latency.**
   Fetches 15 rows with no `take`/`since`; bell list also capped at 15 with `VISIBLE_COUNT=5`. Fine for volume, but no "N new updates" grouping and no cross-tab consistency.

**Assessment:** pages are feature-complete; notification *fan-out* coverage is decent, but the **client routing of notifications to query keys is the weak layer** — coarse, duplicated, and missing the two panels an adviser watches most (Modules, ADM detail).

---

## 4. Proposed plan

### Phase 0 — decide the transport (≈0.5 day)

- Either enable `NEXT_PUBLIC_SUPABASE_REALTIME_AUTH=true` + align the Supabase JWT secret + confirm `Notification` is in the realtime publication, **or** accept polling.
- If push is enabled, raise the fallback poll to 30–60 s (safety net only) and keep the 5 s behaviour when it isn't. Add a one-line dev log when push subscribes.
- Do **not** add raw-table subscriptions for teacher tables: RLS policies key off `zentra_role()`, which the realtime token reports as `authenticated`, and the bell deliberately omits confidential text (e.g. referral reasons). Notification rows stay the single trigger.

### Phase 1 — one key registry, explicit routing (frontend only, ≈1 day)

- Move `TEACHER_QUERY_KEYS` / `TEACHER_SCOPE_KEYS` into `frontend/src/lib/realtime/teacherKeys.ts` (or import the existing helper) and add missing keys:
  `advisory-modules`, `adm` (incl. `adm-monitoring` prefix), `teacher-overview-gradebook`, `teacher-schedule-conflicts`, `advisee-anecdotal`, `teacher-profile-settings`, `teacher-data-sharing`. Delete `TEACHER_KEYS` from `teacherChannel.ts`.
- Replace prefix guessing with an explicit `type → scopes` map (fallback `sourceTable → scopes`, then a narrow safe default instead of invalidate-all).
- Per-scope throttling like `guidanceChannel.ts:78-96` (coalesce, never drop); flush on `focus`/`online`.
- Suppress toasts for `type.endsWith("_self")`; keep `markSelfNotified(sourceId)` only for the referral "Your referral … was submitted" echo.
- Poll with `?take=10&since=<lastSeen>`; if >3 new, one summary toast ("4 new updates") + invalidate.

### Phase 2 — close the missing live events (backend + frontend, ≈1 day)

Add/repair fan-outs and give each a type + target:

| Event | Recipient | Realtime effect |
|---|---|---|
| Learner submits advisory module (`module_submitted`) | adviser | toast "Module submitted — <learner> · <module>" → `/teacher/advisory/modules`; invalidate `advisory-modules` + advisory |
| ADM stage change / principal verdict / return | filing teacher **and** section adviser if different | invalidate `adm-my-cases` + `adm-monitoring`, target `/teacher/advisory/adm-cases?highlight=…` |
| Referral filed | destination desk + filer (today) — **decide** whether section adviser is added (reason text omitted, like the current policy) | referrals + overview |
| Anecdotal follow-up | observer (today) — optionally adviser for advisees | anecdote folders |
| New/removed subject assignment, section change | affected teacher(s) | invalidate gradebook list, attendance subjects, overview classes (not just schedule) |
| Finals approved / grades locked | teacher + adviser + registry (today) | grading + advisory academic + overview |

Also:
- Add missing `TYPE_MAP` entries for any new `table:action` in `backend/src/lib/notify.ts`.
- Add `teacherNotificationTarget` branches for `advisory_module_submissions`, `adm_learner_profiles`, `student_roster`, `attendance_records`.

### Phase 3 — UX + verification (≈1 day)

- Use `toast.action({ button: { title: "Open" } })` (sileo wrapper exposes it) for high-value events: ADM return, grade flag, referral update, SF10 decision. Keep plain `info` for low-value / self echoes.
- Bell: group by type/date, show "View all N" consistently, keep the unread badge from `/unread-count`.
- Two-browser acceptance script:
  1. student submits module → adviser board updates + toast without reload;
  2. principal returns ADM case → adviser detail stage changes live;
  3. adviser approves finals → teacher gradebook / finals card flips;
  4. registrar grants SF10 access → teacher SF10 page unlocks;
  5. subject teacher submits attendance → adviser attendance matrix updates;
  6. master unlocks attendance → teacher unlock banner appears.
- Add a pure-function Vitest for `keysForNotification` (type → scopes) so the map cannot silently drift.

### Explicit non-goals

- No student/parent desks (they don't exist; login 404s).
- No chat realtime (Bama is local `localStorage`).
- No raw-table Supabase subscriptions for teacher data (RLS / confidentiality).

---

## 5. Decisions (resolved 2026-11-04)

1. **Transport:** enable Supabase realtime auth (true push) — done in code/env; deploy env + Supabase JWT-secret alignment still required.
2. **Adviser visibility:** **no** cross-teacher adviser fan-out — a teacher can only file anecdotal records for their own advisees (adviser-only create route), and referral follow-ups already notify the observing adviser.
3. **Scope:** Phase 1 + Phase 2.
