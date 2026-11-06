# Zentra

**Student Information & Management System for Mati School of Arts and Trades**

Zentra brings the day-to-day life of a school into one place — grades, attendance,
learner records, behavior documentation, early-warning alerts, and the ADM
(Alternative Delivery Mode) process — for Grades 7–12 on a **trimester calendar**
(three terms per school year).

It is built around one simple idea:

> **Give every role exactly the information it needs, catch struggling learners
> early, and keep a clear record of every sensitive action.**

---

## Table of contents

- [What Zentra does](#what-zentra-does)
- [Who it is for](#who-it-is-for)
- [Feature highlights](#feature-highlights)
- [How the pieces fit together](#how-the-pieces-fit-together)
- [Role walkthrough](#role-walkthrough)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Seeding demo data](#seeding-demo-data)
- [Testing, typechecking & building](#testing-typechecking--building)
- [Security & privacy](#security--privacy)
- [Current status & known limitations](#current-status--known-limitations)
- [More documentation](#more-documentation)

---

## What Zentra does

Schools keep a lot of information about learners in a lot of different places.
Zentra replaces that patchwork with a single, role-aware system that handles:

| Area | What it means in practice |
|---|---|
| **Grading** | Teachers record scores per component, the system computes DepEd transmuted grades, and final grades go through a lock → adviser approval flow. |
| **Attendance** | Daily AM/PM attendance and per-subject attendance, with automatic absence sweeps and attendance-rate heatmaps. |
| **Learner records** | SF10 (Form 137) management: upload, OCR-assisted capture, versioning, verification, validation, and release. |
| **Behavior documentation** | Confidential anecdotal records (GCForm-01), folders, signatures, and an exportable Excel workbook. |
| **Early warning** | A rule-based risk engine flags learners with low grades, low attendance, or behavioral records, then routes them into interventions. |
| **Referrals & counseling** | A full referral pipeline from triage to guidance/nurse sessions, follow-ups, notes, and close-out. |
| **ADM** | End-to-end Alternative Delivery Mode case tracking: eligibility, parent meetings, home visitation, certification, principal approval, modules, devices, and completion. |
| **Oversight** | School-wide dashboards, reports, honor roll, heatmaps, audit logs, and notifications. |

Everything is **term-aware**, so the same learner, section, and teacher data can
be viewed correctly across the three terms of a school year.

---

## Who it is for

Zentra supports **10 roles**, each with its own workspace and permissions.

| Role | Main responsibility |
|---|---|
| **Student** | See assigned modules and submit work (link, file, or physical). |
| **Parent / Guardian** | Account support; a dedicated portal is planned (see limitations). |
| **Subject Teacher** | Grading, per-subject attendance, anecdotal records, class schedule. |
| **Adviser** | Section roster, advisory attendance, grade approvals, ADM monitoring, advisory modules. |
| **Guidance Counselor** | Referrals, counseling sessions, at-risk alerts, interventions, anecdotal access. |
| **School Nurse** | Clinic referrals, health records, ADM/health queues. |
| **ADM Coordinator** | ADM cases, parent meetings, devices, certification, forwarding to the principal. |
| **Record Keeper** (Grades 7–10) | SF10 records, final grades, adviser access requests, accounts. |
| **Registrar** (Grades 11–12) | Same records desk for the senior high band, plus student account approval. |
| **Principal** | School-wide oversight, term management, final ADM approval, reports, audit. |

Grade-banded roles are deliberate: record keepers handle **Grades 7–10**, registrars
handle **Grades 11–12**, and the system enforces the boundary on the server.

---

## Feature highlights

### 📚 Teaching & grading
- Grade components (Written Work, Performance Task, Exam) with configurable weights.
- Assessment-level score entry and DepEd transmutation.
- Draft → lock → adviser approval workflow for final grades.
- Grade flags that escalate when a learner's average falls below thresholds.
- Master Teacher support: separate band seats for Grades 7–10 and 11–12.

### 🗓️ Attendance
- Daily AM/PM attendance sheets.
- Per-subject attendance taking with weekend, future-date, and Philippine-holiday guards.
- Hourly automatic-absent sweep.
- Attendance rate summaries and heatmaps by section, subject, and learner.

### 📄 Records (SF10)
- Upload photos or files of existing SF10 records with OCR-assisted text capture.
- Append-only version history — nothing is overwritten silently.
- Lifecycle: **verify → validate → release**, with banded desk access.
- Advisers can request time-limited SF10 access for their learners.

### 🧠 Early intervention
- Rule-based risk engine: grade average < 75, attendance < 80%, or at least one
  anecdotal record.
- Low / Moderate / High risk levels with hourly snapshots for trend tracking.
- At-risk boards that merge referrals and interventions into one paginated queue.
- Interventions created automatically from risk, then tracked to an outcome.

### 🤝 Referrals, guidance & health
- Referral intake with a seven-step status pipeline.
- Escalate, reassign, add notes, schedule follow-ups, dismiss with reason.
- Counseling sessions and health records with attachments.
- Close-out requires at least one completed session, so cases cannot be closed empty.

### 🎯 ADM (Alternative Delivery Mode)
- Eight-stage case flow:
  `anecdotal → consultation → meeting_parents → home_visitation → certification → principal_approval → enrollment_monitoring → completion`.
- Parent meeting invitations, minutes, logbooks, and attachments.
- Module tracking that merges coordinator modules with section-wide advisory modules.
- Device issuance and return tracking.
- Principal signature required for final approval (drawn signature stored once, reused).

### 📊 Oversight & reporting
- Principal overview of academics, attendance, risk, and ADM.
- Academic, attendance, and records heatmaps.
- Honor roll with live computation.
- Report snapshots cached for heavy reports.
- Full audit trail for sensitive actions.
- In-app notifications with per-role real-time updates.

---

## How the pieces fit together

A typical learner journey through Zentra:

```text
Enrollment / roster
        │
        ▼
Grading + Attendance  ──►  Risk engine  ──►  Flags & alerts
        │                     │
        ▼                     ▼
Anecdotal records  ──►  Referrals  ──►  Guidance / Nurse sessions
                                            │
                                            ▼
                                    Interventions & outcomes
                                            │
                                            ▼
                                          ADM case
                                            │
                                            ▼
                         Certification ──► Principal approval ──► Completion
```

Supporting all of this:

- **Audit log** — sensitive read and write actions are recorded.
- **Notifications** — the right people are told when something needs attention.
- **Term scoping** — every query resolves to the correct school year and term.
- **Real-time updates** — desks refresh as cases move.

---

## Role walkthrough

### Student portal
- Sign in and land on **My Modules**.
- See posted modules with status: pending, submitted, overdue.
- Submit work as a **link**, an **uploaded file** (PDF/Word, ≤ 10 MB), or a
  **physical submission** passed in person.

### Teacher workspace
- **Overview** — today's classes, tasks, and quick actions.
- **Classes** — sections and subjects you handle.
- **Grading** — score entry, weights, and final-grade locking.
- **Attendance** — daily and per-subject sheets.
- **Anecdotal** — record observations, manage folders, and chat-style intake.
- **Advisory** (advisers) — roster, advisee academics and attendance, grade approvals,
  ADM monitoring, advisory modules, SF10 access requests.
- **Schedule / Settings** — timetable and personal preferences.

### Guidance desk
- Overview, at-risk **alerts**, **referrals** queue, **interventions**, anecdotal
  records, counseling **session documents**, and settings.

### Nurse desk
- Overview, **referrals** (clinic matters + ADM cases), **health records**, and settings.

### ADM Coordinator desk
- Overview, **enrolled** learners, **referrals**, certification board, **devices**, and settings.

### Records desks (Record Keeper & Registrar)
- Accounts, adviser access requests, final grades, SF10 records, and overview.

### Principal desk
- Overview, academics and scheduling, risk dashboards/heatmaps/interventions,
  ADM approvals, reports, honor roll, audit, and settings (including term scope).

---

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, TanStack Query 5, Axios, Tailwind 4 + shadcn/radix, CSS Modules |
| **Backend** | Node.js, Express 4, TypeScript (ESM), Prisma 7, Zod, pino |
| **Database** | PostgreSQL (Supabase pooler) — 49 Prisma models |
| **Auth** | JWT access + refresh (httpOnly cookie), Argon2id password hashing |
| **Storage** | Supabase Storage (documents, SF10 files, referral attachments) |
| **Caching** | Upstash Redis (optional, fail-open) + ETag + report snapshots |
| **Realtime** | Supabase `postgres_changes` channels per role |
| **Testing** | Vitest + Supertest (no live DB required) |
| **CI** | GitHub Actions — generate, migrate (main only), typecheck, test, build |

---

## Project structure

```text
msat-zentra/
├── backend/
│   ├── src/
│   │   ├── app.ts              # middleware order + all API mounts
│   │   ├── index.ts            # server entry + hourly sweeps
│   │   ├── modules/            # one folder per domain (auth, grades, attendance, …)
│   │   ├── services/           # cross-module domain logic (risk, grading, …)
│   │   ├── lib/                # shared kernel (prisma, cache, audit, notify, …)
│   │   ├── middleware/         # auth, grade band, term scope, validation
│   │   ├── config/env.ts       # validated environment schema
│   │   └── generated/prisma/   # committed Prisma client
│   ├── prisma/                 # schema, migrations, seed scripts
│   └── tests/                  # Vitest + Supertest suites
│
├── frontend/
│   └── src/
│       ├── app/                # login, register, and one route tree per role
│       ├── components/         # shared UI kits, shadcn primitives, sidebars
│       ├── services/           # TanStack Query hooks + API calls per role
│       └── lib/                # api client, auth, term, realtime, labels
│
├── docs/
│   ├── architecture/           # system architecture
│   ├── guides/                 # user guide + developer guide
│   ├── reports/                # dated audit / performance reports
│   ├── role-modules/           # per-role specifications
│   └── …                       # ERDs, backend specs, plans
├── PLANS/                      # per-role wiring plans
├── PLAN.md                     # original system plan
├── SYSTEM_UNDERSTANDING.md     # deep onboarding guide
└── AGENTS.md                   # working memory for contributors
```

---

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Supabase recommended)
- (Optional) Supabase project for Storage and Realtime
- (Optional) Upstash Redis for response caching

### 1. Backend

```bash
cd backend
npm ci
cp .env.example .env
```

Fill in `.env`:

```dotenv
SUPABASE_URL=
SUPABASE_ANON_KEY=
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
# Optional (server-side storage writes)
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Then:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run dev          # http://localhost:4000
```

Health check: `GET http://localhost:4000/health`

### 2. Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local
```

Fill in `.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Then:

```bash
npm run dev          # http://localhost:3000
```

> These `NEXT_PUBLIC_*` values are inlined at build time, so set them before building
> for any deployed environment.

### 3. Database security policies (optional, manual)

```bash
cd backend
npx tsx prisma/apply-rls.ts
```

---

## Seeding demo data

The backend ships with numbered seed scripts:

```bash
cd backend
npm run prisma:seed                 # base accounts
npm run prisma:seed:school          # full demo school
npm run prisma:seed:school:small    # smaller dataset
npm run prisma:seed:school:dry      # preview first
npm run prisma:gradebook            # populate grades
```

See `backend/package.json` for the complete list (ADM, honor roll, guidance docs,
100-learner top-ups, wipe, and more).

---

## Testing, typechecking & building

**Backend**

```bash
cd backend
npm run typecheck
npm test
npm run build
npm start
```

**Frontend**

```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
npm run lint
npm run build
npm start
```

CI runs the same checks on every push. Pushes to `main` also deploy pending
migrations to the configured database, so treat migrations as production operations.

---

## Security & privacy

Zentra handles grades, attendance, health records, and confidential behavioral
documentation, so access is restricted by design:

- **Role-based access control** — server-side `requireRole` / ownership checks on
  every sensitive route; the frontend hides routes but never replaces enforcement.
- **Grade-band guards** — record keepers and registrars can only reach their band.
- **Confidentiality tiers** — anecdotal and referral data is `restricted` or
  `confidential`, with field-level omission for roles that may only see status.
- **Audit trail** — sensitive actions are written to `AuditLog`.
- **Row-level security** — optional Postgres policies in
  `backend/prisma/migrations/0001_rls.sql`.
- **Secure auth** — Argon2id hashing, short-lived access tokens, rotating refresh
  cookies, rate limiting, Helmet, and strict CORS allowlists.
- **No secrets in git** — keep `.env*` local; never commit keys.

---

## Current status & known limitations

Zentra is actively developed, and some parts are ahead of others:

- **Parent portal** — parent accounts are supported, but there is no parent desk yet;
  the role currently has no workspace.
- **Deployment** — no production deployment is included in this repository. The
  planned shape is Vercel (web) + Railway/Render/VPS (backend) + Supabase (DB/storage).
- **Mobile app** — lives on separate branches, not in this repo.
- **e2e tests** — Playwright is installed but no full end-to-end suite is present yet.
- **Doc drift** — some older audit documents describe issues that have since been
  fixed; prefer this README, `AGENTS.md`, and the current code.

---

## More documentation

| Document | What it covers |
|---|---|
| [`docs/README.md`](docs/README.md) | Index of all documentation |
| [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md) | Runtime architecture, layers, data model, cross-cutting concerns |
| [`docs/guides/user-guide.md`](docs/guides/user-guide.md) | Role-by-role guide for everyone who uses Zentra |
| [`docs/guides/developer-guide.md`](docs/guides/developer-guide.md) | Setup, conventions, testing, migrations, gotchas |
| [`SYSTEM_UNDERSTANDING.md`](SYSTEM_UNDERSTANDING.md) | Deep, evidence-cited onboarding guide |
| [`AGENTS.md`](AGENTS.md) | Working memory: architecture, conventions, commands, gotchas |
| [`PLAN.md`](PLAN.md) | Original system plan and design decisions |
| [`docs/role-modules/`](docs/role-modules) | Per-role module specifications |
| [`docs/zentra-erd-full.mmd`](docs/zentra-erd-full.mmd) | Full entity-relationship diagram |
| [`docs/reports/`](docs/reports) | Dated audit and performance reports (historical) |

---

<p align="center">
  <strong>Zentra</strong> — one school, one system, every learner accounted for.
</p>
