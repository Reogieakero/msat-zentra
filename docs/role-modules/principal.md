# Principal — Web Role Module Specification (Professional Workspace Reference)

> **Purpose:** A single, comprehensive workspace-grade reference for the **Principal** role in
> Zentra. Every page is specified like a product/UX spec: layout regions, exact widgets and
> data-table column definitions, filter/toolbar controls, interactions, loading/empty/error
> states, audit + notification behavior, and the confidentiality boundary.
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
11. Settings (Principal profile & preferences)

---

> **How to read each page spec below**
> Every page uses the same structure:
> - **Route / Gate** — URL segment + auth gate.
> - **Page Layout** — wireframe regions (top bar, main canvas, right rail).
> - **Widgets & Data Tables** — exact cards/tables with column specs and data sources.
> - **Filter & Toolbar** — controls available to the Principal.
> - **Interactions & Drill-downs** — clickable behavior.
> - **States** — empty / loading / error / zero-result handling.
> - **Audit & Notifications** — what gets logged or fired.
> - **Confidentiality** — what is hidden vs. visible (status-only).
> - **✅ CAN / 🔒 CANNOT** — condensed permission strip per page.
>
> Visual language (PLAN.md §2): Principal = **calm overview** — soft off-white `#FAFAF9`, one brand accent, `rounded-md`, 1px borders, data-dense tables with sticky headers, monospaced IDs/grades, micro-motion only.

---

## 1. Dashboard (school-wide)

