# Zentra — Backend Architecture & Implementation Spec

> Scope: implementation companion to `PLAN.md` (§2, §3, §4, §5, §6). This doc is the
> authoritative backend engineering reference. Schema counts and role rules are taken
> verbatim from PLAN.md; where PLAN.md marks a table `[DESIGN PROPOSAL]` it is flagged
> here as **[PROPOSAL]** and MUST NOT be implemented as fact without sign-off.
>
> Stack (from PLAN.md §2): Node.js + Express + TypeScript, Prisma ORM, Supabase
> Postgres + Storage, JWT (access + refresh), bcrypt, Helmet, CORS, Pino, Multer.
> The backend is the single API consumed by both the Next.js web app and the Flutter
> mobile app.

---

## 1. Purpose & Scope

The backend exposes a versioned REST API (`/api`) that:

1. Authenticates users and enforces RBAC + row-level confidentiality (O1).
2. Serves the academic spine, grading, attendance, behavioral, ADM, SF10, risk, and
   reporting modules described in PLAN.md §3–§6.
3. Writes `audit_logs` on every sensitive path and fans out `notifications`.
4. Maintains `risk_snapshots` (O4) and `report_snapshots` (O6) caches.

**Out of scope (this doc):** frontend/shadcn UI, mobile/Hive sync internals (see PLAN.md
§2 offline-sync note), production infra hardening, third-party SIS integrations.

---

## 2. Project Layout

```
backend/
├── prisma/
│   ├── schema.prisma          # 30 models, mirrors PLAN.md §3
│   ├── seed.ts                # roles, school_year, sections bootstrap
│   └── migrations/            # SQL migrations (schema + RLS policies)
├── src/
│   ├── index.ts               # express bootstrap, helmet, cors, json limit
│   ├── app.ts                 # route mounting, error envelope
│   ├── config/
│   │   ├── env.ts             # validated env (zod) — DATABASE_URL, JWT_SECRET, etc.
│   │   └── supabase.ts        # supabase admin client (RLS-bypassing service role)
│   ├── lib/
│   │   ├── jwt.ts             # sign/verify access+refresh, role claim
│   │   ├── prisma.ts          # PrismaClient singleton
│   │   ├── pino.ts            # structured logger
│   │   ├── audit.ts           # writeAudit() helper
│   │   ├── notify.ts          # fanoutNotification() helper
│   │   └── errors.ts          # AppError, error envelope, Zod->400 mapping
│   ├── middleware/
│   │   ├── requireAuth.ts     # attach req.user from JWT
│   │   ├── requireRole.ts     # requireRole(...roles)
│   │   ├── requireOwnershipOrRole.ts  # row ownership OR role gate
│   │   ├── validate.ts        # zod body/params/query middleware
│   │   └── gradeBand.ts       # 7-10 vs 11-12 band guard for RK/Registrar
│   ├── modules/
│   │   ├── auth/              # register/login/refresh/approve
│   │   ├── grades/            # assessments, final-grades, lock, registrar-approve
│   │   ├── attendance/        # bulk AM/PM, rate
│   │   ├── anecdotal/         # CRUD, followups, refer
│   │   ├── referrals/         # status transitions
│   │   ├── adm/               # learner profiles, certify, principal-approve, devices
│   │   ├── sf10/              # upload, OCR job, verify, validate
│   │   ├── risk/              # live recompute, heatmap
│   │   ├── notifications/     # list, mark read
│   │   ├── reports/           # trends, intervention-success, honor-roll [PROPOSAL route group]
│   │   └── health/            # health_records, home_visitation_records
│   ├── services/              # business logic (depEd transmute, risk engine, ADM FSM)
│   └── jobs/                  # OCR worker, snapshot refresh scheduler
└── tests/                     # vitest (logic) + supertest (routes)
```

