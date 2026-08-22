# Principal — Dashboard Mockup

Source: `docs/role-modules/principal.md` module 1. School-wide, calm overview (low density).

## Layout
```
┌──────────────┬───────────────────────────────────────────────────────────┐
│  SIDEBAR     │  Dashboard                                      [term ▾][↻]│
│  Principal   ├───────────────────────────────────────────────────────────┤
│              │                                                           │
│  Dashboard ● │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                    │
│  School Yrs  │  │Students│ │ High │ │ Mod  │ │ Avg  │  (KPI cards)      │
│  Acad Perf   │  │ 1,240 │ │  86  │ │ 210  │ │Att 92%│                    │
│  Risk & Int  │  └──────┘ └──────┘ └──────┘ └──────┘                    │
│  ADM Approv  │                                                           │
│  Honor Roll  │  ┌─────────────────────────┐ ┌─────────────────────────┐│
│  Reports     │  │ Risk heat map           │ │ Pending your action     ││
│  Audit Log   │  │ (section × factor)      │ │ • 12 ADM certs unsigned ││
│  Notif       │  │ [heatmap cells]         │ │ • 3 acct approvals (RK) ││
│              │  └─────────────────────────┘ └─────────────────────────┘│
│              │                                                           │
│              │  Recent notifications (list, 5 rows)                     │
└──────────────┴───────────────────────────────────────────────────────────┘
```

## Components (shadcn, Tailwind scoped)
- KPI cards: `Card` (white, 1px border, `rounded-md`), `Lucide` icon in brand accent,
  number in display font + monospaced for counts. No shadow.
- Heat map: `recharts` (or CSS grid of cells, color = risk count). Cells use restrained
  red/amber/green, not neon.
- "Pending your action": `Card` with `Button` (variant=default, brand accent) → drill down.
- Notifications list: `sonner`-style rows, mark-read inline.

## Actions (✎ from spec)
- Filter KPIs by school year / term / grade.
- Click KPI card → navigate to module page.
- Mark notification read.

## Anti-generic notes
- Off-white bg, bordered cards (no floating shadow), one accent. No hero, no gradient.
- Numbers monospaced; headings display font. Calm density (Principal = overview).