**Route / Gate:** `/principal/dashboard` · `requireRole('principal')`. Landing page post-login.

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar: Zentra · [SY 2026–2027 ▾] [Term 1 ▾] [Grade ▾]   🔔(3)  ⚙️     │
├──────────────────────────────────────────────────────────────────────┤
│  KPI ROW (4 cards)                                                    │
│  [Total Students] [Risk: H/M/L] [Attendance Avg] [Term Progress]      │
├──────────────────────────────────────┬───────────────────────────────┤
│  MAIN: Risk Heat Map (section×factor) │  RIGHT RAIL: Action Required   │
│  (color-shaded matrix + legend)       │  • ADM awaiting signature (2)  │
│                                       │  • Account approvals routed(5) │
│                                       │  • Recent notifications (5)    │
└──────────────────────────────────────┴───────────────────────────────┘
```

**Widgets & Data Tables**
- **KPI cards (top row, each a clickable tile that drills down):**
  - 👁 **Total Students** — count of `student_profiles` enrolled in the active school year/term. Subtitle delta vs. previous term.
  - 👁 **Students by Risk Level** — three sub-counts: **High** (risk_count ≥ 2), **Moderate** (risk_count = 1), **Low** (risk_count = 0). Each links to Module 4 filtered to that level. Source: `student_profiles.risk_level`.
  - 👁 **Attendance Average** — school-wide mean attendance rate = Σ(present) / Σ(present+absent+late+excused) over AM/PM sessions in active term. Subtitle: "# sections below 80%".
  - 👁 **Term Progress** — progress bar = elapsed days / term length from `terms.start_date`/`end_date` of the active year.
- **Risk Heat Map (main canvas):** a **section × risk-factor matrix** — *not* a GitHub-style calendar.
  - **Rows** = each `section` (Grade 7-A … 12-C) in active term.
  - **Columns** = three risk factors: **Academic** (avg < 75), **Attendance** (rate < 80%), **Behavioral** (≥1 anecdotal).
  - **Cell** = count of students in that section flagged on that factor (no names). **Shading** by intensity (light→dark).
  - *Example:* row "Grade 9-B", column "Attendance" dark = 14 students < 80%. Click → Module 4 pre-filtered.
  - Source: `report_snapshots` type=`heat_map`; live fallback if stale (O6).
- **Action Required (3-card section beneath the heat map):** a dedicated block under the matrix, laid out as **3 equal-width cards** (Supabase "Featured integrations" style — icon + title + count + one-line description + "Open →" link). Surfaces the actions the Principal must personally complete, highest urgency first.
  - 🃏 **Card 1 — ADM Signatures** — `adm_learner_profiles` where `approved_by` null & `eligibility_status=eligible`. Big ⚑ count. One-liner: "Learner profiles awaiting your digital signature." → Module 5 (pending-signature filter).
  - 🃏 **Card 2 — Account Approvals** — `users` status=`pending` mapped to RK (7–10) / Registrar (11–12). Big ⚑ count. One-liner: "New accounts routed to you for approval." → Module 10.
  - 🃏 **Card 3 — Attendance Watch** — derived from the heat map's Attendance column (count of sections < 80%, i.e. dark cells). Big ⚑ count. One-liner: "Sections below 80% attendance need attention." → Module 4 pre-filtered to Attendance factor.
  - *Empty state:* all three cards show "0" with a calm "✅ All caught up" and no link emphasis.
- **Action-Required rail (right):** condensed mirror of the section above — top 3 items only.
  - 👁 **ADM awaiting signature** — count + list of `adm_learner_profiles` where `approved_by` null & `eligibility_status=eligible`. Links to Module 5.
  - 👁 **Account approvals routed** — count of `users` status=`pending` mapped to RK (7–10) / Registrar (11–12). Links to Module 10.
  - 👁 **Recent notifications** — last 5 from `notifications`. Links to Module 9.

**Filter & Toolbar:** ✎ School year / term / grade-level selectors (recompute all widgets). ✎ "Mark read" on recent items.

**Interactions & Drill-downs:** click any KPI card or heat-map cell → navigates to target module with filter carried over.

**States:** Loading — skeleton cards + shimmer matrix. Empty (no active year) — banner "Set an active school year in School Year Management". Error — toast + retry.

**Audit & Notifications:** none on view. Reads `notifications` for the rail.

**Confidentiality:** heat map shows counts only; never student identities at cell level.

**✅ CAN** filter, drill down, mark-read. **🔒 CANNOT** edit any data from here.

---

## 2. School Year & Term Management

**Route / Gate:** `/principal/school-years` · `requireRole('principal')`.

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar + [+ New School Year] button                                    │
├──────────────────────────────────────────────────────────────────────┤
│  Year accordion list (newest first)                                   │
│  ▸ SY 2026–2027  [ACTIVE]  start–end   [Set Active][Edit dates]        │
│     ├ Term 1  start–end  🔒                                            │
│     ├ Term 2  start–end  🔒                                            │
│     └ Term 3  start–end  🔒                                            │
│  ▸ SY 2025–2026  start–end   [Set Active][Edit dates]                  │
│     └ …                                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

**Widgets & Data Tables**
- 👁 **School year list** — each `school_year`: `name`, `start_date`, `end_date`, **Active** badge (single active). Sorted newest-first.
- 👁 **Term tree** — under each year, its `terms` (1–3): `term_number`, `start_date`, `end_date`. 🔒 lock icon on terms of the active year (dates protected).
- 👁 **Enrollment indicator** — hint if a year has locked grades / active enrollments (drives delete guard).

**Filter & Toolbar:** ✎ `+ New School Year`, `+ Add Term` (per year), `Set Active` toggle, `Edit dates` (future only).

**Interactions & Drill-downs:** `Set Active` deactivates the prior active year (exactly one active). `Edit dates` opens a modal for future years/terms only.

**States:** Loading — skeleton accordion. Empty — "No school years yet. Create the first one." Error on delete-guard — inline "Cannot delete: locked grades or active enrollments exist."

**Audit & Notifications:** ✎ create year/term, set active, edit dates → each writes `audit_logs` with reason.

**Confidentiality:** N/A (calendar config).

**✅ CAN** create year/term, set active, edit future dates. **🔒 CANNOT** delete a year with locked grades/active enrollments.

---

## 3. Academic Performance (school-wide)

**Route / Gate:** `/principal/academics` · `requireRole('principal')`.

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar + Filter[Grade▾][Section▾][Term▾][Subject▾]  [Export CSV/PDF]   │
├──────────────────────────────────────────────────────────────────────┤
│  Summary Table (sticky header, monospaced grades)                     │
│  Section | Grade | Avg Transmuted | Pass% | Fail% | #At-Risk          │
│  ─────────────────────────────────────────────────────────────────    │
│  (expand row ▸ student list)                                          │
├──────────────────────────────────────────────────────────────────────┤
│  Pass/Fail distribution (stacked bar per grade) + Honor-roll strip    │
└──────────────────────────────────────────────────────────────────────┘
```

