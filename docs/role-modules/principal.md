# Principal — Web Role Module Specification (Complete Reference)

> **Purpose:** A single, comprehensive reference for the **Principal** role in Zentra.
> Covers every web module page, what the Principal can *see*, what they can *do*, what they
> are *denied*, the **Settings** area, and the cross-cutting confidentiality rules.
>
> **Grounded in:** `PLAN.md` §4.2 (RBAC) and §4.3 (confidentiality tiering — row-level +
> app hides fields). The Principal has **school-wide visibility** but a **status-only** view
> into confidential cases (ADM, Nurse, Guidance) — the diagnosis / treatment / intervention
> *detail* columns are NEVER sent to the client.
>
> **Legend used throughout:** 👁 visible · ✎ action allowed · 🔒 denied / hidden.
>
> **Account facts:** Role = `principal` (single hardcoded account, no self-registration,
> created/seeded by admin). JWT carries `role` claim; every module page gates on
> `requireRole('principal')`.

---

## 0. At-a-Glance — Can Do / Cannot Do

### ✅ What the Principal CAN do
- View school-wide dashboards, KPIs, risk heat maps, and trends.
- Manage **school years & terms** (create year/term, set active year, edit future dates).
- View school-wide academic performance and drill into any student's grade breakdown.
- View the **Risk & Early Intervention** board at **status level** (counts, outcome, recommended/approved action only).
- **Final-sign ADM referrals / certifications** (digital signature) and reject/return them.
- View the **Honor Roll** candidate list and export it.
- View & refresh **Reports & Visualizations** (trends, intervention success, heat maps).
- Read the **school-wide Audit Log** and export it.
- Read & manage own **Notifications** (mark read).
- *(Visibility only)* See the account-approval trail for Record Keeper / Registrar.

### 🔒 What the Principal CANNOT do
- See confidential **detail columns** of ADM / Nurse / Guidance records (diagnosis, treatment, incident write-ups, home-visitation findings, eligibility reasons). Status only.
- Create, edit, approve, or modify **interventions** (Guidance Counselor / Nurse scope).
- Edit, lock, unlock, or modify **individual grades** (Teacher / Registrar scope).
- Issue, return, or track **ADM devices** (ADM Coordinator scope).
- Evaluate ADM **eligibility** or record ADM **parent meetings** (ADM Coordinator scope).
- **Approve student/parent/teacher accounts** directly (Record Keeper → Grades 7–10, Registrar → 11–12).
- Edit or delete **audit log** rows (immutable system events).
- Compose **broadcast notifications** (not a Principal permission in current spec).
- Modify grades to change **honor-roll eligibility** (computed live; not editable).
- Delete a school year that has **locked grades or active enrollments**.

---

## Module Page Index

1. Dashboard (school-wide)
2. School Year & Term Management
3. Academic Performance (school-wide)
4. Risk & Early Intervention (school-wide)
5. ADM Referrals & Approvals (status-only + final sign)
6. Honor Roll & Awards
7. Reports & Visualization
8. Audit Log
9. Notifications
10. Account Approvals (Record Keeper / Registrar grade-banded — visibility only)
11. **Settings (Principal profile & preferences)**

---

## 1. Dashboard (school-wide)

The landing page after login. A calm, overview-first workspace (per the design language: Principal = calm overview, not task-dense). Everything is aggregated across the **whole school**, not a single section.

**What is seen**

*KPI cards (top row, each a clickable tile that drills down):*
- 👁 **Total Students** — count of `student_profiles` enrolled in the active school year/term. Shows a small delta vs. previous term if enrollment changed.
- 👁 **Students by Risk Level** — three sub-counts: **High** (risk_count ≥ 2), **Moderate** (risk_count = 1), **Low** (risk_count = 0). Each count links to Module 4 filtered to that level. Computed live from `student_profiles.risk_level`.
- 👁 **Attendance Average** — school-wide mean attendance rate = Σ(present sessions) / Σ(present+absent+late+excused) over AM/PM sessions in the active term. A subtitle shows how many sections fall below the 80% risk threshold.
- 👁 **Term Progress** — a progress bar = (days elapsed in active term) / (term length). Derived from `terms.start_date` / `end_date` of the currently active `school_year`.

