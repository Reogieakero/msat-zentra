# Zentra Backend — Stack & Infrastructure

> Status: documents the **actual** implemented backend as of this writing, plus a
> reference "intended stack" paragraph and a gap list. Items marked **[FUTURE]**
> are not yet implemented.

---

## 1. Intended Stack (reference paragraph)

The backend infrastructure is developed using Node.js, Express.js, and TypeScript
to build secure and efficient RESTful APIs. Prisma ORM simplifies database
operations with PostgreSQL hosted on Supabase, while Supabase Storage manages
uploaded files and Supabase Auth provides secure Google Sign-In authentication.
User authentication and authorization are secured through JSON Web Tokens (JWT),
while Argon2id is used for password hashing. Additional technologies, including
Zod for input validation, Multer for file uploads, Helmet for HTTP security
headers, CORS for controlled cross-origin access, Pino for logging, Nodemailer
for email notifications, Redis (via Upstash) for caching and rate limiting,
Swagger/OpenAPI for API documentation, and Jest for automated testing, enhance
the security, performance, reliability, and maintainability of the backend
services.

> Note: the live backend diverges from this paragraph in several places. See
> §3 (current vs planned) and §4 (future work).

---

## 2. Implemented Stack (verified)

| Concern | Technology | Notes |
|---|---|---|
| Runtime / Language | Node.js + TypeScript | `tsx` for dev, `tsc` for build/typecheck |
| Web framework | Express 4 | `app.ts` + `index.ts` entrypoint, port from `PORT` (default 4000) |
| ORM / DB | Prisma 6 + PostgreSQL | Hosted on Supabase (connection via `DATABASE_URL` pooler) |
| Auth | JWT (access + refresh) | `jsonwebtoken` + `src/lib/jwt.ts`; roles embedded as claim |
| Password hashing | **Argon2id** (`argon2`) | Migrated from bcryptjs this cycle; used in register/login/refresh + seed |
| Input validation | Zod 3 | `validate` middleware (`src/middleware/validate.ts`) |
| Security headers | Helmet 8 | Applied globally in `app.ts` |
| CORS | cors 2 | Allowlist `WEB_ORIGIN` / `MOBILE_ORIGIN` |
| Logging | Pino 9 | `src/lib/pino.ts`; pretty in dev |
| Testing | **Vitest 2** + Supertest 7 | `npm test` (not Jest) |
| Error handling | Custom `AppError` + handlers | `src/lib/errors.ts`, `notFound` + `errorHandler` |

Supabase is consumed **only as the Postgres host** today. The `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` env vars exist and are parsed
in `src/config/env.ts`, but no Supabase client is instantiated and no Storage or
Auth calls are wired into routes yet.

---

## 3. Current vs Planned

| Capability | Status | Detail |
|---|---|---|
| Express + TS + Prisma + Postgres | ✅ Done | Core API live; modules: auth, grades, attendance, anecdotal, referrals, adm, sf10, risk, notifications, audit |
| JWT + Argon2id | ✅ Done | Login/register/refresh + RBAC (`requireAuth`, `requireRole`, `requireOwnershipOrRole`) |
| Zod / Helmet / CORS / Pino | ✅ Done | Global middleware in place |
| Vitest/Supertest tests | 🟡 Partial | Test tooling present; coverage not yet comprehensive |
| Supabase Auth + Google Sign-In | ❌ Not wired | Keys present, no client/OAuth/passport in source |
| Supabase Storage uploads | ❌ Not wired | `STORAGE_BUCKET` env only; `OCR_WORKER_URL` empty; no Multer/Storage client |
| Multer (uploads) | ❌ Absent | No file-upload handling in routes |
| Nodemailer (email) | ❌ Absent | `[FUTURE]` — see §4 |
| Redis / Upstash (cache + rate limit) | ❌ Absent | `[FUTURE]` — see §4 |
| Swagger / OpenAPI docs | ❌ Absent | `[FUTURE]` — see §4 |
| Jest | ❌ Not used | Project standardized on Vitest instead |

---

## 4. Future Work (explicitly not yet implemented)

These are **planned / possible in future development** and are NOT part of the
current backend. They are recorded here so the stack paragraph's intent is tracked.

### 4.1 Swagger / OpenAPI documentation
- Add `swagger-jsdoc` + `swagger-ui-express` (or equivalent) to expose
  `/api/docs`.
- Annotate routes or generate from Zod schemas. No spec exists yet.

### 4.2 Redis via Upstash (caching + rate limiting)
- Add `@upstash/redis` and `@upstash/ratelimit`.
- Use for: response caching of heavy report/risk aggregates, and per-IP / per-user
  rate limiting on auth + write routes.
- Requires `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env (not present).

### 4.3 Nodemailer (email notifications)
- Add `nodemailer` to fan out email channel from `src/lib/notify.ts`
  (currently web/mobile only; `channel` enum already supports `"email"`).
- Requires SMTP / transport credentials env (not present).

---

## 5. Environment Variables

Defined in `backend/.env` (gitignored). Reference shape:

```
PORT=4000
NODE_ENV=development
SUPABASE_URL=...            # parsed, not yet used by a client
SUPABASE_ANON_KEY=...       # parsed, not yet used
SUPABASE_SERVICE_ROLE_KEY=... # optional, not yet used
DATABASE_URL=...            # Postgres connection (Supabase pooler)
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
WEB_ORIGIN=http://localhost:3000
MOBILE_ORIGIN=msat-zentra://app
STORAGE_BUCKET=zentra-docs  # not yet wired
OCR_WORKER_URL=             # empty
```

Future additions (not present): Upstash Redis REST URL/token, SMTP transport,
Swagger host (optional).

---

## 6. Notes / Decisions

- Auth hashing was migrated **bcryptjs → argon2** this cycle (commit `f6b0081`).
  `PLAN.md` §2 still says "bcrypt" — flagged as a doc mismatch to update.
- Testing standard is **Vitest**, not Jest (the reference paragraph says Jest).
- Supabase is used as the database host only; Auth/Storage are future increments.
