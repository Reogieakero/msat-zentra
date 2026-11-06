# Principal — Role Capabilities Report

**System:** Zentra Student Information System (SIS)
**School:** Mati School of Arts and Trades
**Role:** `principal`
**Scope of report:** Frontend workspace available to a signed-in Principal, based on the `src/app/principal` module, shared shell, and API surface.

---

## 1. Workspace shell (shared across all pages)

The Principal lands in a persistent authenticated workspace (`principal/layout.tsx`) with:

- **Sidebar navigation** (`staff-sidebar.tsx`) — grouped nav with collapsible sub-items; modes: *Expand on hover*, *Expanded*, *Collapsible*.
- **Top bar** — global search (command palette input), brand link to Overview, and an **account menu** with:
  - Settings
  - **System Preference** → Light / Dark theme toggle (`next-themes`)
  - **Grade basis** selector → Final / Raw (affects academics & risk views via `GradeModeProvider`)
  - **Logout** → clears all `zentra.*` localStorage keys and returns to `/login`
- **Fluid background** on the auth/error surfaces (consistent brand backdrop).

---

## 2. Pages the Principal can view

Routes are defined under `src/app/principal`. All are gated by the Principal layout/session.

| # | Page | Route | What it shows |
|---|------|-------|---------------|
| 1 | **Overview** | `/principal/overview` | School KPIs (enrollment, active sections, teachers, anecdotals), browser preview, attendance heatmap, and an "Action Required" panel. Tabs: Anecdotal, Attendance, ADM, Reports. |
| 2 | **Academics** | `/principal/academics` | School-wide grades: section summary table, honor-roll preview, per-student subject bars, average grade by level, grade-breakdown drawer. Respects Final/Raw grade basis. |
| 3 | **Risk Board** | `/principal/risk` | School-wide early-intervention overview (KPIs, risk-level donut, trend chart, factor heatmap, outcome summary, low-risk list). Status-only view. |
| 4 | **Risk → Students** | `/principal/risk/students` | At-risk student roster with section heatmaps, KPI rail, factor breakdown, and a browsable student detail card. Persists last selected section. |
| 5 | **Risk → Heat Maps** | `/principal/risk/heatmaps` | Landing for heat-map views (Academic, Attendance, Records). |
| 5a | **Heat Map → Academic** | `/principal/risk/heatmaps/academics` | Academic risk heatmap. |
| 5b | **Heat Map → Attendance** | `/principal/risk/heatmaps/attendance` | Attendance risk heatmap. |
| 5c | **Heat Map → Records** | `/principal/risk/heatmaps/records` | Per-student record info panel. |
| 6 | **Risk → Interventions** | `/principal/risk/interventions` | Intervention tracking table with filters and a detail drawer. |
| 7 | **ADM Cases** | `/principal/adm` | Alternate Delivery Mode learner profiles; referral pipeline + case table. |
| 7a | **ADM → Referrals** | `/principal/adm/referrals/all` | All ADM referrals awaiting principal action. |
| 7b | **ADM → Approvals** | `/principal/adm/approvals/all` | Every final-signed learner profile for review. |
| 8 | **Honor Roll** | `/principal/honor-roll` | Derived honor-roll candidates by grade/tier, leaderboard, award categories, candidate table; exportable. |
| 9 | **Reports** | `/principal/reports` | Analytics command center (school scope) with KPIs and report panels; refreshable. |
| 10 | **Audit Log** | `/principal/audit` | Full audit trail with filtering by action type, actor role, actor scope, source table, and free-text search; paginated; CSV export. |

---

## 3. What the Principal can DO

### Navigation & preferences
- Switch sidebar display mode (hover / expanded / collapsible).
- Toggle Light/Dark theme.
- Switch **Grade basis** between Final and Raw — propagates to Academics and Risk views.
- Global search across the workspace.
- Log out (clears session/local storage).

### Overview
- View school KPIs and an "Action Required" summary.
- Switch between Anecdotal / Attendance / ADM / Reports preview tabs.

### Academics
- Browse sections, students, and subject grades.
- Open the **grade-breakdown drawer** for a student.
- Inspect honor-roll preview and average grades by level.
- (Read-only leadership view — encoding is done by teachers/advisers.)

### Risk Board & Students
- Review school-wide and per-student risk (Academic / Attendance / Behavioral factors).
- Filter/select sections; view heatmaps and intervention lists.
- Open student detail cards (status-only).

### ADM (Alternate Delivery Mode) — approval authority
This is the Principal's key **write** capability:
- **Final-sign / approve** an ADM referral → `POST /api/adm/{id}/principal-approve`
  - Authorizes module release and moves the case to *enrollment monitoring*.
- **Return** a referral to the ADM Coordinator → `POST /api/adm/{id}/principal-return`
  - Confirmed via an alert dialog ("Confirm Return").
- Review the referral pipeline stages and open case folders.

### Honor Roll
- View derived candidates by grade and award tier.
- Open award-category and candidate detail sheets.
- **Export** the candidate list (logged action; export hook present).

### Reports
- View school-scope analytics and KPI panels.
- **Refresh** report data on demand.

### Audit Log
- Filter by action type, actor role, actor scope, and source table.
- Free-text search and paginate entries.
- **Export audit entries to CSV** → `exportAuditCsv(...)`.

---

## 4. Data the Principal CANNOT modify here (by design)

The Principal workspace is **leadership/oversight-oriented**, not transactional:

- No grade encoding or final-locking (teacher/adviser/registrar tasks).
- No attendance taking or anecdotal writing.
- No learner-record creation/edits (handled by guidance/ADM/nurse per O1 confidentiality).
- Audit log is **read-only** (view/export only; no edit or delete).
- Reports and Risk views are **status-only** — no mutations.

The one explicit mutation path is **ADM principal approval / return**, which is the Principal's signed authorization step in the ADM workflow.

---

## 5. Error / edge states

- Async pages show **skeleton loaders** while fetching and a clear **error state with retry** (not raw stack traces).
- API 401 (session expired) is redirected to the branded **403 "Access restricted"** page (`/errors/403`); other unhandled errors route to `/errors/[code]`.
- Logout and re-auth both clear the persisted `zentra.*` keys.

---

## 6. Summary

| Dimension | Principal |
|-----------|-----------|
| Primary role | School-wide oversight & approval |
| Pages | 10 top-level areas + 6 sub-routes (heatmaps, ADM referrals/approvals) |
| Read | Overview, Academics, Risk (board/students/heatmaps/interventions), ADM cases, Honor Roll, Reports, Audit |
| Write | ADM final-sign (approve) and return only |
| Export | Honor Roll candidates, Audit Log (CSV) |
| Preferences | Theme, grade basis (Final/Raw), sidebar mode |
| Restricted from | Grade encoding, attendance, record edits, audit mutation |

*Report generated from the frontend source under `src/app/principal` and shared shell/components. Backend enforcement of these permissions is defined in `backend/src/middleware/auth.ts` (`requireRole("principal")`).*