*Risk heat map (mid page):*
- 👁 A **grid / color-shaded matrix** — this is **NOT** a GitHub-style contribution calendar. It is a **section × risk-factor matrix**:
  - **Rows** = each `section` (e.g., Grade 7-A, 7-B, 8-A … 12-C) in the active term.
  - **Columns** = the three risk factors the engine evaluates: **Academic** (overall average < 75), **Attendance** (rate < 80%), **Behavioral** (≥ 1 anecdotal record).
  - **Cell value** = the **count** of students in that section flagged on that factor (no student names — counts only, to protect privacy at the card level).
  - **Shading** = intensity by count (light → dark). Darker cell = more students in that section flagged for that factor.
  - *Example:* row "Grade 9-B", column "Attendance" shaded dark = 14 of its students have attendance < 80%. Clicking the cell opens Module 4 pre-filtered to Grade 9-B + Attendance factor.
- 👁 This is sourced from `report_snapshots` (type=`heat_map`) and falls back to a live aggregate query if the snapshot is missing/stale (O6).

*Action-required panel (right rail):*
- 👁 **ADM referrals awaiting your signature** — count + list of `adm_learner_profiles` where `approved_by` is null and `eligibility_status = eligible`. Each links to Module 5.
- 👁 **Account approvals routed** — count of pending `users` (status=`pending`) whose grade band maps to Record Keeper (7–10) or Registrar (11–12). Read-only; links to Module 10.
- 👁 **Recent notifications** — last 5 items from `notifications` for the Principal (type, short message, relative time). Links to Module 9.

**Actions**
- ✎ **Filter the whole dashboard** by school year / term / grade level — re-computes every KPI card, the heat map, and the action panel.
- ✎ **Drill down** — click any KPI card or heat-map cell → navigates to the matching module page with the same filter applied.
- ✎ **Mark a notification read** directly from the recent list.

---

## 2. School Year & Term Management

The academic calendar backbone. Every grade, enrollment, and downstream record hangs off a `school_year` → `terms` spine (PLAN.md §3.2). Only the Principal can create/activate years and terms.

**What is seen**
- 👁 **School year list** — each `school_year` row shows: `name` (e.g., "SY 2026–2027"), `start_date`, `end_date`, and an **Active** badge on the one currently active. Years are sorted newest-first.
- 👁 **Term tree** — under each year, its `terms` (1–3) each showing `term_number` (Term 1/2/3), `start_date`, `end_date`. A lock icon marks a term whose `school_year` is currently active (its dates are protected from edit).
- 👁 **Enrollment indicator** — per year, a hint of whether it has locked grades or active enrollments (drives the delete restriction in Actions).

**Actions**
- ✎ **Create school year** (`POST /api/school-years`) — opens a form for `name`, `start_date`, `end_date`; on save sets `created_by` = Principal and writes an `audit_logs` row.
- ✎ **Create term under a year** — form for `term_number` (1–3, must be unique per year), `start_date`, `end_date`; enforces UNIQUE(school_year_id, term_number).
- ✎ **Set a year active / inactive** — radio/toggle; the system enforces **exactly one active year** at a time (activating one deactivates the previous).
- ✎ **Edit dates** of a **future (non-active)** year/term only.
- 🔒 **Delete a school year** that has locked grades or active enrollments — **denied** (data integrity guard).

---

## 3. Academic Performance (school-wide)

A read-only analytics view of grades across the school. Built from `final_grades` (computed_average, transmuted_grade, remarks) — the Principal sees aggregates and breakdowns but never edits scores.

**What is seen**
- 👁 **Grade/section summary table** — one row per section (or per grade if filtered up). Columns:
  - `Section` · `Grade Level` · **Avg Transmuted Grade** (mean of `final_grades.transmuted_grade` across students/subjects) · **Pass %** (share with `remarks = Passed`) · **Fail %** · **# At-Risk** (students with `risk_level` High/Moderate).
- 👁 **Pass/Fail distribution** — a stacked bar or donut per grade/section showing Passed vs Failed counts from `final_grades.remarks`.
- 👁 **Student list** (expand a section) — columns: `LRN`, `Student Name`, `risk_level` (badge), **Overall Average** (term mean of transmuted grades), **Attendance Rate %**. No anecdotal/health/SF10 write-ups appear here.
- 👁 **Honor-roll candidate preview** — a compact read-only strip of students meeting the O5 rule (see Module 6), linking to the full Module 6 list.