**Environment (validated by `config/env.ts`):**
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, bypasses RLS),
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL` (15m), `JWT_REFRESH_TTL`
(7d), `STORAGE_BUCKET`, `OCR_WORKER_URL`, `WEB_ORIGIN`, `MOBILE_ORIGIN`.

**Scripts:** `dev`, `build`, `start`, `prisma:migrate`, `prisma:generate`, `prisma:seed`,
`test`, `test:e2e`, `swagger:gen`.

---

## 3. Prisma Schema Grounding (30 tables)

Prisma owns table shape; **RLS lives in Supabase SQL migrations** (§5), not in Prisma.
The 30 models map 1:1 to PLAN.md §3. Key modeling notes:

- `Role` is a string ENUM (`student`, `parent`, `subject_teacher`, `adviser`, `nurse`,
  `adm_coordinator`, `guidance_counselor`, `record_keeper`, `registrar`, `principal`) —
  **never user-selectable**; set by registration route only.
- `confidentiality_level` columns exist on `anecdotal_records`, `health_records`,
  `home_visitation_records`, `adm_learner_profiles` (drives RLS in §5).
- `risk_level` / `risk_count` on `student_profiles` are **computed live** (§7.3), not
  written by app code except via the risk service refresh.

Representative model sketches (full 30 in `prisma/schema.prisma`):

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String   // bcrypt
  role          Role
  fullName      String
  contactNumber String?
  status        UserStatus @default(pending) // pending|active|suspended
  approvedBy    String?   // FK users.id, grade-banded
  approvedAt    DateTime?
  studentProfile   StudentProfile?
  parentProfile    ParentProfile?
  staffProfile     StaffProfile?
  createdAt        DateTime @default(now())
}

model StudentProfile {
  userId       String     @id
  lrn          String     @unique
  gradeLevel   GradeLevel // 7..12
  sectionId    String?
  birthdate    DateTime?
  address      String?
  photoUrl     String?
  riskCount    Int        @default(0) // 0..3, computed
  riskLevel    RiskLevel  @default(Low) // computed, visible to student+parent
  user         User       @relation(fields: [userId], references: [id])
}

model AnecdotalRecord {
  id                     String   @id @default(uuid())
  studentId              String
  observerId             String   // Adviser
  observationDatetime    DateTime
  descriptionOfIncident  String
  descriptionOfLocation  String?
  notesRecommendations   String?
  classPerformance       String?
  attendanceSummary      String?
  attachmentUrl          String?
  termId                 String
  confidentialityLevel   Confidentiality @default(restricted)
  referrals              Referral[]
}

model AdmLearnerProfile {
  id                 String   @id @default(uuid())
  studentId          String
  referralId         String   // NOT NULL — no walk-ins
  eligibilityStatus  AdmEligibility @default(pending)
  preparedBy         String   // ADM Coordinator
  approvedBy         String?  // Principal
  approvedAt         DateTime?
  certificationDetails Json?
  termId             String
  confidentialityLevel Confidential @default(restricted)
}
```

> Tables flagged `[DESIGN PROPOSAL]` in PLAN.md §5 (`/api/reports`) are **[PROPOSAL]**:
> implement only after the reporting route group is signed off. All other 30 tables
> are grounded.

---

## 4. Auth & RBAC Layer

### 4.1 JWT
- Access token (15m): `{ sub, role, gradeBand?, iat, exp }`. `role` claim gates routes.
- Refresh token (7d): stored hashed (`sha256`) in `refresh_tokens` (ephemeral table
  outside the 30 — operational, not domain). Rotation on use.
- `lib/jwt.ts`: `signAccess`, `signRefresh`, `verifyAccess`, `verifyRefresh`.

### 4.2 Middleware
- `requireAuth` — verify access token, attach `req.user {id, role, gradeBand}`.
- `requireRole(...roles)` — 403 unless `req.user.role ∈ roles`.
- `requireOwnershipOrRole(resourceUserId, ...roles)` — allows when `req.user.id ===
  resourceUserId` OR role matches.
- `gradeBand` — for `record_keeper` / `registrar`: resolve the target student's
  `grade_level`; `record_keeper` allowed only 7–10, `registrar` only 11–12. Enforced in
  `/approve/:userId`, `/sf10/:id/validate`, account-approval trails.

### 4.3 Registration rules (PLAN.md §4.1)
- `student`, `parent`, `subject_teacher`, `adviser` → self-register (`status=pending`).
- `nurse`, `guidance_counselor`, `adm_coordinator`, `record_keeper`, `registrar`,
  `principal` → **hardcoded single accounts**, no self-register; seeded/created by admin.
