# Plan: Zentra Frontend Scaffold (Next.js)

## Goal
Scaffold the web frontend only — no features yet. Structure + tooling + design
tokens + auth plumbing, ready for module work later.

## Stack (grounded in PLAN.md §2 + zentra-design)
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS (scoped to shadcn UI components only) + shadcn/ui
- TanStack Query (server-state), Axios (backend API client), React Hook Form + Zod
- lucide (icons), sonner (toasts), next-themes (light/dark), cmdk (command palette),
  @tanstack/react-table (grids), recharts (via shadcn charts)
- Auth: Supabase Auth client + JWT access/refresh layer calling backend `/api/auth`

## Scaffold steps
1. `create-next-app` into `frontend/` (TS, App Router, Tailwind, ESLint, src dir,
   import alias `@/*`).
2. Init shadcn/ui; add components: button, card, input, form, table, dialog, select,
   dropdown-menu, sonner, command, sheet, avatar.
3. Install deps: @tanstack/react-query @tanstack/react-table axios react-hook-form
   zod @hookform/resolvers lucide-react sonner next-themes cmdk recharts
   @supabase/supabase-js @supabase/ssr.
4. Design tokens: globals.css — off-white #FAFAF9 bg, stone-200 #E7E5E4 borders,
   rounded-md default, ONE brand accent (school deep green placeholder), focus rings.
   Fonts: Geist (display) + Inter (body) via next/font. Brand accent: deep green.
5. Providers: `QueryProvider` (TanStack), `ThemeProvider` (next-themes),
   `Toaster` (sonner) in root layout.
6. Auth plumbing (no UI):
   - `lib/supabase/client.ts` (browser client from NEXT_PUBLIC_SUPABASE_*).
   - `lib/api/client.ts` (Axios instance -> backend BASE_URL from env).
   - `lib/auth/jwt.ts` (store/refresh access token via /api/auth/refresh).
   - `lib/auth/useSession.ts` (hook stub: read role from JWT/supabase, no routes yet).
7. Folder skeleton mirroring backend modules (empty route groups, no pages):
   `app/(auth)/`, `app/(dashboard)/[role]/...` shells, `modules/{grades,attendance,
   anecdotal,referrals,adm,sf10,risk,notifications,audit}` with `page.tsx` stubs
   showing role + "scaffold" placeholder (not real features).
8. `.env.example` for frontend: NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_SUPABASE_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY.
9. README note: how to run (`npm run dev` in frontend/), points at backend :4000.

## Out of scope (explicitly NOT building)
- Real login/register UI, real data fetching, RBAC-gated pages, module logic.
- Backend changes. PLAN.md §2 still says "bcrypt" — actual backend uses argon2;
  will flag as doc mismatch, not fix unprompted.

## Verification
- `npm run build` (or `next build`) passes in frontend/.
- `npm run lint` passes.
- Dev server boots; `/` renders scaffold placeholder without runtime errors.

## Note
PLAN.md line 46 lists "bcrypt password hashing" but backend was migrated to argon2
(committed f6b0081). Recommend updating PLAN.md §2 auth row to argon2 — will do only
if you confirm.