**Actions**
- ✎ **Filter** by grade / section / term / subject — re-renders the summary table and distributions.
- ✎ **Open a student's grade breakdown** — a detail drawer showing, per subject: the components (Written Work / Performance Task / Quarterly Exam with weights), the assessments under each, the computed average, the **DepEd-transmuted grade**, and `remarks`. This is view-only.
- ✎ **Export** the performance report as CSV or PDF at school, grade, or section scope.
- 🔒 **Edit or lock individual grades** — denied (Teacher/Adviser encode; Registrar approves locks).

---

## 4. Risk & Early Intervention (school-wide)

The early-warning cockpit. Built from the live risk engine (PLAN.md §6.3) and `interventions` — but the Principal sees **status only**, never the confidential source write-ups.

**What is seen**
- 👁 **Student risk table** — columns: `Student`, `Section`, `risk_level` (High/Moderate/Low badge), `risk_count` (0–3), and which **factors** fired (Academic / Attendance / Behavioral chips). Sourced live from `student_profiles`.
- 👁 **Risk trend line (per student)** — when a student is opened, a small line chart of `risk_snapshots` over terms showing the Low→Moderate→High progression (or improvement). Answers "is this student getting worse or better?"
- 👁 **Intervention board (status level only)** — rows from `interventions` showing: `Student`, `risk_level_at_flag` (snapshot), `approval_status` (pending/approved/rejected/modified), `outcome_status` (ongoing/resolved/unresolved), and the **recommended_action / approved_action text** (the *what was planned*, not the clinical why).
  - 🔒 The **source detail is hidden**: `anecdotal_records.description_of_incident`, `health_records.diagnosis`/`treatment_given`, `home_visitation_records` findings are stripped server-side (O1). The Principal sees *that* an intervention exists and its status — not the confidential incident behind it.
- 👁 **Risk heat map** — same **section × risk-factor** matrix described in Module 1 (Academic / Attendance / Behavioral counts per section), sourced from `report_snapshots` type=`heat_map`. This is the focused, filterable version of the dashboard heat map.

**Actions**
- ✎ **Filter** by risk level / grade / section / term.
- ✎ **View intervention outcome summary** — aggregate counts: ongoing / resolved / unresolved, shown as a stat row or small bar.
- ✎ **Open a read-only intervention detail** — shows action + outcome text only; a banner states "Confidential source hidden — status-only view."
- 🔒 **Create / modify / approve an intervention** — denied (Guidance Counselor / Nurse scope).

---

## 5. ADM Referrals & Approvals (status-only + final sign)

ADM = Alternative Delivery Mode (DepEd). The Principal is the **final authority** who digitally signs certifications, but sees the pipeline **status-only** — never the eligibility reasoning or clinical detail.

**What is seen**
- 👁 **ADM pipeline status board** — one row per `adm_learner_profiles`, tracing the state machine (PLAN.md §6.4):
  `referrals` (initiated) → `adm_learner_profiles.eligibility_status` (pending/eligible/ineligible) → `adm_parent_meetings.attended` (yes/no) → `adm_modules` (release/due/submitted) → `adm_devices` (issued/returned).
  - **Visible columns:** Student, Grade/Section, current **stage**, `eligibility_status`, **meeting attended?** (✓/✗), **modules submitted** (n/total), **device issued?** (✓/✗), and **Principal Sign** state (Pending / Signed with `approval_date`).
  - 🔒 **Hidden columns (O1):** `adm_learner_profiles.reasons_for_adm`, `intervention_result`, `home_visitation_records` findings, `health_records` detail. The Principal sees the stage and status — not the confidential justification.
- 👁 **Signature pending flag** — rows where `approved_by` is null and `eligibility_status = eligible` are badged "Awaiting your signature."

**Actions**
- ✎ **Review** the status board (filter by stage / grade / signature state).
- ✎ **Final-sign** an ADM certification (`POST /api/adm/:id/principal-approve`) — sets `adm_learner_profiles.approved_by` = Principal + `approval_date`, writes an `audit_logs` row (`action_type=adm_edit`), and fires a `new_adm_case`/completion notification. This is the Principal's **digital signature** — the only mutating action on this page.
- ✎ **Reject / return for revision** — sets status back to ADM Coordinator with a reason (also audited).
- 🔒 **Edit eligibility, issue/return devices, record parent meetings** — denied (ADM Coordinator scope).

---

## 6. Honor Roll & Awards

Read-only recognition list, computed live from `final_grades` using the DepEd rule (O5). The Principal reviews and can publish, but cannot alter the underlying grades.

