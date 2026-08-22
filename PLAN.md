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

**Scope note:** The audit-trail tables, SF10/OCR ingestion pipeline, and
reporting schema are project objectives but are **not yet formalized**. They
appear below as **[DESIGN PROPOSAL]** sections.

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

**Offline-sync strategy (mobile/Hive) [DESIGN PROPOSAL]**
- Hive stores the student/parent's own scoped records locally (read models only).
- Mutations allowed offline (e.g. Adviser attendance, anecdotal draft) are queued
  in a local outbox table with optimistic UI; flushed on reconnect with
  conflict resolution by `updated_at` + server authority.
- Sync endpoint: `POST /sync` accepts a batch of queued ops, returns accepted/rejected
  with server timestamps.

---

## 3. Database Schema Design

Grouped per the approved data model. Relations inferred from business rules.

### 3.1 Identity & accounts
- **users** — `id`, `email`, `password_hash`, `role` (enum), `account_type`
  (self_registered | hardcoded), `is_approved`, `created_at`.
  Role is **never** user-selectable; set by registration page + approval flow.
- **student_profiles** — `user_id`, `lrn`, `name`, `grade_level`, `section_id`,
  `school_year_id`, `overall_average` (cached), `risk_level` (cached).
- **parent_profiles** — `user_id`, `name`, `contact`.
- **parent_student_links** — `parent_id`, `student_id`, `approval_status`
  (pending/approved). Parent self-registers, linked to child, approval required.
- **staff_profiles** — `user_id`, `name`, `position`, `assigned_grade_band`
  (7–10 | 11–12) for Record Keeper/Registrar.

### 3.2 Academic structure
- **school_years** — `id`, `name`, `start_date`, `end_date`, `is_active`.
- **terms** — `id`, `school_year_id`, `term_no` (1–3), `start_date`, `end_date`.
- **sections** — `id`, `grade_level`, `name`, `school_year_id`, `adviser_id`.
- **subjects** — `id`, `code`, `name`, `grade_level`.
- **teacher_subject_assignments** — `id`, `teacher_id`, `subject_id`,
  `section_id`, `school_year_id`, `term_id`.

### 3.3 Grading
- **grade_components** — `id`, `subject_id`, `term_id`, `type`
  (written_work | performance_task | quarterly_exam), `weight` (%).
- **assessments** — `id`, `component_id`, `title`, `max_score`.
- **student_grades** — `id`, `assessment_id`, `student_id`, `score`, `percentage`.
- **final_grades** — `id`, `student_id`, `subject_id`, `term_id`,
  `computed_grade`, `transmuted_grade` (DepEd), `is_locked`, `locked_by`,
  `locked_at`, `registrar_approved`.

### 3.4 Attendance
- **attendance_records** — `id`, `student_id`, `date`, `session` (AM | PM),
  `status` (present | absent | late | excused). Tracked per half-day, not per period.

### 3.5 Behavioral & intervention
- **anecdotal_records** — `id`, `student_id`, `reporter_id`, `category`
  (behavioral | academic | emotional), `visibility_tier`, `write_up` (confidential),
  `created_at`, `is_flagged`.
- **anecdotal_record_followups** — `id`, `anecdotal_id`, `action`, `by_staff_id`,
  `timestamp`, `outcome`.
- **referrals** — `id`, `source_anecdotal_id`, `referred_to_role`
  (guidance | nurse | lrpc | adm_coordinator), `status`, `created_at`.
  ADM cases require `referral_id NOT NULL`.

### 3.6 Specialist modules
- **health_records** — `id`, `student_id`, `walk_in` (bool), `notes`
  (confidential), `seen_by_nurse_id`, `timestamp`. Walk-ins allowed.
- **home_visitation_records** — `id`, `student_id`, `referred_from`, `date`,
  `findings` (confidential), `by_counselor_id`. Walk-ins/self-initiation allowed.
- **adm_learner_profiles** — `id`, `student_id`, `referral_id`, `status`,
  `eligibility`, `enrolled`.
- **adm_parent_meetings** — `id`, `adm_profile_id`, `attended` (bool),
  `minutes`, `logbook_ref`.