- Account activation (grade-banded): `POST /api/auth/approve/:userId` → only
  `record_keeper` (7–10) or `registrar` (11–12) per the student's grade band.

```ts
// requireRole + ownership example for a teacher scoring own assessment
router.post('/assessments/:id/score',
  requireAuth, requireRole('subject_teacher','adviser'),
  validate(scoreSchema), scoreAssessment);
```

---

## 5. RLS Policy Spec (Supabase SQL, row-level — O1)

RLS is **row-level**, not column-level (PLAN.md §4.3). Principal sees confidential rows
but the **app hides confidential fields client-side** (§6 field-hiding). Students/parents
never receive confidential write-up/diagnosis columns.

Policies per confidential table (pseudo-SQL, apply to `anecdotal_records`,
`health_records`, `home_visitation_records`, `adm_learner_profiles`):

```sql
-- Enable RLS
ALTER TABLE anecdotal_records ENABLE ROW LEVEL SECURITY;

-- Owning + referred roles see rows
CREATE POLICY anecdotal_visible ON anecdotal_records
  FOR SELECT TO authenticated
  USING (
    observer_id = auth.uid()                                  -- Adviser owner
    OR EXISTS (SELECT 1 FROM referrals r
               WHERE r.anecdotal_record_id = id
                 AND r.referred_to_role = current_role())     -- referred role
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'principal' -- status-only
  );

-- Only owner can insert/update their own
CREATE POLICY anecdotal_write ON anecdotal_records
  FOR INSERT TO authenticated
  WITH CHECK (observer_id = auth.uid());
```

`confidentiality_level` filters which **columns** the app serializes (app-layer), but the
DB row is visible to the owning/referred/principal roles above. Students/parents are
excluded from these policies entirely — they read `risk_level` + behavioral flag only via
dedicated, field-limited endpoints (`GET /api/risk/students/:id` limited projection).

**O1 gate:** RLS policies MUST be written and tested against every role matrix row
(PLAN.md §4.1) before any confidential data goes live. Add a `tests/rls.test.sql` that
asserts each role's visible rowset.

---

## 6. API Route Groups (expanded from PLAN.md §5)

Auth middleware legend: `A`=requireAuth, `R(roles)`=requireRole, `O`=ownership.

### 6.1 Auth `/api/auth`
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/register/student` | public | self; status=pending |
| POST | `/register/parent` | public | self (approval); links later |
| POST | `/register/staff` | public | subject_teacher/adviser only; pending |
| POST | `/login` | public | returns access+refresh |
| POST | `/refresh` | refresh token | rotates |
| POST | `/approve/:userId` | `R(record_keeper,registrar)` + gradeBand | sets approved_by/at, status=active |

### 6.2 Grading `/api/grades`
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/assessments/:id/score` | `R(subject_teacher,adviser)` | writes `student_grades`; recompute final |
| GET | `/students/:id/final-grades` | `A` + ownership/role | scoped projection |
| POST | `/final-grades/:id/lock` | `R(adviser)` | lock_status=locked, locked_by/at; audit |
| POST | `/final-grades/:id/registrar-approve` | `R(record_keeper,registrar)` + band | finalized_by/at; audit |

### 6.3 Attendance `/api/attendance`
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/bulk` | `R(adviser)` | AM/PM per section; idempotent by (student,date,session) |
| GET | `/students/:id/attendance-rate` | `A` + ownership/role | term-scoped rate |

### 6.4 Anecdotal `/api/anecdotal`
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/` | `R(adviser)` | creates record; confidentiality_level default restricted |
| POST | `/:id/followups` | `R(adviser,guidance_counselor,nurse,adm_coordinator,principal)` | fires `new_followup` |
| POST | `/:id/refer` | `R(adviser)` | creates `referrals`; notification to referred role |