**Widgets & Data Tables**
- 👁 **Grade/section summary table** — cols: `Section`, `Grade Level`, **Avg Transmuted Grade** (mean `final_grades.transmuted_grade`), **Pass %** / **Fail %** (`remarks`), **# At-Risk** (High/Moderate). Sticky header, monospaced grades.
- 👁 **Pass/Fail distribution** — stacked bar/donut per grade/section from `final_grades.remarks`.
- 👁 **Student list** (expand a section) — cols: `LRN`, `Student`, `risk_level` (badge), **Overall Average**, **Attendance Rate %**. No write-ups.
- 👁 **Honor-roll preview strip** — O5 candidates linking to Module 6.

**Filter & Toolbar:** ✎ Grade / Section / Term / Subject. ✎ Export CSV/PDF (school/grade/section scope).

**Interactions & Drill-downs:** expand section → student list; click a student → **grade breakdown drawer**: per subject, components (Written Work/Performance Task/Quarterly Exam + weights), assessments, computed average, **DepEd-transmuted grade**, `remarks`. View-only.

**States:** Loading — skeleton table. Empty (no finals yet) — "No finalized grades for this term." Zero-filter — "No sections match."

**Audit & Notifications:** none on view/export.

**Confidentiality:** no anecdotal/health/SF10 content rendered.

**✅ CAN** filter, drill into breakdown, export. **🔒 CANNOT** edit/lock grades.

---

## 4. Risk & Early Intervention (school-wide)

**Route / Gate:** `/principal/risk` · `requireRole('principal')`.

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar + Filter[Risk Level▾][Grade▾][Section▾][Term▾]                  │
├──────────────────────────────────────────┬───────────────────────────┤
│  MAIN:                                                     │ RIGHT:     │
│   Student Risk Table (sticky)                             │ Heat Map   │
│   Student|Section|Risk|Count|[A][T][B] chips              │ (sec×factor)│
│   ──────────────────────────────────────                 │             │
│   Open student ▸ Risk trend line + Intervention board     │ Outcome    │
│                                                          │ summary    │
└──────────────────────────────────────────────────────────┴────────────┘
```

**Widgets & Data Tables**
- 👁 **Student risk table** — cols: `Student`, `Section`, `risk_level` (badge), `risk_count` (0–3), factor chips **[A]cademic [T]ttendance [B]ehavioral**. Source: `student_profiles` (live).
- 👁 **Risk trend line** (per student) — `risk_snapshots` over terms (Low→Moderate→High). Answers "worse or better?".
- 👁 **Intervention board (status only)** — `interventions` rows: `Student`, `risk_level_at_flag`, `approval_status` (pending/approved/rejected/modified), `outcome_status` (ongoing/resolved/unresolved), **recommended/approved action text**.
  - 🔒 **Hidden (O1):** `anecdotal_records.description_of_incident`, `health_records.diagnosis`/`treatment_given`, `home_visitation_records` findings. Banner: "Confidential source hidden — status-only view."
- 👁 **Heat Map** — same section×factor matrix as Modules 1/7, from `report_snapshots` type=`heat_map`.
- 👁 **Outcome summary** — counts ongoing/resolved/unresolved (stat row or bar).

**Filter & Toolbar:** ✎ Risk level / grade / section / term.

**Interactions & Drill-downs:** open student → trend + intervention detail (action/outcome only). Click heat-map cell → filter table.

**States:** Loading — skeleton table + chart. Empty — "No at-risk students in this scope." Error — fallback to live query with banner.

**Audit & Notifications:** reads `interventions` status; no writes by Principal here.

**Confidentiality:** status-only enforced server-side (O1). Detailed source never sent.

**✅ CAN** filter, view status, open read-only detail. **🔒 CANNOT** create/modify/approve interventions.

---

## 5. ADM Referrals & Approvals (status-only + final sign)

**Route / Gate:** `/principal/adm` · `requireRole('principal')`.

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar + Filter[Stage▾][Grade▾][Signature▾]   [Sign ▸][Return ▸]       │
├──────────────────────────────────────────────────────────────────────┤
│  Pipeline Status Board (sticky header)                                │
│  Student|Grade|Stage|Eligibility|Meeting?|Modules(n/tot)|Device?|Sign │
│  ─────────────────────────────────────────────────────────────────    │
│  rows badged "Awaiting your signature" when approved_by=null & eligible│
└──────────────────────────────────────────────────────────────────────┘
```