**What is seen**
- 👁 **Candidate table** — students meeting: term **transmuted average ≥ 90** AND **no subject < 75** (no failing grade). Columns: `Student`, `Section`, **Term Average** (transmuted), and a per-subject mini-grid showing each `transmuted_grade` (failing ones < 75 highlighted so you can see *why* a student is excluded).
- 👁 **Award categories** — a placeholder section for school-defined awards (e.g., "Perfect Attendance", "Subject Toppers") — configured by the school, not computed by Zentra yet.

**Actions**
- ✎ **Filter** by term / grade / section.
- ✎ **Export** the honor-roll list (CSV/PDF) — useful for printing certificates.
- ✎ **Mark as awarded** — if the school workflow has a publish step, the Principal can flag candidates as awarded (no grade change; pure status).
- 🔒 **Modify grades to change eligibility** — denied (grades are teacher/registrar-owned; eligibility is computed).

---

## 7. Reports & Visualization

The consolidated analytics library. Each report reads from `report_snapshots` (cached aggregates, O6) and falls back to a live query when a snapshot is missing/stale.

**What is seen**
- 👁 **Performance Trends** (type=`trends`) — a **line chart of term-over-term average grades**: x-axis = terms (Term 1 → 2 → 3 across years), y-axis = average transmuted grade, with one line per scope (school / grade / section). Answers "are grades trending up or down?"
- 👁 **Intervention Success Rate** (type=`intervention_success`) — a **ratio/bar**: `outcome_status = resolved or ongoing` ÷ total `interventions` referred, optionally split by grade. Shows how many referred students are improving.
- 👁 **Heat Maps** (type=`heat_map`) — the **section × risk-factor** matrix (Academic / Attendance / Behavioral counts) described in Modules 1 & 4, rendered at the chosen scope.
- 👁 **Honor Roll** (type=`honor_roll`) — the O5 candidate snapshot for the selected term/scope.
- 👁 **Live fallback banner** — if a snapshot is stale/missing, a note shows "Live data — snapshot regenerating" so the Principal knows the numbers are computed on the fly.

**Actions**
- ✎ **Select report type + scope** (school / grade / section) **+ term**.
- ✎ **Refresh a snapshot on demand** (`POST /reports/refresh` or in-page button) — regenerates the `report_snapshots.payload` for the current selection.
- ✎ **Export** the current report (CSV/PDF/PNG of chart).

---

## 8. Audit Log

The tamper-evident trail of every sensitive action in the system (PLAN.md §8). School-wide, read-only to the Principal.

**What is seen**
- 👁 **Audit table** — columns: `timestamp`, `user` (actor, from `users`), `action_type`, `source_table`, `source_id`, `reason` (free-text the actor entered), and expandable **old_value / new_value** JSON (the before/after of the change).
  - *Example row:* `2026-08-21 09:14 · adviser.jdelacruz · grade_lock · final_grades:id=882 · reason="Term close" · old:{lock_status:unlocked} → new:{lock_status:locked, locked_by:…}`.
- 👁 **Covered action types:** sf10_update, grade_lock, grade_unlock, anecdotal_edit, health_record_edit, home_visitation_edit, adm_edit, referral_status_change, intervention_approval, account_approval, role_change.
  - Note: these are **system events**, not confidential clinical write-ups — so old/new JSON is visible to the Principal (unlike the hidden ADM/health columns elsewhere).

**Actions**
- ✎ **Filter** by action_type / user / date range / source_table.
- ✎ **Export** the filtered audit extract (CSV).
- 🔒 **Edit or delete** audit rows — denied (immutable by design).

---

## 9. Notifications

The Principal's personal inbox (web channel). Driven by `notifications` (PLAN.md §3.8), with `type` generated by the service layer (O7).

**What is seen**
- 👁 **Notification list** — each item: `type` (icon + label), `message` (human-readable), `source` (which module/record triggered it), `timestamp`, and read/unread state.
- 👁 **Trigger examples relevant to Principal:**
  - `new_adm_case` — an ADM profile is ready for your signature.
  - `account_approval` — a pending account was routed to Record Keeper/Registrar.
  - `intervention_approved` — a Guidance/Nurse intervention was approved.
  - `sf10_validated` — an SF10 was validated by RK/Registrar.
  - `audit_alert` — a notable audited action occurred.
  - `referral_status_change` · `new_followup` — pipeline movement.