### 6.5 Referrals `/api/referrals`
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/` | `R(guidance_counselor,nurse,adm_coordinator,principal)` | status board |
| POST | `/:id/status` | owning/referred role | pending→in_progress→resolved; audit |

### 6.6 ADM `/api/adm`
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/referrals` | `R(adm_coordinator,principal)` | status-only for Principal |
| POST | `/profiles` | `R(adm_coordinator)` | referral_id NOT NULL |
| POST | `/:id/certify` | `R(adm_coordinator)` | prepares certification |
| POST | `/:id/principal-approve` | `R(principal)` | approved_by/at = Principal digital sign; audit |
| POST | `/devices/issue` | `R(adm_coordinator)` | adm_devices row |
| POST | `/devices/return` | `R(adm_coordinator)` | returned_date |

### 6.7 SF10 `/api/sf10`
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/upload` | `R(adviser)` | Multer → Supabase Storage → OCR job |
| GET | `/ocr/:jobId` | `R(adviser)` | poll extracted jsonb |
| POST | `/:id/verify` | `R(subject_teacher,adviser)` | verified_by/at |
| POST | `/:id/validate` | `R(record_keeper,registrar)` + band | validated_by/at; append version |

### 6.8 Risk `/api/risk`
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/students/:id` | `A` + ownership/role | **limited projection** for student/parent (risk_level + flag only) |
| GET | `/sections/:id/heatmap` | `R(principal,adviser,guidance_counselor,nurse)` | section × risk_factor counts |

### 6.9 Notifications `/api/notifications`
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/` | `A` (own) | filter by type/date |
| POST | `/read/:id` | `A` (own) | mark read |

### 6.10 Reports `/api/reports` **[PROPOSAL]**
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/trends` | `R(principal,registrar,record_keeper)` | reads `report_snapshots` type=trends |
| GET | `/intervention-success` | `R(principal,guidance_counselor)` | outcome/referred |
| GET | `/honor-roll` | `R(principal,registrar,record_keeper)` | live compute per O5 |

### 6.11 Audit (read-only) `/api/audit`
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/` | `R(principal)` | school-wide `audit_logs`; filter by action/user/date/table |

---

## 7. Core Logic Modules

### 7.1 DepEd grading & transmutation (PLAN.md §6.1)
```
per subject/term:
  components = [Written Work, Performance Task, Quarterly Exam]  // weights sum=100
  for each component: avg(percentage_score of its assessments)
  computed_grade = Σ (component_avg * weight/100)
  transmuted_grade = mapToDepEdTable(computed_grade)  // 60-100 scale
  remarks = transmuted_grade >= 75 ? Passed : Failed
```
Triggered on every `student_grades` write; recomputes `final_grades.computed_average`,
`transmuted_grade`, `remarks`. Teacher locks; registrar approves (§6.2).

### 7.2 Attendance aggregation (PLAN.md §6.2)
```
rate = present / (present + absent + late + excused)   // over AM/PM in term
attendance_flag = rate < 0.80
```

### 7.3 Risk engine — live recompute (PLAN.md §6.3)
```
academic_flag   = overall_average_across_all_subjects < 75
attendance_flag = attendance_rate < 0.80
behavioral_flag = count(anecdotal_records) >= 1
risk_count = sum(flags)                       // 0..3
risk_level = risk_count>=2 ? High
           : risk_count==1 ? Moderate
           : Low
```
- Recompute on grade/attendance/anecdotal writes; write `student_profiles.risk_count/
  risk_level` AND append a `risk_snapshots` row (O4).
- **Field hiding for student/parent:** `GET /api/risk/students/:id` returns ONLY
  `{ risk_level, behavioral_category_flag }` — confidential source columns never serialized.

### 7.4 ADM referral state machine (PLAN.md §6.4)
```
anecdotal (Adviser)
  → referral → Guidance/Nurse/LRPC
  → parent_meeting (attended? minutes+logbook : home_visitation)
  → ADM Coordinator recommendation + certification
  → Principal approval (digital signature)   // POST /adm/:id/principal-approve
  → module/device release + tracking
  → completion
```
Implement as explicit status transitions in `adm` service; illegal transitions → 409.
`adm_learner_profiles.referral_id` NOT NULL; `health_records`/`home_visitation_records`
allow nullable referral (walk-ins).

### 7.5 Notification type generation (O7 — single source)
`notifications.type` is **generated by the service layer** from `source_table`+`action`,
never caller-supplied. Shared enum in `lib/notify.ts`:
```ts
type NotifType =
  | 'new_adm_case' | 'account_approval' | 'intervention_approved'
  | 'sf10_validated' | 'audit_alert' | 'new_followup' | 'referral_status_change';
