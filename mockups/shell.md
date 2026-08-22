# App Shell — Shared Layout

Used by every web role. Role determines which nav items appear (from `docs/role-modules`).

## Layout
```
┌──────────────┬───────────────────────────────────────────────────────────┐
│              │  topbar: [search ⌘K]      [school year ▾]   [🔔] [avatar] │
│   SIDEBAR    ├───────────────────────────────────────────────────────────┤
│   (240px)    │                                                             │
│              │                      PAGE CONTENT                          │
│  ░ logo ░    │                                                             │
│  Zentra      │                                                             │
│              │                                                             │
│  • nav item  │                                                             │
│  • nav item  │                                                             │
│    └ sub     │                                                             │
│  • nav item  │                                                             │
│              │                                                             │
│  ───────     │                                                             │
│  [role tag]  │                                                             │
│  Principal   │                                                             │
└──────────────┴───────────────────────────────────────────────────────────┘
```

## Sidebar (shadcn `Sheet`/`NavigationMenu`)
- Width 240px, bg `#FAFAF9`, right 1px border `#E7E5E4`. No gradient, no color fill.
- Logo: square mark (school initial) + "Zentra" in display font. Muted, not loud.
- Nav items: `rounded-md`, active = brand-accent left bar (3px) + tinted bg.
  Icon (lucide) left, label right. No icons-only collapsed mode by default.
- Bottom: role tag (e.g. "Principal · hardcoded") + avatar.

## Topbar (shadcn)
- Left: `cmdk` Command palette trigger "Search…  ⌘K".
- Right: school-year/term `Select` (Principal/Registrar only), `sonner` bell
  (badge = unread count from `notifications`), avatar menu (profile, logout).

## Page frame
- Max-width container, 24px padding, 8px grid.
- Page title (display font, stone-900) + subtitle (stone-500) + action row (right).
- Sticky page sub-header on long tables.

## Role → nav items (from role-module specs)
| Role | Nav items |
|---|---|
| Principal | Dashboard, School Years, Academic Perf, Risk & Intervention, ADM Approvals, Honor Roll, Reports, Audit Log, Notifications |
| Adviser | Home, Attendance, Grades, Anecdotals, ADM Tracking, My Advisees, SF10, Notifications |
| Subject Teacher | Grades, My Classes, Notifications |
| Guidance | Anecdotals, Referrals, Home Visits, Interventions, Risk, Notifications |
| Nurse | Health Records, Referrals, Interventions, Notifications |
| ADM Coord | ADM Profiles, Referrals, Meetings, Modules, Devices, Notifications |
| Record Keeper | Accounts(7–10), SF10, Grades Inbox, Notifications |
| Registrar | Accounts(11–12), SF10, Grades Inbox, Notifications |
| Student | My Grades, Attendance, ADM Status, Risk, Timeline, Notifications |
| Parent | Child Performance, Attendance, Interventions, Notifications |
