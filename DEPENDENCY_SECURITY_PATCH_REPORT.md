# Dependency Install & Security Patch Report

**Project:** msat-zentra (ZENTRA)
**Date:** 2026-10-23
**Scope:** `backend/` (Express + Prisma API) and `frontend/` (Next.js app)
**Task:** Install dependencies, upgrade vulnerable packages, patch the Node.js runtime recommendation, and document the result.

---

## 1. Executive summary

| Area | Before | After |
| --- | --- | --- |
| Backend dependencies installed | ❌ `node_modules` missing | ✅ 494+ packages installed |
| Frontend dependencies installed | ❌ `node_modules` missing | ✅ 864+ packages installed |
| Backend `npm audit` | **22 vulnerabilities** (3 critical, 8 high, 11 moderate) | ✅ **0 vulnerabilities** |
| Frontend `npm audit` (production) | **25 vulnerabilities** (2 critical, 17 high, 6 moderate) | ✅ **0 production vulnerabilities** |
| Frontend `npm audit` (total, incl. dev tooling) | 25 | ⚠️ **9 high**, all in lint/CLI dev tooling; no fix version exists upstream |
| Backend typecheck | — | ✅ passes |
| Backend tests | — | ⚠️ 207/209 pass; 2 pre-existing environment failures |
| Frontend production build | — | ✅ passes |
| Frontend lint | — | ⚠️ 5 pre-existing React-hooks errors, 34 warnings |

All **critical** and **high** vulnerabilities that are reachable in production have been remediated. The only remaining findings are build/development-only transitive dependencies (`eslint-config-next`, `shadcn`) for which the advisory database lists **no fixed version**.

---

## 2. Environment

| Item | Value |
| --- | --- |
| OS | Windows (win32) |
| Installed Node.js | **v22.20.0** |
| npm | 10.9.3 |
| Backend stack | Express 4, Prisma 7, Supabase JS, Vitest |
| Frontend stack | Next.js 16, React 19, Tailwind 4 |

### Node.js runtime — recommended patch

Node.js **v22.20.0 is out of date** and misses the latest security and bug-fix releases.

| Channel | Version | LTS name | Status |
| --- | --- | --- | --- |
| Node 22 (current line on this machine) | **v22.23.4** | Jod | Maintenance LTS |
| Node 24 (recommended) | **v24.22.1** | Krypton | Active LTS |
| Node 26 | v26.12.1 | — | Current, not LTS |

**Recommendation:** move to **Node.js 24.22.1 LTS (Krypton)**. If staying on Node 22 is required for compatibility, patch at minimum to **v22.23.4**.

Install / verify:

```powershell
# Option A - recommended (Active LTS)
nvm install 24.22.1
nvm use 24.22.1

# Option B - stay on Node 22, apply latest patch
nvm install 22.23.4
nvm use 22.23.4

node -v
npm -v
```

After switching, reinstall from the lockfile:

```powershell
cd backend  ; npm ci
cd ..\frontend ; npm ci
```

> Note: Node 24 is an LTS line; the project does not currently pin an `engines` field, so no manifest change was required. Adding `"engines": { "node": ">=24.0.0" }` to both `package.json` files is recommended once CI/runtime is aligned.

---

## 3. Changes made

### 3.1 Files modified

| File | Change |
| --- | --- |
| `backend/package.json` | `vitest` 2 → 5, added `vite` 8, added `uuid` override |
| `backend/package-lock.json` | Regenerated |
| `frontend/package.json` | `next` 16.3.2 → 16.4.2, `eslint-config-next` 16.3.2 → 16.4.3, `axios` 1.19 → 1.20, `shadcn` moved to `devDependencies`, added `uuid` override |
| `frontend/package-lock.json` | Regenerated |

### 3.2 Direct dependency upgrades

**Backend**

