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

**What is seen**
- 👁 School-wide KPI cards: total students, students per risk level (High/Moderate/Low), attendance average, term progress.
- 👁 Risk heat map (section × risk_factor) — counts only; no student identities required at card level.
- 👁 Pending items requiring Principal action: ADM referrals awaiting final signature, account approvals routed to Record Keeper/Registrar.
- 👁 Recent notifications summary.

**Actions**
- ✎ Filter KPIs by school year / term / grade level.
- ✎ Drill down into any KPI card → navigates to the relevant module page.
- ✎ Mark notification read.

---

## 2. School Year & Term Management

**What is seen**
- 👁 List of `school_years` (name, start/end, is_active) with their `terms` (1–3, start/end).
- 👁 Which year is currently active.

**Actions**
- ✎ Create school year (`POST /api/school-years`) — sets `created_by` = Principal.
- ✎ Create term under a year (term_number 1–3, dates; enforces UNIQUE per year).
- ✎ Set a school year active / inactive (only one active at a time).
- ✎ Edit dates of a future (non-active) year/term.
- 🔒 Delete a school year with locked grades or active enrollments — denied.

---

## 3. Academic Performance (school-wide)

**What is seen**
- 👁 Per grade/section: average transmuted grades, pass/fail distribution from `final_grades`.
- 👁 Student list with `risk_level`, overall average, attendance rate (no confidential write-ups).
- 👁 Honor-roll candidates preview (read-only; formal list in Module 6).

**Actions**
- ✎ Filter by grade/section/term/subject.
- ✎ View a student's grade breakdown (components → assessments → final, transmuted).
- ✎ Export performance report (CSV/PDF) at school/section scope.
- 🔒 Edit or lock individual grades — not a Principal permission (teacher/registrar only).

---

## 4. Risk & Early Intervention (school-wide)

**What is seen**
- 👁 `risk_level` + `risk_count` per student (live, from `student_profiles`).
- 👁 `risk_snapshots` trend line per student (Low→Moderate→High over terms).
- 👁 Intervention records (`interventions`) at **status level**: approval_status, outcome_status, recommended/approved action text — but 🔒 the originating `anecdotal_records.description_of_incident` / `health_records.diagnosis` are hidden (status-only view per O1).
- 👁 Heat map (section × risk_factor) from `report_snapshots` (type=heat_map).

**Actions**
- ✎ Filter by risk level / grade / section / term.
- ✎ View intervention outcome summary (counts: ongoing/resolved/unresolved).
- ✎ Open a read-only intervention detail (action + outcome only, no confidential source).
- 🔒 Create/modify/approve an intervention — that is Guidance Counselor / Nurse scope.

---

## 5. ADM Referrals & Approvals (status-only + final sign)

**What is seen**
- 👁 ADM referral pipeline status board: `referrals` → `adm_learner_profiles` (eligibility_status) → `adm_parent_meetings` (attended) → `adm_modules` → `adm_devices`. **Status/progress columns only.**
- 🔒 `adm_learner_profiles.reasons_for_adm`, `intervention_result`, `home_visitation_records` findings, `health_records` detail — hidden (O1).
- 👁 Whether Principal signature is still pending on a certification.

**Actions**
- ✎ Review ADM case status board.
- ✎ **Final-sign an ADM referral/certification** (`POST /api/adm/:id/principal-approve`) — sets `adm_learner_profiles.approved_by` = Principal, `approval_date`.
- ✎ Reject / return for revision (status back to ADM Coordinator).
- 🔒 Edit eligibility, issue devices, record meetings — ADM Coordinator scope.

---

## 6. Honor Roll & Awards

**What is seen**
- 👁 Candidate list computed live from `final_grades`: term transmuted average ≥ 90 AND no subject < 75 (DepEd rule, O5). Shows student, average, per-subject grades.
- 👁 Award categories placeholder (school-defined).

**Actions**
- ✎ Filter by term / grade / section.
- ✎ Export honor-roll list (CSV/PDF).
- ✎ Mark candidates as awarded (if school workflow requires a publish step).
- 🔒 Modify grades to change eligibility — not permitted.

---

## 7. Reports & Visualization

**What is seen**
- 👁 Performance trends (term-over-term averages) — `report_snapshots` type=trends.
- 👁 Intervention success rate (outcome/referred) — type=intervention_success.
- 👁 Heat maps — type=heat_map.
- 👁 Honor roll — type=honor_roll.
- 👁 Live fallback query if a snapshot is missing/stale (O6).

**Actions**
- ✎ Select report type + scope (school/grade/section) + term.
- ✎ Refresh a snapshot on demand (regenerate).
- ✎ Export report.

---

## 8. Audit Log

**What is seen**
- 👁 `audit_logs` (school-wide): user, action_type, source_table, source_id, reason, timestamp. old/new value JSON visible (these are system events, not confidential clinical write-ups).
- 👁 Covers: sf10_update, grade_lock/unlock, anecdotal_edit, health_record_edit, home_visitation_edit, adm_edit, referral_status_change, intervention_approval, account_approval, role_change.

**Actions**
- ✎ Filter by action_type / user / date range / table.
- ✎ Export audit extract.
- 🔒 Edit or delete audit rows — immutable.

---

## 9. Notifications

**What is seen**
- 👁 Principal's `notifications` (web channel): type, message, source, is_read.
- 👁 Fires for: new_adm_case (awaiting signature), account_approval routed, intervention_approved, sf10_validated, audit_alert, etc.

**Actions**
- ✎ Mark read / mark all read.
- ✎ Filter by type / date.
- 🔒 Compose broadcast — not a Principal permission in current spec.

---

## 10. Account Approvals (Record Keeper / Registrar grade-banded — visibility only)

**What is seen**
- 👁 Read-only view of pending account approvals and who approved them.
- 👁 Approval is grade-banded: Record Keeper → Grades 7–10, Registrar → 11–12.

**Actions**
- 🔒 Approve student/parent/teacher accounts directly — **denied**; this is the Record Keeper / Registrar function. Principal has visibility only into the approval trail via `audit_logs`.

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
