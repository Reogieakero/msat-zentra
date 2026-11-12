# Guidance — Schedule (calendar) page

**Status:** implemented
**Date:** 2026-11-12
**Desk:** Guidance Counselor (`/guidance/schedule`)

## Goal

A Google-Calendar-style page on the guidance desk that shows every **booked
schedule** in one place:

| Track | Source | Time field |
| --- | --- | --- |
| Intervention | `CounselingSession` with `interventionId` (plan booked on an at-risk follow-up) | `scheduledAt` |
| Counseling | `CounselingSession` with `referralId`, referral is a counseling referral | `scheduledAt` |
| ADM case | `CounselingSession` with `referralId`, referral referred/escalated to `adm_coordinator` | `scheduledAt` |
| ADM parent meeting | `AdmParentMeeting` (coordinator books; guidance is often an invitee) | `meetingDatetime` |

Read-only in v1: the calendar shows the truth and deep-links into the existing
desks. Booking stays in the tested dialogs (`BookSessionDialog`,
`intervention-schedule-dialog`, referral booking dialogs) so slot rules,
notifications and desk sounds are not duplicated.

## Decisions

- **ADM parent meetings are a 4th track.** They are the actual scheduled ADM
  event (guidance is a named invitee) and already appear in the counselor's
  `GET /api/my-sessions/upcoming` list. Meetings render with a dashed edge to
  separate them from counselings sessions on the same track color family.
- **No in-calendar booking (v1).** Event detail offers "Open case" links:
  - intervention → `/guidance/interventions?q=<LRN>`
  - counseling / ADM → `/guidance/referrals/{counseling|adm}?highlight=<referralId>`
  - parent meeting → `/guidance/referrals/adm?highlight=<referralId>`
- **Timezone:** events render in the browser's local time (what the booking
  dialogs create). The request range is sent as full ISO instants, so a month
  boundary never clips a session. (`getDaySchedule`'s UTC day bounds remain as
  they are; see "Follow-ups".)

## Backend

### `backend/src/services/guidance/schedule.service.ts`

New `getCalendar(ctx, { from, to, status })`:

- Validates `from`/`to` (parseable, `from <= to`, span ≤ 62 days).
- Term scope exactly like the rest of the desk: `referral.termId` /
  `intervention.termId` / `admLearnerProfile.termId` = the server-resolved
  active term.
- Desk scope identical to `nav-counts` (`guidance_counselor`, plus
  `adm_coordinator` with a guidance/null consult reviewer).
- One `counselingSession.findMany` + one `admParentMeeting.findMany`, ordered by
  start, capped at `INTERNAL_AGGREGATE_ROW_CAP`.
- `status: "scheduled"` hides completed/cancelled sessions and attended
  meetings; `"all"` returns everything.
- Returns:

```ts
{
  range: { from, to },
  status: "all" | "scheduled",
  counts: { intervention, counseling, adm, adm_meeting },
  events: [{
    id: `session:<id>` | `meeting:<id>`,
    track, learner, lrn, section, sessionType,
    start: ISO, venue, status, outcome,
    referralId, interventionId, admProfileId,
    invited: boolean | null,   // meetings only
  }]
}
```

### `backend/src/modules/guidance/schedule.routes.ts`

`GET /api/guidance/calendar?from&to&status` — `requireAuth` +
`requireRole("guidance_counselor")`, `cache({ tags: [guidance, referrals,
interventions], ttl: CACHE_TTLS.list })` + `etag()`.

## Frontend

- `frontend/src/services/guidance/calendar.service.ts` — event types +
  `fetchGuidanceCalendar`.
- `frontend/src/app/guidance/schedule/page.tsx` — URL-synced
  `?view=month|week&date=YYYY-MM-DD`; track filter chips (with counts), status
  toggle, skeleton/error/empty states.
- `frontend/src/app/guidance/schedule/components/`
  - `calendar-month.tsx` — Mon-first 6-week grid, today ring, up to 3 chips per
    day + `+N more`.
  - `calendar-week.tsx` — 06:00–20:00 time grid, blocks positioned by minutes
    (1h default duration), lane packing for overlaps.
  - `calendar-day-rail.tsx` — selected-day agenda + event detail + "Open case".
  - `calendar-toolbar.tsx` — month/week title, prev/today/next, view toggle,
    filters.
  - `guidance-calendar.module.css` — CSS Modules, rounded-md, 1px borders, one
    accent, 120–180ms motion.
- `frontend/src/components/guidance-sidebar.tsx` — `Schedule` entry in the
  Overview group (`NAV_ICONS.schedule` = `CalendarDays`, already exists).
- `frontend/src/app/guidance/overview/components/use-guidance-mutation.ts` —
  add `["guidance-calendar"]` to `GUIDANCE_QUERY_KEYS` and to the `referrals`,
  `interventions` and `adm` scopes.
- `frontend/src/lib/realtime/guidanceChannel.ts` — Referral / Intervention /
  CounselingSession / AdmLearnerProfile frames and `adm_parent_meetings`
  notifications also invalidate the calendar key. The 15s
  `guidanceLiveQueryOptions` poll is the fallback for `AdmParentMeeting`, which
  is not a published realtime table.

## Out of scope / follow-ups

- Click-empty-slot booking (v2).
- Rendering completed/cancelled sessions from previous terms (desk is
  term-scoped by design).

## Redesign pass (2026-11-12)

- The board now renders inside the shared `KanbanBoard` shell, with the same
  `Pill` chips + tooltips the other guidance desks use for filters.
- One accent colour per track: intervention = blue, counseling = violet,
  ADM case = amber, ADM parent meeting = teal (dashed edge). The toolbar filter
  pills double as the legend and carry the per-track counts.
- Learner / LRN / section search sits in the board header and filters the grid
  and the day rail instantly (client-side).
- Sidebar dot: `/api/guidance/nav-counts` gained a `schedule` queue built from
  the booked sessions + ADM parent meetings (start / status / kind / venue as
  the version), so a new booking, reschedule, cancellation or attendance log
  lights the Schedule nav icon until the counselor opens the page.
- Live updates: the page keeps `guidanceLiveQueryOptions` (15s, also while
  hidden), the shell's nav-counts diff invalidates `guidance-calendar` within
  its 5s poll (this is what covers `AdmParentMeeting`, which is not a published
  realtime table), and the guidance realtime channel invalidates on
  Referral / Intervention / CounselingSession / AdmLearnerProfile frames plus
  `adm_parent_meetings` notifications. The `/api/guidance/calendar` cache TTL
  is 4s so a poll can never serve a pre-booking payload for long.