**Widgets & Data Tables**
- 👁 **ADM pipeline board** — one row per `adm_learner_profiles` tracing the state machine (PLAN.md §6.4):
  `referrals` → `eligibility_status` (pending/eligible/ineligible) → `adm_parent_meetings.attended` → `adm_modules` (submitted/total) → `adm_devices` (issued/returned).
  - **Visible cols:** `Student`, `Grade/Section`, **Stage**, `eligibility_status`, **Meeting attended?** (✓/✗), **Modules submitted** (n/total), **Device issued?** (✓/✗), **Principal Sign** (Pending / Signed + `approval_date`).
  - 🔒 **Hidden (O1):** `reasons_for_adm`, `intervention_result`, `home_visitation_records` findings, `health_records` detail.
- 👁 **Signature-pending flag** — `approved_by` null & `eligibility_status=eligible` → "Awaiting your signature" badge.

**Filter & Toolbar:** ✎ Stage / grade / signature state. ✎ `Sign` (final-sign) · ✎ `Return` (reject/revision).

**Interactions & Drill-downs:** select row → `Sign` opens confirmation (digital signature) → `POST /api/adm/:id/principal-approve` sets `approved_by`=Principal + `approval_date`, writes `audit_logs` (`adm_edit`), fires completion notification. `Return` prompts reason → status back to ADM Coordinator.

**States:** Loading — skeleton board. Empty — "No ADM cases." Zero-signature — "Nothing awaiting your signature." Error (already signed) — 409 "Already signed by principal."

**Audit & Notifications:** ✎ sign/return → audited + `new_adm_case`/completion notification.

**Confidentiality:** status-only; confidential justification columns never sent.

**✅ CAN** review board, final-sign, reject/return. **🔒 CANNOT** edit eligibility, issue/return devices, record meetings.

---

## 6. Honor Roll & Awards

**Route / Gate:** `/principal/honor-roll` · `requireRole('principal')`.

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar + Filter[Term▾][Grade▾][Section▾]  [Export][Mark Awarded]      │
├──────────────────────────────────────────────────────────────────────┤
│  Candidate Table (sticky)                                            │
│  Student|Section|Term Avg| [per-subject transmuted grid, <75 red]     │
│  ─────────────────────────────────────────────────────────────────    │
│  Award Categories (school-defined placeholders)                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Widgets & Data Tables**
- 👁 **Candidate table** — students meeting O5: term **transmuted average ≥ 90** AND **no subject < 75**. Cols: `Student`, `Section`, **Term Average**, per-subject mini-grid of `transmuted_grade` (failing <75 highlighted so exclusion reason is visible).
- 👁 **Award categories** — placeholder section for school-defined awards (Perfect Attendance, Subject Toppers, etc.).

**Filter & Toolbar:** ✎ Term / grade / section. ✎ Export CSV/PDF. ✎ Mark as awarded (publish step, pure status).

**Interactions & Drill-downs:** hover/click subject cell → see component breakdown (links to Module 3 drawer).

**States:** Loading — skeleton. Empty — "No candidates this term." Zero-filter — "No matches."

**Audit & Notifications:** ✎ mark-awarded → audited (if treated as sensitive write).

**Confidentiality:** N/A (grades are non-confidential to Principal).

**✅ CAN** filter, export, mark awarded. **🔒 CANNOT** modify grades to change eligibility.

---

## 7. Reports & Visualization