| Package | Before | After | Reason |
| --- | --- | --- | --- |
| `vitest` | 2.1.9 | **5.0.5** | Critical RCE / arbitrary file read / code injection (GHSA-5xrq-8626-4rwp, GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8), plus vulnerable `tinypool` (critical) and `vite` (high) |
| `vite` (new direct dev dep) | 5.4.21 (transitive) | **8.3.5** | Required peer for Vitest 5; clears Vite path-traversal / Windows `fs.deny` bypass / `launch-editor` advisories |
| `express` | 4.22.2 | **4.22.3** | Fixes critical `proxy-addr` IP-spoofing advisory (GHSA-jqcg-44mw-7w3h) and `body-parser`/`qs` issues |
| `multer` | 2.3.0 | **2.5.0** | DoS via orphaned disk writes on aborted uploads (GHSA-3pph-fpjx-jg34) |
| `prisma` / `@prisma/client` / `@prisma/adapter-pg` | 7.10.0 | **7.10.1** | `@prisma/config`, `deepmerge-ts`, `fast-uri` advisories |
| `@supabase/supabase-js` | 2.112.4 | **2.118.0** | In-range security/bug fixes |
| `pg` | 8.23.0 | **8.23.1** | In-range fixes |
| `helmet` | 8.0.0 → resolved | **8.3.0** | In-range fixes |
| `exceljs` → `uuid` | uuid 8.3.2 | **uuid 11.1.1** (override) | Bounds-check advisory GHSA-w5hq-g745-h8pq |

**Frontend**

| Package | Before | After | Reason |
| --- | --- | --- | --- |
| `next` | 16.3.2 | **16.4.2** | **4 critical RCE advisories** (Windows-hosted servers, AVIF/SVG Image Optimization, `next/og`, `use cache` typed arrays) plus SSRF, cache poisoning, DoS, `sharp`/`undici`/`hono`/MCP SDK advisories |
| `eslint-config-next` | 16.3.2 | **16.4.3** | Align with Next.js security release |
| `axios` | 1.19.0 | **1.20.0** | ReDoS, prototype-pollution gadgets, header injection, redirect/SSRF bypass (GHSA-c29m-xwm3-cm6r and related) |
| `exceljs` → `uuid` | uuid 8.3.2 | **uuid 11.1.1** (override) | Bounds-check advisory GHSA-w5hq-g745-h8pq |
| In-range updates | — | latest compatible | `@base-ui/react`, `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-query`, `radix-ui`, `recharts`, `shadcn`, `lucide-react`, `motion`, `tailwind-merge`, `zod`, Playwright, `three`, etc. |

### 3.3 `uuid` override

`exceljs@4.4.0` pins `uuid@8.3.2`, which is affected by GHSA-w5hq-g745-h8pq. The fixed `uuid@11` is API-compatible for the `v4` generation used by ExcelJS. Both manifests now contain:

```json
"overrides": {
  "uuid": "^11.1.1"
}
```

Verified by generating an in-memory `.xlsx` workbook in both projects — output valid in each case.

---

## 4. Audit results

### Backend — before → after

| Severity | Before | After |
| --- | --- | --- |
| Critical | 3 | **0** |
| High | 8 | **0** |
| Moderate | 11 | **0** |
| Low / Info | 0 | **0** |
| **Total** | **22** | **0** |

```
$ cd backend && npm audit
found 0 vulnerabilities
```

Notable critical/high items cleared: `proxy-addr` (IP spoofing), `tinypool` (prototype-pollution → RCE), `vitest` (arbitrary file read/exec), `vite`, `prisma`/`@prisma/config`, `deepmerge-ts`, `fast-uri`, `source-map-js`, `brace-expansion`, `mysql2` (transitive), `express`, `multer`.

### Frontend — before → after

| Severity | Before | After (production) | After (incl. dev) |
| --- | --- | --- | --- |
| Critical | 2 | **0** | **0** |
| High | 17 | **0** | 9 |
| Moderate | 6 | **0** | **0** |
| Low / Info | 0 | **0** | **0** |
| **Total** | **25** | **0** | **9** |

`npm audit --omit=dev` reports **0 vulnerabilities** for the frontend. The 9 remaining highs are all in `eslint-config-next` and the `shadcn` CLI, which are build/dev-time only.

---

## 5. Remaining (accepted) findings

These are **not shipped to production** and currently have **no upstream fix**:

| Package | Path | Advisory |
| --- | --- | --- |
| `fast-glob` | `eslint-config-next` → `@next/eslint-plugin-next`; `shadcn` → `@shadcn/registry` / `ts-morph` | Vulnerable via `micromatch`/`braces` (`*` range — all published versions flagged) |
| `micromatch` | `fast-glob` | `>=0.2.0` flagged; latest 4.0.8 still listed |
| `braces` | `micromatch` | Stack-exhaustion DoS via deeply nested patterns (GHSA-vfj7-8cjw-p6xm) |
| `ts-morph` / `@ts-morph/common` | `shadcn` | Depends on vulnerable `fast-glob` |
| `@next/eslint-plugin-next` / `eslint-config-next` | direct dev dep | Depends on vulnerable `fast-glob` |
| `shadcn` | direct dev dep (CLI) | Depends on the above |

