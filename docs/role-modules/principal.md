# Principal — Web Role Module Specification

> Scope source: `PLAN.md` §4.2 (RBAC) and §4.3 (confidentiality tiering, row-level +
> app hides fields). The Principal has school-wide visibility but a **status-only**
> view into confidential cases (ADM, Nurse, Guidance) — diagnosis/treatment/
> intervention detail columns are NEVER sent to the client.
>
> Legend: 👁 visible · ✎ action allowed · 🔒 denied/hidden.

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
10. Account Approvals (Record Keeper / Registrar grade-banded)

---

## 1. Dashboard (school-wide)

**What is seen**
- 👁 School-wide KPI cards: total students, students per risk level (High/Moderate/Low),
  attendance average, term progress.
- 👁 Risk heat map (section × risk_factor) — counts only, no student identities required
  at card level.
- 👁 Pending items requiring Principal action: ADM referrals awaiting final signature,
  account approvals routed to Record Keeper/Registrar.
- 👁 Recent notifications summary.

**Actions**
- ✎ Filter KPIs by school year / term / grade level.
- ✎ Drill down into any KPI card → navigates to the relevant module page.
- ✎ Mark notification read.

---

## 2. School Year & Term Management

**What is seen**
- 👁 List of `school_years` (name, start/end, is_active) with their `terms` (1–3,
  start/end).
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
- 👁 Per grade/section: average transmuted grades, pass/fail distribution from
  `final_grades`.
- 👁 Student list with `risk_level`, overall average, attendance rate (no confidential
  write-ups).
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
- 👁 Intervention records (`interventions`) at **status level**: approval_status,
  outcome_status, recommended/approved action text — but 🔒 the originating
  `anecdotal_records.description_of_incident` / `health_records.diagnosis` are hidden
  (status-only view per O1).
- 👁 Heat map (section × risk_factor) from `report_snapshots` (type=heat_map).

**Actions**
- ✎ Filter by risk level / grade / section / term.
- ✎ View intervention outcome summary (counts: ongoing/resolved/unresolved).
- ✎ Open a read-only intervention detail (action + outcome only, no confidential source).
- 🔒 Create/modify/approve an intervention — that is Guidance Counselor / Nurse scope.

---

## 5. ADM Referrals & Approvals (status-only + final sign)

**What is seen**
- 👁 ADM referral pipeline status board: `referrals` → `adm_learner_profiles`
  (eligibility_status) → `adm_parent_meetings` (attended) → `adm_modules` →
  `adm_devices`. **Status/progress columns only.**
- 🔒 `adm_learner_profiles.reasons_for_adm`, `intervention_result`,
  `home_visitation_records` findings, `health_records` detail — hidden (O1).
- 👁 Whether Principal signature is still pending on a certification.

**Actions**
- ✎ Review ADM case status board.
- ✎ **Final-sign an ADM referral/certification** (`POST /api/adm/:id/principal-approve`)
  — sets `adm_learner_profiles.approved_by` = Principal, `approval_date`.
- ✎ Reject / return for revision (status back to ADM Coordinator).
- 🔒 Edit eligibility, issue devices, record meetings — ADM Coordinator scope.

---

## 6. Honor Roll & Awards

**What is seen**
- 👁 Candidate list computed live from `final_grades`: term transmuted average ≥ 90 AND
  no subject < 75 (DepEd rule, O5). Shows student, average, per-subject grades.
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
- 👁 `audit_logs` (school-wide): user, action_type, source_table, source_id, reason,
  timestamp. old/new value JSON visible (these are system events, not confidential
  clinical write-ups).
- 👁 Covers: sf10_update, grade_lock/unlock, anecdotal_edit, health_record_edit,
  home_visitation_edit, adm_edit, referral_status_change, intervention_approval,
  account_approval, role_change.

**Actions**
- ✎ Filter by action_type / user / date range / table.
- ✎ Export audit extract.
- 🔒 Edit or delete audit rows — immutable.

---

## 9. Notifications

**What is seen**
- 👁 Principal's `notifications` (web channel): type, message, source, is_read.
- 👁 Fires for: new_adm_case (awaiting signature), account_approval routed,
  intervention_approved, sf10_validated, audit_alert, etc.

**Actions**
- ✎ Mark read / mark all read.
- ✎ Filter by type / date.
- 🔒 Compose broadcast — not a Principal permission in current spec.

---

## 10. Account Approvals (Record Keeper / Registrar grade-banded)

**What is seen**
- 👁 Read-only view of pending account approvals and who approved them.
- 👁 Approval is grade-banded: Record Keeper → Grades 7–10, Registrar → 11–12.

**Actions**
- 🔒 Approve student/parent/teacher accounts directly — **denied**; this is the
  Record Keeper / Registrar function. Principal has visibility only into the
  approval trail via audit_logs.

---

## Cross-Cutting Rules (all pages)

- Principal session requires `role = principal` in JWT; all module pages gate on
  `requireRole('principal')`.
- Confidential columns on `anecdotal_records`, `health_records`,
  `home_visitation_records`, `adm_learner_profiles` are stripped server-side before
  reaching the client (O1) — never rendered, even if requested.
- Every sensitive action (final-sign ADM, set active year, refresh snapshot) writes an
  `audit_logs` row with reason.
- `notifications` fire to web/mobile/email per `channel`.

---

✅ Principal module spec complete — 10 module pages, visibility + actions per page,
confidentiality status-only enforced.
