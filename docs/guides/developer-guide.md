# Zentra — Developer Guide

> **Who this is for:** contributors setting up Zentra locally, adding features,
> or reviewing the codebase.
>
> Read `AGENTS.md` first — it is the short working-memory map of the project.
> This guide expands the setup and day-to-day workflow. For the big picture see
> [`../architecture/system-architecture.md`](../architecture/system-architecture.md).

---

## 1. Prerequisites

- Node.js **20+**
- A PostgreSQL database (Supabase recommended)
- Optional but useful:
  - A Supabase project (Storage + Realtime)
  - Upstash Redis (response caching)
- Git

No root `package.json` or workspace — run commands inside `backend/` or
`frontend/`.

---

## 2. Repository layout

```
msat-zentra/
├── backend/
│   ├── src/
│   │   ├── app.ts             # middleware order + every API mount
│   │   ├── index.ts           # server entry + hourly sweeps
│   │   ├── config/env.ts      # fail-fast Zod env schema
│   │   ├── modules/           # one folder per domain route surface
│   │   ├── services/          # cross-module domain logic
│   │   ├── lib/               # shared kernel (prisma, cache, audit, notify, …)
│   │   ├── middleware/        # auth, grade band, term scope, validate, rate limit
│   │   └── generated/prisma/  # committed generated Prisma client
│   ├── prisma/                # schema, migrations, seeds, RLS script
│   └── tests/                 # Vitest + Supertest suites
├── frontend/
│   └── src/
│       ├── app/               # one route tree per role + auth + print views
│       ├── components/        # shared kits, shadcn primitives, sidebars
│       ├── services/          # TanStack Query hooks + API calls per role
│       └── lib/               # api client, auth, term, realtime, labels
├── docs/                      # architecture, guides, specs, diagrams, reports
├── PLANS/                     # per-role wiring plans
├── PLAN.md                    # original system plan
├── SYSTEM_UNDERSTANDING.md    # deep onboarding notes
└── AGENTS.md                  # working memory / conventions
```

---

## 3. Local setup

### 3.1 Backend

```bash
cd backend
npm ci
cp .env.example .env
```

Fill `.env`:

```dotenv
SUPABASE_URL=
SUPABASE_ANON_KEY=
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
# Optional — server-side storage writes
SUPABASE_SERVICE_ROLE_KEY=
# Optional — response caching (fails open if missing)
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

### 3.2 Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local
```

Fill `.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Then:

```bash
npm run dev          # http://localhost:3000
```

> `NEXT_PUBLIC_*` values are **inlined at build time**. Set them before building
> for any deployed environment.

### 3.3 RLS policies (manual, optional)

```bash
cd backend
npx tsx prisma/apply-rls.ts
```

RLS lives in `backend/prisma/migrations/0001_rls.sql` and is kept in sync with
schema changes by hand.

---

## 4. Everyday commands

### Backend (`cd backend`)

| Command | What it does |
|---|---|
| `npm run dev` | tsx watch server on port 4000 |
| `npm run build` | Compile + copy anecdotal assets |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Vitest + Supertest (no live DB) |
| `npm run test:watch` | Watch mode |
| `npm run prisma:generate` | Regenerate the committed Prisma client |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:deploy` | Apply pending migrations |

### Frontend (`cd frontend`)

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on port 3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npx tsc --noEmit -p tsconfig.json` | Type check |
| `npm run lint` | ESLint (includes the React Compiler gate) |

### Helper

`push.bat "message"` stages everything, commits, and pushes `main`.

---

## 5. Seeding demo data

```bash
cd backend
npm run prisma:seed                 # base accounts
npm run prisma:seed:school          # full demo school
npm run prisma:seed:school:small    # smaller dataset
npm run prisma:seed:school:dry      # preview first
npm run prisma:gradebook            # populate grades
```

`backend/package.json` lists the full set (ADM, honor roll, guidance session
documents, 100-learner top-ups, wipe, and more). Seeding assumes the schema is
already migrated.

---

## 6. Backend conventions

### 6.1 Language and imports

- Strict TypeScript, **ESM**.
- Every relative import ends in `.js` — missing extensions break the build.
- `backend/tsconfig.json` excludes `tests/` and `prisma/`.

### 6.2 Layering

```
routes (thin)  →  repository / service  →  Prisma
                        ↓
                   lib/ shared kernel