```
`fanoutNotification({userId, sourceTable, action, channel:['web','mobile','email']})`
derives `type`, writes row, pushes to web socket/email per `channel`.

### 7.6 SF10 / OCR pipeline (PLAN.md §7)
1. Adviser `POST /upload` → Multer → Supabase Storage → enqueue OCR job.
2. Create `sf10_records` (`source=ocr_upload`); worker fills `ocr_extracted_data` (jsonb).
3. Teacher `POST /:id/verify` (`verified_by/at`).
4. RK/Registrar `POST /:id/validate` (grade-banded) — auto-populate from
   `final_grades`/`attendance_records` where overlapping.
5. Every edit → append `sf10_record_versions` (append-only) + `audit_logs`
   (`action_type=sf10_update`, old/new jsonb).

---

## 8. Cross-Cutting Services

- **`audit.ts` → `writeAudit({userId, actionType, sourceTable, sourceId, reason, oldValue, newValue})`**
  Called by EVERY sensitive write path (grade lock, sf10 update, anecdotal edit,
  health/home_visitation edit, adm edit, referral status change, intervention approval,
  account approval, role change). `actionType` from the open ENUM in PLAN.md §3.7/§8.
- **`notify.ts` → `fanoutNotification(...)`** — see §7.5.
- **`risk.ts` → `recomputeRisk(studentId)`** — §7.3; also invoked by a scheduler at term
  boundaries to snapshot all students into `risk_snapshots`.
- **Snapshot refresh (O4/O6):** on key writes (grade lock, attendance bulk, intervention
  outcome, ADM certify) invalidate the relevant `report_snapshots` row; a scheduled job
  (or on-demand `POST /reports/refresh`) regenerates `payload` (jsonb). Live query is the
  fallback when a snapshot is missing/stale (PLAN.md §9).

---

## 9. Error Handling & Validation

- All request bodies/params/query validated with **Zod** at the `validate` middleware;
  failures → 400 with field-level messages.
- `lib/errors.ts` `AppError(status, code, message)`; central handler returns a consistent
  envelope:
  ```json
  { "error": { "code": "GRADE_LOCK_CONFLICT", "message": "Final already locked", "fields": null } }
  ```
- `Pino` structured logs: `reqId`, `userId`, `route`, `latencyMs`, `status`. No secrets
  in logs.
- Helmet + CORS (allow `WEB_ORIGIN`, `MOBILE_ORIGIN` only). JSON body limit 1mb; Multer
  caps upload size (SF10/ADM/docs).

---

## 10. Testing & Definition of Done

**Unit (Vitest)** — core logic: §7.1 transmutation table, §7.2 attendance rate, §7.3
risk engine (all 8 flag combinations), §7.4 ADM FSM illegal-transition rejection, §7.5
notification type derivation.

**Integration (Supertest)** — every route in §6 with each role from the §4.1 matrix;
assert 403/404/ownership behavior.

**RLS (SQL tests)** — `tests/rls.test.sql`: for each confidential table, assert visible
rowset per role (owner, referred, principal status-only, student/parent excluded). **O1
must pass before any confidential data is seeded.**

**Swagger/OpenAPI** — `swagger:gen` emits docs reflecting shipped routes only (no
[PROPOSAL] routes until signed off).

**Definition of Done (per PLAN.md §12)** — 30 tables migrated + RLS-verified (O1 closed);
endpoints under Supertest; critical logic under Vitest; Swagger current; RBAC/RLS tested
against every role row; `audit_logs` on every sensitive path; `risk_snapshots` (O4) and
`report_snapshots` (O6) wired; no [PROPOSAL] shipped as fact without sign-off.

---

✅ `docs/backend.md` — full backend implementation spec grounded in PLAN.md §2–§6:
layout, Prisma grounding, auth/RBAC, RLS SQL, 11 route groups, 6 core-logic modules,
cross-cutting services, error envelope, and testing/DoD.