**Route / Gate:** `/principal/reports` · `requireRole('principal')` (routes `[PROPOSAL]` per backend.md §6.10).

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar + [Report Type▾][Scope▾][Term▾]  [Refresh][Export]             │
├──────────────────────────────────────────────────────────────────────┤
│  Chart Canvas (recharts)                                             │
│   • Trends: line (term-over-term avg, 1 line/scope)                  │
│   • Intervention Success: bar (resolved/referred)                    │
│   • Heat Map: section×factor matrix                                  │
│   • Honor Roll: O5 snapshot                                          │
│  [Live fallback banner if snapshot stale]                            │
└──────────────────────────────────────────────────────────────────────┘
```

**Widgets & Data Tables**
- 👁 **Performance Trends** (type=`trends`) — line chart, x=terms, y=avg transmuted, one line per scope (school/grade/section).
- 👁 **Intervention Success Rate** (type=`intervention_success`) — bar: resolved-or-ongoing ÷ referred, split by grade.
- 👁 **Heat Maps** (type=`heat_map`) — section×factor matrix (Modules 1/4).
- 👁 **Honor Roll** (type=`honor_roll`) — O5 candidate snapshot.
- 👁 **Live fallback banner** — "Live data — snapshot regenerating" when `report_snapshots` stale/missing (O6).

**Filter & Toolbar:** ✎ Report type + scope (school/grade/section) + term. ✎ Refresh snapshot (`POST /reports/refresh`). ✎ Export (CSV/PDF/PNG).

**Interactions & Drill-downs:** switch type/scope/term → re-render chart; refresh regenerates `payload`.

**States:** Loading — chart spinner. Empty — "No data for this scope/term." Stale — live fallback banner + toast.

**Audit & Notifications:** ✎ refresh → audited if treated as sensitive.

**Confidentiality:** N/A (aggregates only).

**✅ CAN** select, refresh, export. **🔒 CANNOT** alter underlying data.

---

## 8. Audit Log

**Route / Gate:** `/principal/audit` · `requireRole('principal')`.

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar + Filter[Action▾][User▾][Date range][Table▾]  [Export CSV]     │
├──────────────────────────────────────────────────────────────────────┤
│  Audit Table (sticky, virtualized)                                   │
│  Timestamp|User|Action|Source Table|Source ID|Reason|Δ(old→new)      │
│  ─────────────────────────────────────────────────────────────────    │
│  expand row ▸ old_value / new_value JSON                             │
└──────────────────────────────────────────────────────────────────────┘
```

**Widgets & Data Tables**
- 👁 **Audit table** — cols: `timestamp`, `user` (actor), `action_type`, `source_table`, `source_id`, `reason`, expandable **old_value/new_value** JSON.
  - *Example:* `2026-08-21 09:14 · adviser.jdelacruz · grade_lock · final_grades:id=882 · "Term close" · {lock_status:unlocked}→{lock_status:locked, locked_by:…}`.
- 👁 **Covered action types:** sf10_update, grade_lock, grade_unlock, anecdotal_edit, health_record_edit, home_visitation_edit, adm_edit, referral_status_change, intervention_approval, account_approval, role_change.
  - These are **system events**, not clinical write-ups — so old/new JSON is visible (unlike hidden ADM/health columns elsewhere).

**Filter & Toolbar:** ✎ action_type / user / date range / source_table. ✎ Export filtered CSV.

**Interactions & Drill-downs:** expand row → diff JSON; click `source_id` → opens related record if permitted.

**States:** Loading — skeleton table. Empty — "No audit entries match." Large — virtualized scroll + pagination.

**Audit & Notifications:** this page *is* the audit; no additional writes on view.

**Confidentiality:** old/new JSON visible (system events only); confidential clinical fields remain hidden at source.

**✅ CAN** filter, export. **🔒 CANNOT** edit/delete rows (immutable).

---

## 9. Notifications

**Route / Gate:** `/principal/notifications` · own `notifications` (`requireAuth` + ownership).

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar + Filter[Type▾][Date▾]  [Mark all read]                        │
├──────────────────────────────────────────────────────────────────────┤
│  Notification List (grouped by date)                                 │
│  ● icon+type · message · source · relative time · [Mark read]        │
│  ─────────────────────────────────────────────────────────────────    │
│  unread = filled dot; read = hollow                                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Widgets & Data Tables**
- 👁 **Notification list** — each: `type` (icon+label), `message`, `source` (module/record), `timestamp`, read state.
- 👁 **Trigger examples:** `new_adm_case` (ready for signature), `account_approval` (routed to RK/Registrar), `intervention_approved`, `sf10_validated`, `audit_alert`, `referral_status_change`, `new_followup`.