```

- Route handlers: validate the request with Zod, call one service/repository,
  return JSON. No business rules inline.
- Domain logic: `modules/<domain>/*.repository.ts` or `services/<domain>.ts`.
- Shared infrastructure: `lib/`.

### 6.3 Validation and errors

- Zod schemas live next to the domain in `*.schemas.ts` and are applied with
  `validate`.
- Throw `AppError(status, CODE, message, fields?)`. Prisma errors are mapped in
  `lib/errors.ts` — don't reinvent them.

### 6.4 Writes

Every sensitive write should include the right cross-cutting calls:

```ts
await prisma.$transaction(async (tx) => {
  await tx.referral.update({ ... });
  await writeAudit(tx, { ... });        // pass tx, or it fails loudly
});
await fanoutNotification({ ... });      // type derived from TYPE_MAP
invalidateTags(["referrals", "dashboard"]);
```

- **Audit:** `writeAudit` from `lib/audit.ts`.
- **Notifications:** `fanoutNotification` from `lib/notify.ts`. Never invent a
  notification type — add it to `TYPE_MAP` first.
- **Cache:** invalidate the tags affected by the write.

### 6.5 Term scope

- `attachTermScope` is mounted in `app.ts`; handlers receive a resolved scope.
- Only term-steering roles (`subject_teacher`, `adviser`, `principal`) may
  choose a term. Never trust client-supplied term IDs from other roles.

### 6.6 Pagination

- Use the shared helpers in `lib/pagination.ts`. Standard page size is **15**;
  the only exceptions are two 4×4 card-grid queues at **16**.
- Return the envelope `{ data, total, page, pageSize, totalPages }`.

### 6.7 Adding an endpoint

1. Add the Zod schema in `modules/<domain>/<domain>.schemas.ts`.
2. Add the handler in `<domain>.routes.ts` with the right guards
   (`requireAuth`, `requireRole`, `gradeBandGuard`, ownership checks).
3. Put the query in the repository or service.
4. Add audit/notification/cache invalidation if it writes.
5. Mount the router in `app.ts` only if it is a new domain.
6. Add or extend a Vitest suite.

---

## 7. Frontend conventions

- Pages/hooks are client components (`"use client"`).
- API calls live in `src/services/<role>/*.service.ts`, not in components.
- Use the canonical query keys in `src/lib/api/queryKeys.ts` and the cache
  presets — don't hand-roll keys.
- Lists use `usePaginatedQuery` with URL-synced page/filters and the shared
  `Pagination` component.
- Mutations use the optimistic helper and then invalidate the relevant query
  keys.
- Term headers (`x-term-id`, `x-school-year-id`) are sent only for teacher
  roles, handled by `apiClient`.
- Status chips get their colours from `src/lib/labels/status-tone.ts`. Add new
  statuses there; never inline a badge variant map.
- Shared desk UI: `components/ui/kanban-board.tsx`,
  `components/ui/kanban-overlay.tsx`, `components/ui/pill.tsx`.

### 7.1 Styling

- CSS Modules for shell/page layout; Tailwind utilities are used alongside.
- Match the file you are editing — the codebase is deliberately mixed.
- Design rules in `.kilo/skills/zentra-design/`: `rounded-md`, 1px borders, one
  accent colour, micro-motion 120–180 ms.

### 7.2 React Compiler

`npm run lint` enforces the React Compiler rules. Follow the existing
`eslint-disable` patterns instead of fighting the rule.

---

## 8. Data and migrations

- Schema: `backend/prisma/schema.prisma` (**49 models**, no `@map`).
- Migrations: `backend/prisma/migrations/` (timestamped SQL).
- After editing the schema:

```bash
npm run prisma:generate
npm run prisma:migrate
```

- The generated client is **committed** on purpose at
  `backend/src/generated/prisma/`; regenerate it, don't hand-edit it.
- RLS changes belong in `0001_rls.sql` and must be re-applied manually.
- **CI applies migrations to the live database on every push to `main`.** Treat
  migrations as production operations and review them before merging.

---

## 9. Testing

- Framework: Vitest 2 + Supertest 7 in `backend/tests/`.
- Tests do **not** use a live database — stub env vars in `beforeAll`, then
  dynamically import `../src/app.js` and drive it with Supertest.
- Name suites by area: `backend/tests/<area>.test.ts`.
- Known flake: `ocform01.test.ts` can time out under full-suite parallel load;
  it passes in isolation.

Example shape:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

let app: any;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = "test";
  // …other required env vars
  app = (await import("../src/app.js")).default;
});

describe("GET /health", () => {
  it("responds ok", async () => {
    await request(app).get("/health").expect(200);
  });
});
```

---

## 10. CI/CD

`.github/workflows/ci.yml` runs, in order:

1. `prisma generate`
2. `prisma migrate deploy` — **main pushes only**, needs the `DATABASE_URL`
   secret
3. backend typecheck → test → build
4. frontend typecheck → lint → build

Run the same commands locally before pushing.

---

## 11. Gotchas

- **Committed Prisma client** — regenerate after schema edits; it shows up in
  diffs by design.
- **ESM extensions** — every relative import needs `.js`.
- **Next.js 16 differs from training data** — read
  `frontend/node_modules/next/dist/docs/` before writing framework-specific
  code.
- **Student/parent routing** — the student portal is live; parent accounts have
  no desk yet, so a parent login falls back to a missing route.
- **Guards** — only guidance, nurse, and coordinator layouts run
  `useRoleGuard`; other shells render but the backend still enforces access.
- **No `frontend/src/middleware.ts`** — routing guards are client-side plus
  server-side RBAC.
- **Anecdotal signature** — principal ADM approval needs a saved drawn
  signature; `GET/PUT /api/anecdotal/signature` allows the principal.
- **Slug ↔ UUID** — teacher ADM detail URLs use a learner-name slug; keep
  `frontend/src/lib/slug.ts` and `caseSlug` in
  `backend/src/services/adm/monitoring.service.ts` in sync.
- **Storage** — missing buckets are auto-created public; never commit `.env*`.
- **Uncommitted WIP** — the working tree often carries large in-progress work;
  check `git status` and never revert unrelated changes.

---

## 12. Documentation map

| Document | Covers |
|---|---|
| [`AGENTS.md`](../../AGENTS.md) | Short map, commands, conventions, gotchas |
| [`SYSTEM_UNDERSTANDING.md`](../../SYSTEM_UNDERSTANDING.md) | Deep onboarding notes |
| [`PLAN.md`](../../PLAN.md) | Original plan and design decisions |
| [`../architecture/system-architecture.md`](../architecture/system-architecture.md) | Runtime architecture and data flow |
| [`../guides/user-guide.md`](../guides/user-guide.md) | Role-by-role usage |
| [`../role-modules/`](../role-modules/) | Per-role module specifications |
| [`../zentra-erd-full.mmd`](../zentra-erd-full.mmd) | Entity-relationship diagram |
| [`../README.md`](../README.md) | Documentation index |
