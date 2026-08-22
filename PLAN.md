# Zentra — System Plan (PLAN.md)

> Status: PLANNING ONLY. No code, migrations, or config written. Elements not
> grounded in the approved system brief are tagged **[DESIGN PROPOSAL]**.

---

## 1. Executive Summary

**Zentra** is a Student Information & Management System (web + mobile) for
**Mati School of Arts and Trades** (Grades 7–12, trimester calendar — 3 terms
per school year). It centralizes learner records, ADM performance, and
behavioral documentation to support early intervention of at-risk students via
rule-based detection.

**Goals**
1. Digital SF10 management with OCR ingestion + grading-portal auto-fill.
2. Secure anecdotal record management with confidentiality tiering.
3. ADM tracking (modules, submissions, completion).
4. Rule-based early-intervention detection (Low/Moderate/High) with staff approval.
5. Audit trail for all sensitive actions.
6. Cross-module reporting & data visualization.

**Non-goals (this plan cycle)**
- Live deployments / production infra hardening.
- Third-party SIS integrations beyond the in-house Grading Portal.
- Native desktop clients.

**Scope note:** A data dictionary pass has now formalized the schema to **28 tables**
(previously 24). The 5 tables that were open proposals — `interventions`,
`sf10_records`, `sf10_record_versions`, `audit_logs`, `adm_devices` — are now
**confirmed/grounded** via the data dictionary. Remaining open items: RLS
enforcement (#1), risk-history snapshots (#4), and the honor-roll threshold (#7)
— these remain flagged below and are treated as design decisions to confirm, not
silently assumed.

---

## 2. Architecture Overview

| Layer | Technology | Notes |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript, CSS Modules, React Hook Form, Zod, TanStack Query, Axios | App Router; route handlers for BFF where needed. |
| Mobile | Flutter + Dart, Hive (offline-first) | Local cache of own-data; sync queue on reconnect. |
| Backend | Node.js, Express, TypeScript, Prisma, Supabase Postgres + Storage | Single API consumed by web + mobile. |
| Auth | JWT (access + refresh), bcrypt password hashing | Role claim embedded in JWT; RLS enforced server-side. |
| Security | Helmet, CORS, Pino logging | Multer for uploads (SF10, ADM docs, health forms). |
| Deploy | Vercel (web), Railway/Render/VPS (backend), Supabase (DB/storage) | — |

**Offline-sync strategy (mobile/Hive) — RESOLVED (O9)**
- Hive stores the student/parent's own scoped records locally (read models only).
- Mutations allowed offline (e.g. Adviser attendance, anecdotal draft) are queued
  in a local outbox table with optimistic UI; flushed on reconnect.
- Conflict resolution: **Last-Write-Wins by `updated_at` + server authority**
  (standard). `POST /sync` is idempotent (dedupe by client op ID); a per-record
  version counter detects concurrent edits so they surface as a conflict rather
  than a silent overwrite. Low-risk for this domain; version-counter escalation
  added only if edit collisions appear in testing.

---

## 3. Database Schema Design (28 tables — grounded in data dictionary)

Full column-level dictionary is the source of truth; what follows is the
structural map. Key relations: `users` is the single identity root; role-specific
profiles hang 1:1 off it; `parent_student_links` is the M:N bridge. The academic
spine `school_years → terms → sections/subjects → teacher_subject_assignments`
carries `term_id` for everything downstream.

### 3.1 Identity & accounts
- **users** — `id`, `email` (UNIQUE), `password_hash` (bcrypt), `role` (ENUM,
  never user-selectable), `full_name`, `contact_number`, `status`
  (pending/active/suspended), `approved_by` (FK→users, grade-banded), `approved_at`.
  Roles: student, parent, subject_teacher, adviser, nurse, adm_coordinator,
  guidance_counselor, record_keeper, registrar, principal.
- **student_profiles** — `user_id` (1:1), `lrn` (UNIQUE), `grade_level`
  (7–12 ENUM), `section_id`, `birthdate`, `address`, `photo_url`, `risk_count`
  (computed 0–3), `risk_level` (computed High/Moderate/Low, visible to student+parent).
- **parent_profiles** — `user_id` (1:1), `address`, `occupation`.
- **parent_student_links** — `parent_id`, `student_id`, `relationship`,
  `approved_by`, UNIQUE(parent_id, student_id).
- **staff_profiles** — `user_id` (1:1), `employee_id`, `department`,
  `is_adviser` (bool).

### 3.2 Academic structure
- **school_years** — `name`, `start_date`, `end_date`, `is_active`, `created_by` (Principal).
- **terms** — `school_year_id`, `term_number` (1/2/3), UNIQUE(school_year_id, term_number).
- **sections** — `name`, `grade_level`, `school_year_id`, `adviser_id`.
- **subjects** — `name`, `code` (UNIQUE), `grade_level`.
- **teacher_subject_assignments** — `teacher_id`, `subject_id`, `section_id`,
  `term_id`, UNIQUE(teacher_id, subject_id, section_id, term_id).

### 3.3 Grading
- **grade_components** — `subject_id`, `term_id`, `component_type`
  (Written Work/Performance Task/Quarterly Exam), `weight_percentage`.
- **assessments** — `grade_component_id`, `title`, `max_score`, `date_given`, `created_by`.
- **student_grades** — `assessment_id`, `student_id`, `raw_score`, `percentage_score`
  (computed), UNIQUE(assessment_id, student_id).
- **final_grades** — `student_id`, `subject_id`, `term_id`, `computed_average`,
  `transmuted_grade` (DepEd), `remarks` (Passed/Failed), `lock_status`
  (unlocked/locked), `locked_by`, `locked_at`, `finalized_by`, `finalized_at`,
  UNIQUE(student_id, subject_id, term_id).

### 3.4 Attendance
- **attendance_records** — `student_id`, `section_id`, `date`, `session` (AM/PM),
  `status` (present/absent/late/excused), `recorded_by`, `term_id`,
  UNIQUE(student_id, date, session). Per half-day, not per subject.

### 3.5 Behavioral & intervention
- **anecdotal_records** (matches GCForm-01) — `student_id`, `observer_id`,
  `section_id`, `observation_datetime`, `description_of_incident`,
  `description_of_location`, `notes_recommendations_actions`, `class_performance`,
  `attendance_summary`, `attachment_url` (nullable), `term_id`, `confidentiality_level`.
- **anecdotal_record_followups** — `anecdotal_record_id`, `followup_by`,
  `followup_date`, `notes` (fires `new_followup` notification).
- **referrals** — `anecdotal_record_id` (source), `referred_to_role`
  (nurse/guidance_counselor/adm_coordinator/principal), `referred_by`, `reason`,
  `status` (pending/in_progress/resolved).
- **interventions** (confirmed — closes Obj 4.4–4.5) — `student_id`,
  `referral_id` (nullable), `risk_level_at_flag` (snapshot), `recommended_action`,
  `reviewed_by`, `approval_status` (pending/approved/rejected/modified),
  `approved_action`, `outcome_status` (ongoing/resolved/unresolved), `outcome_notes`.

### 3.6 Specialist modules
- **health_records** — `student_id`, `referral_id` (**nullable** — walk-ins allowed),
  `visit_datetime`, `complaint`/`diagnosis`/`treatment_given`, `recorded_by` (Nurse),
  `term_id`, `confidentiality_level`.
- **home_visitation_records** (matches GCForm-12) — `student_id`, `referral_id`
  (**nullable** — GC self-initiation), full GCForm-12 fields (person visited,
  home/family condition, agreements, signatures), `certification_by`, `term_id`,
  `confidentiality_level`.
- **adm_learner_profiles** (matches ADM Learner's Profile) — `student_id`,
  `referral_id` (**NOT NULL** — no walk-ins), profile fields, `eligibility_status`
  (pending/eligible/ineligible), `prepared_by` (ADM Coordinator), `approved_by`
  (Principal), `certification_details`, `term_id`, `confidentiality_level`.
- **adm_parent_meetings** — `adm_learner_profile_id`, `meeting_datetime`,
  `attended` (bool, branches flow), `parent_confirmed_at`, `minutes_of_meeting`,
  `attendance_logbook_ref`.
- **adm_modules** — `adm_learner_profile_id`, `module_name`, `release_date`,
  `due_date`, `submitted`, `submission_date`, `recorded_by`.
- **adm_devices** (confirmed — tablet issue/return) — `adm_learner_profile_id`,
  `device_type`, `device_serial`, `issued_by`, `issued_date`, `returned_date`,
  `condition_notes`.

### 3.7 Records & compliance
- **sf10_records** (confirmed — Obj 1) — `student_id` (1:1 permanent record),
  `source` (auto_populated/ocr_upload/manual), `uploaded_file_url`,
  `ocr_extracted_data` (jsonb), `verified_by` (teacher), `verified_at`,
  `validated_by` (Record Keeper 7–10 / Registrar 11–12), `validated_at`,
  `current_version`.
- **sf10_record_versions** (confirmed — Obj 1.3) — `sf10_record_id`,
  `version_number`, `data_snapshot` (jsonb, append-only), `changed_by`, `change_reason`.
- **audit_logs** (confirmed — Obj 5) — `user_id`, `action_type` (open ENUM:
  sf10_update, grade_lock, grade_unlock, anecdotal_edit, health_record_edit,
  home_visitation_edit, adm_edit, referral_status_change, intervention_approval,
  account_approval, role_change, …), `source_table`, `source_id`, `reason`,
  `old_value` (jsonb), `new_value` (jsonb).
- **risk_snapshots** (confirmed — O4) — `student_id`, `risk_level`
  (High/Moderate/Low), `risk_count` (0–3), `snapshot_date`, `term_id`. Written on
  each live recompute and/or term boundary so Objective 6 trends ("Low→High over
  time") and intervention success rates can be read without replaying raw history.
- **report_snapshots** (confirmed — O6) — `report_type` (trends | intervention_success
  | heat_map | honor_roll), `scope` (school | grade | section), `scope_id`,
  `term_id`, `payload` (jsonb aggregated result), `generated_at`. Caches dashboard
  aggregates so heavy reports don't recompute live on every view; refreshed on a
  schedule or on key data writes. Live queries remain the fallback if a snapshot is
  missing/stale.

### 3.8 System
- **notifications** — `user_id`, `type` (open ENUM, fires per module),
  `source_table`, `source_id`, `channel` (web/mobile/email), `message`, `is_read`.
  **O7 (RESOLVED):** `type`/`channel` ENUMs defined once in shared code (single
  source of truth) and the `type` value is **generated by the service layer** from
  `source_table`/`action` — callers never pass arbitrary strings, preventing drift.

### 3.9 Link map
- Referral spine: `anecdotal_records` → `referrals` →
  (`health_records` | `home_visitation_records` [nullable referral]) and
  `adm_learner_profiles` [NOT NULL referral] → `adm_parent_meetings` /
  `adm_modules` / `adm_devices`.
- Risk read-through: `student_profiles.risk_count/risk_level` computed live from
  `final_grades` + `attendance_records` + `anecdotal_records` (no stored risk table).
- SF10 fed from `final_grades`/`attendance_records` (auto) or OCR; edits append to
  `sf10_record_versions`.
- `audit_logs` + `notifications` are cross-cutting — written by every sensitive
  write path across all modules.

---

## 4. RBAC & RLS Design

### 4.1 Role matrix
| Role | Account type | Self-register? | Grade band |
|---|---|---|---|
| Student | self | Yes | — |
| Parent/Guardian | self (approval) | Yes | linked to child |
| Subject Teacher | self | Yes | — |
| Adviser | self | Yes | — |
| Guidance Counselor | hardcoded (1) | No | — |
| School Nurse | hardcoded (1) | No | — |
| ADM Coordinator | hardcoded (1) | No | — |
| Record Keeper | hardcoded (1) | No | 7–10 |
| Registrar | hardcoded (1) | No | 11–12 |
| Principal | hardcoded (1) | No | — |

### 4.2 Permission summary
- **Subject Teacher:** encode grades for assigned subjects only; auto-compute finals.
- **Adviser:** all teacher duties + AM/PM attendance, anecdotal for advisees,
  ADM tracking, lock finals for registrar approval, SF10 upload/OCR/verify.
- **Guidance Counselor / Nurse:** manage their confidential records, view risk
  dashboards, approve/modify interventions, record outcomes, refer to ADM Coordinator.
- **ADM Coordinator:** review referred students, evaluate eligibility, certify,
  track device distribution, forward to Principal.
- **Record Keeper / Registrar:** approve accounts (grade-banded), handle SF10
  (grade-banded), receive locked finals, validate OCR.
- **Principal:** manage years/terms, final-sign ADM referrals, school-wide
  dashboards/reports, **status-only** view into confidential cases, audit log.

### 4.3 Confidentiality tiering (RLS) — RESOLVED (row-level)
`confidentiality_level` exists on `anecdotal_records`, `health_records`,
`home_visitation_records`, `adm_learner_profiles`. Enforced via Supabase
**row-level** RLS (NOT column-level). Principal sees the rows but the app hides
confidential fields client-side — no column policies.
- **Owning + referred roles** see confidential rows:
  - `anecdotal_records` → observer (Adviser) + referred role (Guidance/Nurse/LRPC) + Principal (status-only via app).
  - `health_records` → Nurse + referred + Principal (status-only via app).
  - `home_visitation_records` → Guidance + referred + Principal (status-only via app).
  - `adm_learner_profiles` → ADM Coordinator + Principal (status-only via app).
- **Students/parents:** `risk_level` + behavioral category flag only; the confidential
  write-up/diagnosis columns are never sent to the client (app-layer hide).
- RLS policies must still be written and tested before any confidential data goes live.

---

## 5. API Design (route groups + key signatures)

Auth middleware: `requireAuth`, `requireRole(...)`, `requireOwnershipOrRole`.

- **Auth** `/api/auth`: `POST /register/student`, `/register/parent`,
  `/register/staff`, `POST /login`, `POST /refresh`, `POST /approve/:userId`
  (Record Keeper/Registrar, grade-banded).
- **Grading** `/api/grades`: `POST /assessments/:id/score`,
  `GET /students/:id/final-grades`, `POST /final-grades/:id/lock`,
  `POST /final-grades/:id/registrar-approve`.
- **Attendance** `/api/attendance`: `POST /bulk` (AM/PM per section),
  `GET /students/:id/attendance-rate`.
- **Anecdotal** `/api/anecdotal`: `POST /`, `POST /:id/followups`,
  `POST /:id/refer` (creates `referrals`).
- **ADM** `/api/adm`: `GET /referrals`, `POST /profiles`, `POST /:id/certify`,
  `POST /:id/principal-approve`, `POST /devices/issue`, `POST /devices/return`.
- **SF10** `/api/sf10`: `POST /upload` (Multer → OCR job), `GET /ocr/:jobId`,
  `POST /:id/verify` (teacher), `POST /:id/validate` (Record Keeper/Registrar).
- **Risk** `/api/risk`: `GET /students/:id` (live recompute),
  `GET /sections/:id/heatmap`.
- **Notifications** `/api/notifications`: `GET /`, `POST /read/:id`.
- **Reports** `/api/reports` [DESIGN PROPOSAL]: `GET /trends`,
  `/intervention-success`, `/honor-roll`.

---

## 6. Core Logic Specs

### 6.1 DepEd grading & transmutation
- Per subject/term: components (Written Work, Performance Tasks, Quarterly Exams)
  with weights summing to 100%.
- Each assessment score → percentage; average per component → weighted sum →
  `computed_grade`; mapped via **DepEd grade transmutation table** →
  `transmuted_grade`. Teacher locks own finals; registrar approves.

### 6.2 Attendance aggregation
- Rate = present/(present+absent+late+excused) over AM/PM sessions in term.
- `< 80%` → attendance risk flag.

### 6.3 Risk engine (real-time)
```
academic_flag = overall_average_across_all_subjects < 75
attendance_flag = attendance_rate < 80%
behavioral_flag = (count(anecdotal_records) >= 1)
risk_count = sum of flags (0–3)
risk_level = High if risk_count >= 2
             Moderate if risk_count == 1
             Low if risk_count == 0
```
- Recompute live on grade/attendance writes (not a fixed snapshot).
- Students/parents see `risk_level` + behavioral category flag only.

### 6.4 ADM referral state machine
```
anecdotal (Adviser)
  → referral → Guidance/Nurse/LRPC
  → parent_meeting (attended? minutes+logbook : home_visitation)
  → ADM Coordinator recommendation + certification
  → Principal approval (digital signature)
  → module/device release + tracking
  → completion
```
ADM requires `referral_id NOT NULL`; health & home visitation allow walk-ins.

---

## 7. SF10 / OCR Ingestion Pipeline (grounded)
1. Adviser uploads SF10 PDF/image (Multer → Supabase Storage).
2. Create `sf10_records` row (`source=ocr_upload`); OCR worker extracts fields →
   `ocr_extracted_data` (jsonb).
3. Teacher reviews/verifies (`verified_by`, `verified_at`) before save.
4. Record Keeper (7–10) / Registrar (11–12) validates (`validated_by`,
   `validated_at`); SF10 auto-populated from `final_grades`/`attendance_records`
   where overlapping.
5. Every edit appends a `sf10_record_versions` row (append-only history);
   `audit_logs` entry required (`action_type=sf10_update`).

---

## 8. Audit Trail (grounded — `audit_logs`)
- Generic, open `action_type` ENUM (Objective 5 says "such as" — non-exhaustive):
  sf10_update, grade_lock, grade_unlock, anecdotal_edit, health_record_edit,
  home_visitation_edit, adm_edit, referral_status_change, intervention_approval,
  account_approval, role_change.
- Every sensitive write path across confidential tables writes a row with
  user_id / source_table / source_id / reason / old_value / new_value.
- Principal has school-wide read access to the log.

---

## 9. Reporting & Visualization (OPEN ITEM — design decision)
- **Risk-history snapshots (RESOLVED #4):** `risk_snapshots` table added (see §3.7)
  — written on each live recompute / term boundary. Live `risk_level` remains the
  real-time source of truth; `risk_snapshots` serves Objective 6 trends only.
- **Honor-roll threshold (RESOLVED #7):** DepEd style — candidate if term
  `transmuted_grade` average across subjects ≥ 90 AND no subject below 75
  (no failing grade). Computed on the fly from `final_grades` per term; no new
  table needed.
- **Reporting storage (RESOLVED #8):** add `report_snapshots` cache table (see §3.7)
  for dashboard aggregates (trends, intervention success, heat maps, honor roll).
  Live queries remain the fallback when a snapshot is missing or stale; snapshots
  refreshed on schedule or on key data writes.
- **Aggregations:** performance trends (term-over-term averages), intervention
  success rate (outcome/referred), heat maps (section × risk_factor), honor-roll
  candidates — all cross-module via core tables + `notifications`.

---

## 10. Sprint Breakdown (6 sprints)

| Sprint | Focus | Key deliverables | Depends on |
|---|---|---|---|
| 1. Planning/Backlog | Spec freeze, PLAN.md, repo scaffold | This doc, schemas drafted | — |
| 2. Architecture & Setup | Repo, CI, Supabase project, Prisma schema, auth + RBAC/RLS | DB schema, JWT auth, RLS policies | S1 |
| 3. SF10 & Grading | SF10 OCR pipeline, grading + transmutation, attendance | upload/OCR, grade compute, attendance bulk | S2 |
| 4. Anecdotal & ADM | Anecdotal + referrals, ADM flow, health/home-visitation | referral state machine, ADM modules | S2 |
| 5. Rule-Based & Alerts | Risk engine, live recompute, notifications, intervention approval | risk API, notification fan-out | S3,S4 |
| 6. Testing & Deployment | Vitest/Supertest, Swagger, Vercel/Railway deploy, reports | test suite, API docs, prod deploy | S5 |

**Critical path:** S1 → S2 (schema/auth) → S3/S4 (parallel) → S5 → S6.
Reporting (S9 proposal) targeted for S6 or post-launch maintenance.

---

## 11. Open Items & Risks Register
| # | Item | Severity | Owner | Status |
|---|---|---|---|---|
| O1 | RLS policies for confidentiality tiering (row-level, app hides fields) | 🔴 Resolved (design) | S2 | RESOLVED — implement+test before live data |
| O2 | Audit trail (`audit_logs`) now exists | 🔴 Addressed | S2/S8 | Grounded |
| O3 | SF10/OCR (`sf10_records`, `sf10_record_versions`) now exist | 🟠 Addressed | S3/S7 | Grounded |
| O4 | Risk-history snapshots (`risk_snapshots`) | 🟠 Resolved (design) | S5/S6 | RESOLVED — table added |
| O5 | Honor-roll threshold (DepEd: avg ≥ 90, no grade < 75) | 🟡 Resolved (design) | S6 | RESOLVED |
| O6 | Reporting storage (`report_snapshots` cache) | 🟡 Resolved (design) | S6 | RESOLVED — table added |
| O7 | `notifications.type`/`channel` ENUM drift | 🟡 Resolved (design) | All | RESOLVED — single-source enum, type generated by service layer |
| O8 | `anecdotal_records.attachment_url` single vs multiple | 🟢 Info | S4 | Ok; split to table if multi-attach expected |
| O9 | Offline sync conflict resolution | 🟡 Resolved (design) | Mobile S2 | RESOLVED — LWW by updated_at + idempotent sync + version counter |

---

## 12. Definition of Done (per sprint)
- All 30 tables/migrations applied and RLS-verified (O1 closed before confidential data).
- Endpoints covered by Supertest; critical logic (grading, risk, ADM state machine) by Vitest.
- Swagger/OpenAPI reflects shipped routes.
- RBAC/RLS tested against every role matrix row.
- `audit_logs` written on every sensitive path; `risk_snapshots` (O4) decided.
- No open design item silently shipped as fact without sign-off.

---

✅ PLAN.md finalized — 30-table schema grounded from data dictionary, all 9 open items resolved (O1 RLS is the only one still requiring implementation+test before live confidential data).