**Actions**
- ✎ **Mark read / mark all read**.
- ✎ **Filter** by type / date.
- 🔒 **Compose broadcast** — denied (not a Principal permission in current spec).

---

## 10. Account Approvals (Record Keeper / Registrar grade-banded — visibility only)

A transparency view into who is being activated. The Principal **cannot approve** — that is grade-banded to Record Keeper (7–10) and Registrar (11–12).

**What is seen**
- 👁 **Pending approvals list** — `users` with `status = pending`: columns `full_name`, `role` (student/parent/teacher), **grade band** (derived from linked student grade_level: 7–10 → Record Keeper, 11–12 → Registrar), and `approved_by` / `approved_at` once acted on.
- 👁 **Approval trail** — for already-approved accounts, who approved and when (mirrors the `account_approval` audit entries).

**Actions**
- 🔒 **Approve accounts directly** — **denied**. The Principal has visibility only; the actual approval is `POST /api/auth/approve/:userId` by Record Keeper/Registrar with grade-band enforcement. The Principal can see the trail via this page and the Audit Log (Module 8).

---

## 11. Settings (Principal profile & preferences)

> This page is the Principal's own self-service area. It is **not** an administrative console for other users.

### 11.1 Profile
**What is seen**
- 👁 Own profile read-out: full name, email, contact number, role badge (`principal`), account status (active).
- 👁 Assigned school context (Mati School of Arts and Trades, Grades 7–12).

**Actions**
- ✎ Update own `contact_number` (if editable by self).
- ✎ Change own password (bcrypt re-hash; requires current password).
- 🔒 Change own `role`, `email`, or `status` — these are admin/hardcoded; denied.
- 🔒 Edit other users' profiles — denied.

### 11.2 Preferences
**What is seen**
- 👁 Notification channel toggles (web / mobile / email) for the Principal's own account.
- 👁 Default dashboard scope (school year / term / grade level) used to pre-filter KPIs.

**Actions**
- ✎ Toggle which notification channels are active for the Principal.
- ✎ Set default term / grade filter for the Dashboard.
- ✎ Set light / dark theme (if `next-themes` is enabled app-wide).
- 🔒 Set school-wide theme or system defaults — not a Principal permission (app/shell config scope).

### 11.3 Security & Sessions
**What is seen**
- 👁 List of own active sessions / last login (if tracked).
- 👁 Audit entries attributable to the Principal (subset of Module 8).

**Actions**
- ✎ Log out / revoke current session.
- ✎ Trigger a password reset for self.
- 🔒 Force-logout other users or revoke their sessions — denied.
- 🔒 View or edit other users' credentials — denied.

### 11.4 Confidentiality Notice (read-only)
- 👁 A static notice reminding the Principal that confidential field columns (diagnosis, treatment, incident write-ups, home-visitation findings, ADM eligibility reasons) are **never displayed** — status-only by design (O1). No actions.

---

## Cross-Cutting Rules (all pages)

- Principal session requires `role = principal` in JWT; all module pages gate on `requireRole('principal')`.
- Confidential columns on `anecdotal_records`, `health_records`, `home_visitation_records`, `adm_learner_profiles` are stripped server-side before reaching the client (O1) — never rendered, even if requested.
- Every sensitive action (final-sign ADM, set active year, refresh snapshot) writes an `audit_logs` row with reason.
- `notifications` fire to web/mobile/email per `channel`.
- The Principal **cannot** bypass confidentiality tiering: status-only is enforced both by RLS (row-level, PLAN.md §4.3) and app-layer field hiding.

---

## API Surface Relevant to Principal (from `docs/backend.md` §6)

| Method | Route | Principal capability |
|---|---|---|
| GET | `/api/risk/sections/:id/heatmap` | ✎ view section × risk_factor counts |
| GET | `/api/adm/referrals` | 👁 status-only board |
| POST | `/api/adm/:id/principal-approve` | ✎ final digital signature |
| GET | `/api/audit` | 👁 school-wide audit log (filter/export) |
| GET | `/api/notifications` | 👁 own notifications |
| POST | `/api/notifications/read/:id` | ✎ mark read |
| POST | `/api/school-years` | ✎ create year (created_by = Principal) |
| (reports) | `/api/reports/*` | 👁 trends / intervention-success / honor-roll **[PROPOSAL]** |

---

✅ Principal module spec complete — 11 module pages (incl. Settings), visibility + actions per page, confidentiality status-only enforced, and a consolidated Can-Do / Cannot-Do summary at the top.
