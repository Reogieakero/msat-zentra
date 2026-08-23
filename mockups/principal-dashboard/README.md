# Principal Dashboard — HTML/Tailwind Mockup

A static, **self-contained** mockup of the Principal home/dashboard so you can visualize the
spec in `docs/role-modules/principal.md` (Module 1). Built with the **same design language**
as the real Zentra frontend (PLAN.md §2) so it stays consistent when the actual app is built.

## Files
| File | Purpose |
|---|---|
| `index.html` | Full dashboard layout: sidebar, top bar (year/term/grade filters), KPI row, risk heat map, action-required rail, recent notifications. |
| `styles.css` | Design tokens + reusable component classes (`card`, `kpi-*`, `hm-*` heat shades, nav). Comments map each token to PLAN.md §2. |
| `app.js` | Populates the heat-map matrix and notification list from sample data (counts only, no student names). |

## Run it
No build step. Open `index.html` directly in a browser, or serve the folder:
```bash
# from this folder
python -m http.server 4173
# then visit http://localhost:4173
```
Tailwind is loaded via CDN (`cdn.tailwindcss.com`) so the config + tokens apply immediately.

## Design consistency with the real project
- **Colors:** soft off-white `#FAFAF9` background, stone/zinc neutrals, ONE brand accent
  (deep green `#2f7161`). No multi-color gradients, no gradient text.
- **Shape:** `rounded-md` (not xl), 1px `#e7e5e4` borders, low-opacity shadow only on modals.
- **Type:** Space Grotesk (display) + Inter (body) + IBM Plex Mono (IDs/grades/counts).
- **Density:** data-dense, sticky-header-ready tables, monospaced numbers.
- **Motion:** micro only (140ms ease-out) — see `prefers-reduced-motion` guard in `styles.css`.

> These tokens live in **two places** on purpose: the Tailwind `config` block in `index.html`
> and the CSS variables in `styles.css`. Keep them in sync when porting to the Next.js app
> (shadcn/ui + Tailwind scoped to UI components per PLAN.md §2).

## What it shows (matches the spec)
- **KPI cards:** Total Students, Students by Risk (High/Moderate/Low), Attendance Avg, Term Progress — each drills down in the real app.
- **Risk Heat Map:** a **section × risk-factor matrix** (Academic / Attendance / Behavioral), cells = student **counts** (NOT a GitHub-style calendar). Hover a cell → outlines; click → would route to Risk & Early Intervention (status-only).
- **Action Required rail:** ADM signatures pending + account approvals routed (grade-banded RK 7–10 / Registrar 11–12).
- **Recent Notifications:** typed list (`new_adm_case`, `account_approval`, `intervention_approved`, `sf10_validated`, `audit_alert`).

Confidential detail columns (diagnosis, incident write-ups, ADM eligibility reasons) are
intentionally **not present** — the Principal sees status only, per O1.