- **adm_modules** — `id`, `adm_profile_id`, `module_no`, `distributed`,
  `submitted`, `completed`.
- **[DESIGN PROPOSAL] adm_device_distribution** — `id`, `adm_profile_id`,
  `device_type` (tablet), `issued_at`, `returned_at`, `status`.

### 3.7 System
- **notifications** — `id`, `user_id`, `module`, `event`, `payload`, `channel`
  (web | mobile | email), `read_at`.

### 3.8 [DESIGN PROPOSAL] — Audit trail
- **audit_log** — `id`, `actor_id`, `action_type`, `entity_type`, `entity_id`,
  `reason`, `before_json`, `after_json`, `timestamp`.
- Captured events: SF10 updates, grade locking/unlocking, anecdotal edits,
  role/account approvals, ADM certification issuance.

### 3.9 [DESIGN PROPOSAL] — SF10 / OCR ingestion
- **sf10_records** — `id`, `student_id`, `school_year_id`, `version`,
  `source` (auto_grade | ocr_upload), `status` (draft | verified | validated),
  `ocr_raw_json`, `created_by`, `validated_by`.
- **sf10_versions** — `id`, `sf10_record_id`, `snapshot_json`, `changed_by`,
  `reason`, `timestamp` (version history).
- **ocr_jobs** — `id`, `upload_id`, `storage_path`, `status`
  (pending | processed | failed), `confidence`, `extracted_json`.

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

### 4.3 Confidentiality tiering (RLS) [DESIGN PROPOSAL]
Enforced via Supabase Row-Level Security, NOT UI:
- `anecdotal_records`, `health_records`, `home_visitation_records` visible only to
  the owning role + referred roles.
- Principal policy: `SELECT` limited to non-confidential columns
  (`status`, `progress_flag`) for ADM/Nurse/Guidance cases — diagnosis/treatment
  columns excluded via column-level policy.
- Students/parents: `risk_level` + category-only behavioral flag; never the
  `write_up` column (RLS denies `write_up` select for those roles).

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

## 7. [DESIGN PROPOSAL] SF10 / OCR Ingestion Pipeline
1. Adviser uploads SF10 PDF/image (Multer → Supabase Storage).
2. `ocr_jobs` created; background worker extracts fields → `extracted_json`
   (LRN, name, subjects, grades, attendance).
3. Teacher reviews/verifies OCR result before save (`sf10_records.status=draft→verified`).
4. Record Keeper/Registrar validates (`status=validated`); SF10 auto-populated
   from grading system where overlapping.
5. Every change written to `sf10_versions` for history; audit_log entry required.

---

## 8. [DESIGN PROPOSAL] Audit Trail
- Central `audit_log` capturing actor, action_type, entity, before/after JSON,
  reason, timestamp.
- Triggered by: SF10 updates, grade lock/unlock, anecdotal edits, account
  approvals, ADM certification. Principal has read access to the log
  (school-wide).

---

## 9. [DESIGN PROPOSAL] Reporting & Visualization
- **Tables:** `report_cache` (materialized aggregates), `honor_roll`
  (computed per term: transmuted avg ≥ threshold, no behavioral flag).
- **Aggregations:** performance trends (term-over-term averages), intervention
  success rate (outcome/referred), heat maps (section × risk_factor),
  honor roll candidates.
- All aggregate across modules via the shared `notifications` + core tables.

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
| # | Item | Risk | Proposal owner |
|---|---|---|---|
| O1 | RLS policies for confidentiality tiering | High (privacy) | S2 |
| O2 | Audit trail table(s) | Med | S2/S8 |
| O3 | SF10/OCR ingestion schema | High (data loss) | S3/S7 |
| O4 | Reporting/visualization schema | Med | S6/S9 |
| O5 | Offline sync conflict resolution | Med | Mobile S2 |

---

## 12. Definition of Done (per sprint)
- All planned tables/migrations applied and RLS-verified.
- Endpoints covered by Supertest; critical logic by Vitest.
- Swagger/OpenAPI reflects shipped routes.
- RBAC/RLS tested against each role matrix row.
- No `[DESIGN PROPOSAL]` item silently shipped as fact without sign-off.

---

✅ PLAN.md complete — 12 sections, 4 open items flagged.