**Filter & Toolbar:** ✎ Type / date. ✎ Mark read / Mark all read.

**Interactions & Drill-downs:** click notification → navigates to its `source` module (e.g., ADM case, audit entry).

**States:** Loading — skeleton list. Empty — "You're all caught up." Unread-zero — show read items only.

**Audit & Notifications:** ✎ mark-read → `POST /api/notifications/read/:id`.

**Confidentiality:** N/A.

**✅ CAN** mark read/filter. **🔒 CANNOT** compose broadcast.

---

## 10. Account Approvals (Record Keeper / Registrar grade-banded — visibility only)

**Route / Gate:** `/principal/account-approvals` · `requireRole('principal')` (read-only).

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar + Filter[Role▾][Grade Band▾][Status▾]                          │
├──────────────────────────────────────────────────────────────────────┤
│  Pending/Approved Table (sticky)                                     │
│  Name|Role|Grade Band(7–10/11–12)|Status|Approved By|Approved At     │
│  ─────────────────────────────────────────────────────────────────    │
│  banner: "Approvals are performed by Record Keeper / Registrar"      │
└──────────────────────────────────────────────────────────────────────┘
```

**Widgets & Data Tables**
- 👁 **Pending approvals list** — `users` status=`pending`: `full_name`, `role`, **grade band** (derived: 7–10→Record Keeper, 11–12→Registrar), `approved_by`/`approved_at` once acted on.
- 👁 **Approval trail** — for approved accounts: who/when (mirrors `account_approval` audit entries).

**Filter & Toolbar:** ✎ Role / grade band / status. (No approve button — visibility only.)

**Interactions & Drill-downs:** click `approved_by` → opens that approver's audit trail (Module 8).

**States:** Loading — skeleton. Empty — "No pending approvals." Zero-filter — "No matches."

**Audit & Notifications:** reads `audit_logs` (`account_approval`); no writes.

**Confidentiality:** N/A (account metadata only).

**✅ CAN** view trail/filter. **🔒 CANNOT** approve accounts (RK/Registrar only, grade-banded).

---

## 11. Settings (Principal profile & preferences)

**Route / Gate:** `/principal/settings` · `requireAuth` (own account only). Self-service, **not** an admin console.

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar: tabs [Profile][Preferences][Security][Confidentiality Notice] │
├──────────────────────────────────────────────────────────────────────┤
│  TAB CONTENT (one panel at a time)                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 11.1 Profile
- 👁 **Read-out:** full name, email, contact number, role badge (`principal`), account status (active), school context (Mati School of Arts and Trades, Grades 7–12).
- ✎ Update own `contact_number`. ✎ Change own password (bcrypt re-hash; requires current password).
- 🔒 Change `role`/`email`/`status` (hardcoded/admin) · 🔒 edit other users.

### 11.2 Preferences
- 👁 Notification channel toggles (web/mobile/email) for own account; default dashboard scope (year/term/grade) used to pre-filter KPIs.
- ✎ Toggle channels. ✎ Set default term/grade filter. ✎ Set light/dark theme (if `next-themes` app-wide).
- 🔒 Set school-wide theme/system defaults (app/shell config scope).

### 11.3 Security & Sessions
- 👁 Own active sessions / last login; audit entries attributable to the Principal (subset of Module 8).
- ✎ Log out / revoke current session. ✎ Trigger self password reset.
- 🔒 Force-logout other users / revoke their sessions · 🔒 view/edit other credentials.

### 11.4 Confidentiality Notice (read-only)
- 👁 Static notice: confidential columns (diagnosis, treatment, incident write-ups, home-visitation findings, ADM eligibility reasons) are **never displayed** — status-only by design (O1). No actions.

**States (all tabs):** Loading — skeleton form. Save — optimistic + toast. Error — inline validation (e.g., weak password).

**Audit & Notifications:** ✎ password/contact change → `audit_logs` (account/role_change) + confirmation notification.

**✅ CAN** manage own profile/preferences/sessions. **🔒 CANNOT** manage other users or school-wide config.

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

✅ Principal module spec complete — 11 module pages (incl. Settings), each as a professional UX workspace spec with layout, widgets, column definitions, states, audit, and confidentiality boundary.