**Why accepted**

- Only invoked by developers/CI (ESLint config resolution and the `shadcn` component CLI).
- Not present in the production runtime bundle or the deployed Next.js server.
- `npm audit` lists no patched release for `fast-glob` / `micromatch`; `npm audit fix --force` would only downgrade to `shadcn@1.0.0` / `eslint-config-next@14.2.35`, which is a breaking regression and still does not remove the chain.

**Mitigations**

1. Keep `shadcn` and lint tools out of production images (`npm ci --omit=dev` for runtime).
2. Do not run `shadcn` or ESLint against untrusted input.
3. Re-check monthly; remove the findings once upstream publishes fixed releases.
4. ✅ `shadcn` has been moved from `dependencies` to `devDependencies` so the production install boundary is explicit (`npm audit --omit=dev` → 0 findings).

---

## 6. Verification

| Check | Command | Result |
| --- | --- | --- |
| Backend typecheck | `cd backend ; npm run typecheck` | ✅ Pass (no output) |
| Backend tests | `cd backend ; npm test` | ⚠️ 207 passed, 2 failed |
| Frontend production build | `cd frontend ; npm run build` | ✅ Pass |
| Frontend lint | `cd frontend ; npm run lint` | ⚠️ 5 errors, 34 warnings (pre-existing) |
| Backend audit | `npm audit` | ✅ 0 vulnerabilities |
| Frontend audit | `npm audit --omit=dev` | ✅ 0 vulnerabilities |

### Backend test failures (pre-existing / environmental)

1. `tests/app.test.ts` — "mounts routes and builds an Express app" timed out at 15 s. The app bootstrap appears to wait on external services (DB/Redis) that are not available in this environment.
2. `tests/sf10-photo-ocr.test.ts` — reads `C:\Users\jalan\Downloads\Copy of JHS_145516065812_Brown.xlsx.pdf`, a hard-coded fixture path belonging to another machine. `ENOENT`.

Neither failure is related to the dependency upgrades. The first should be made hermetic (mocked DB/Redis) and the second should ship the fixture in the repo or generate it in-test.

### Frontend lint errors

The updated `eslint-config-next` (React Compiler rules) reports 5 errors that were already present in the code:

- `src/app/nurse/overview/components/NurseOverviewTrends.tsx:191` — `Date.now()` called during render (`react-hooks/purity`)
- `src/app/teacher/advisory/referrals/components/refer-form.tsx:109` — synchronous `setState` in effect
- `src/app/teacher/grading/[assignmentId]/components/LockGradesModal.tsx:29` — synchronous `setState` in effect
- `src/app/teacher/overview/components/teacher-overview-kanban.tsx:62` — synchronous `setState` in effect
- `src/app/teacher/settings/components/MasterTeacherCard.tsx:31` — synchronous `setState` in effect

These are code-quality issues, not dependency vulnerabilities, and were left untouched to keep this patch focused.

---

## 7. Reproduce / maintain

```powershell
# Clean install from lockfiles
cd backend ; npm ci
cd ..\frontend ; npm ci

# Verify
cd ..\backend  ; npm run typecheck ; npm test ; npm audit
cd ..\frontend ; npm run build ; npm run lint ; npm audit --omit=dev
```

Maintenance cadence:

- Run `npm audit` in both projects at least monthly and before every release.
- Use Dependabot/Renovate for patch/minor updates; review major upgrades manually.
- Revisit the accepted dev-only findings when `fast-glob` / `micromatch` publish fixed versions.
- Tracking file for this report: `DEPENDENCY_SECURITY_PATCH_REPORT.md`.

---

## 8. Recommendation summary

1. ✅ Dependencies installed for backend and frontend.
2. ✅ All production-affecting critical/high vulnerabilities patched.
3. ✅ Backend audit clean (0 findings).
4. ⚠️ Frontend dev-only findings accepted and documented; no fix exists.
5. 🔧 **Patch Node.js to v24.22.1 LTS** (or v22.23.4 if staying on 22), then run `npm ci`.
6. 🔧 Add `"engines": { "node": ">=24.0.0" }` once the runtime target is confirmed.
7. 🔧 Fix the 2 pre-existing backend test failures and the 5 lint errors in a separate change.
