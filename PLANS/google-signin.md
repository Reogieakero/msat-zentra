# Google Sign-in / Sign-up — Implementation Plan

> Status: **implemented** (2026-11-09)
> Owner decision: Supabase Auth (Google provider) + pending-account creation.
> Date: 2026-11-09

## 1. Goal

Let users authenticate with Google via Supabase Auth, then receive the app's
own JWT session (the same one email/password login issues).

Two flows:

1. **Sign in** — Google email matches an existing `active` `User` → app tokens,
   role-based redirect.
2. **Sign up** — Google email is unknown → create a `pending` `User` (same
   approval queue as the register form). Students must still supply an LRN.

## 2. Current state (verified)

| Piece | Status |
| --- | --- |
| `LoginForm.tsx` "Sign in with Google" button | Present, but points at `/api/auth/google` which **does not exist** |
| Backend `/api/auth/google*` route | **Missing** |
| App auth | Own JWT (`argon2id` + httpOnly refresh cookie), `lib/jwt.ts` |
| Supabase usage | Storage + Realtime **only** — not identity |
| Supabase Google provider | Configured (dashboard, redirect URI `…supabase.co/auth/v1/callback`) |
| `backend/.env` `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Set |
| `frontend/.env.local` `NEXT_PUBLIC_SUPABASE_*` | Set |
| `@supabase/ssr` (frontend) / `@supabase/supabase-js` (backend) | Installed |

### Non-goals

- Replacing the app's JWT with Supabase sessions.
- Google login for `student`/`parent` portals only in v1? **No** — existing
  staff accounts can sign in with Google; only *new-account creation* is
  limited to `student` / `parent`.
- Adding a `googleSub` column / migration. Matching is by **verified email**
  only. (See §9 risk.)
- Linking a Google account to an already-password-signed-in user from a
  settings page (possible later).

## 3. Flow

```
Browser                     Supabase Auth            Backend
  |  signInWithOAuth         |                        |
  |------------------------->|                        |
  |  Google consent          |                        |
  |<-- redirect /auth/callback (code)                  |
  |  supabase.auth.getSession() -> access_token        |
  |  POST /api/auth/google/exchange {token, role} ---->|
  |                          |   GET /auth/v1/user    |
  |                          |<-----------------------|
  |                          |   user {email, ...}    |
  |                          |----------------------->|
  |                          |      lookup/create User|
  |<-- {accessToken, role} | {status: pending} | {status: needsProfile}
  |  store zentra.access, redirect home                |
```

Callback URL is owned by the **frontend** (`/auth/callback`), not the backend.
Supabase's own callback (`…supabase.co/auth/v1/callback`) is already registered
with Google and must stay as-is.

## 4. Backend changes

### 4.1 `backend/src/services/auth/session.service.ts`

- Extract `issueSession(user)` → `{ accessToken, refreshToken, role }`
  (role-band lookup + `signAccess` / `signRefresh`). Use it from `login()`.
- Extract the pending-sign-up notification fan-out in `register()` into
  `notifyPendingSignup(user)` so Google sign-up reuses the exact same
  record-keeper/registrar routing (grade resolved from `StudentRoster` by LRN,
  both desks when grade unknown).

### 4.2 New `backend/src/services/auth/google.service.ts`

```ts
interface GoogleIdentity {
  email: string;              // verified email
  fullName: string;           // user_metadata.full_name ?? name ?? email local-part
  avatarUrl?: string | null;  // user_metadata.avatar_url (stored later, optional)
}

verifySupabaseToken(accessToken): Promise<GoogleIdentity>
```

Verification: `GET ${SUPABASE_URL}/auth/v1/user` with
`apikey: SUPABASE_ANON_KEY` + `Authorization: Bearer <token>`.
Reject when the response is not 200, `email` is missing, or
`email_confirmed_at`/`confirmed_at` is null.

```ts
exchangeGoogleSession(token, portalRole): Promise<
  | { status: "active"; accessToken: string; refreshToken: string; role: Role }
  | { status: "pending" }
  | { status: "needsProfile"; role: Role }
>
```

Logic:

1. Verify token → identity.
2. `user = prisma.user.findUnique({ where: { email } })`.
3. No user:
   - `portalRole === "staff"` → `403 GOOGLE_SIGNUP_NOT_ALLOWED`
     (staff accounts are provisioned by admins; do not self-create).
   - create `User`: `status: "pending"`, `role` = `student` | `parent`,
     `passwordHash` = random argon2 hash of a throwaway secret
     (`crypto.randomUUID()` — never returned; OAuth users never use it),
     `fullName` = Google name.
   - `student` → `{ status: "needsProfile" }` (LRN not collected yet),
     `parent` → `{ status: "pending" }`.
   - call `notifyPendingSignup(user)` (student notifications fire after the
     LRN is supplied in step 4, so the message includes the LRN — for parent
     fire immediately).
4. User exists but `status === "suspended"` → `403 ACCOUNT_SUSPENDED`.
5. `status === "pending"`:
   - student with no `user.lrn` → `{ status: "needsProfile" }`
   - otherwise → `{ status: "pending" }` (no tokens; user must wait)
6. `status === "active"`:
   - portal role check against `roleKindToRoles[portalRole]`
     (same 403 `ROLE_MISMATCH` as `login()`) — stops a teacher signing in
     through the parent portal.
   - `issueSession(user)`.

```ts
completeGoogleSignup(token, { lrn?, contactNumber? }): Promise<{ status: "pending" }>
```

- Verify token, find pending `student` by email, require `lrn` (mirror
  `registerSchema`: 12-digit numeric is validated the same way the roster match
  expects — keep it permissive like the form: non-empty string, roster match
  happens at approval).
- Save `lrn` / `contactNumber`, then `notifyPendingSignup(user)`.
- Returns pending; no tokens.

### 4.3 `backend/src/modules/auth/auth.routes.ts`

```http
POST /api/auth/google/exchange
body: { supabaseAccessToken: string, role: "student" | "parent" | "staff" }
200: { accessToken, role }            // active
200: { status: "pending" }            // awaiting approval
200: { status: "needsProfile" }       // new student, needs LRN
401: INVALID_GOOGLE_TOKEN
403: ROLE_MISMATCH | ACCOUNT_SUSPENDED | GOOGLE_SIGNUP_NOT_ALLOWED
```

```http
POST /api/auth/google/complete
body: { supabaseAccessToken: string, lrn?: string, contactNumber?: string }
200: { status: "pending" }
422: LRN_REQUIRED (student)
```

- Active exchange sets the refresh cookie exactly like `/login`
  (`setRefreshCookie(res, refreshToken, { secure: isSecureContext() })`).
- Both routes sit under the existing `/api/auth` mount, so `authLimiter`
  applies automatically (60 req / 15 min).
- Zod schemas added to `auth.schemas.ts`:
  `googleExchangeSchema`, `googleCompleteSchema`.

### 4.4 Files touched (backend)

- `src/services/auth/session.service.ts` (refactor only)
- `src/services/auth/google.service.ts` (**new**)
- `src/modules/auth/auth.routes.ts`
- `src/modules/auth/auth.schemas.ts`
- `tests/auth-google.test.ts` (**new**) — see §8
- No env changes, no Prisma migration, no new dependency.

## 5. Frontend changes

### 5.1 `frontend/src/components/auth/LoginForm.tsx`

- Replace the dead redirect with:

```ts
sessionStorage.setItem("zentra.oauth.role", role);      // student|parent|staff
sessionStorage.setItem("zentra.oauth.intent", "login");
const supabase = createClient();
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```

- Keep the existing button, spinner/disabled state on click.

### 5.2 New `frontend/src/app/auth/callback/page.tsx`

Client component (no `useSearchParams`, so no Suspense requirement):

1. `createClient().auth.getSession()` — `@supabase/ssr` browser client performs
   the PKCE code exchange on mount automatically (`detectSessionInUrl`).
2. If no session → toast + `/login`.
3. Read `zentra.oauth.role` (default `student`) and `intent` from
   `sessionStorage`, then clear them.
4. `POST /api/auth/google/exchange` with `credentials: "include"`.
5. Handle response:
   - `accessToken` → `setAccessToken`, `queryClient.clear()`,
     `setPromptRequired(isTeacherRole(role))`, redirect to the same home map
     used by `LoginForm` (extract that map into `lib/auth/home.ts` to avoid
     duplication).
   - `pending` → friendly "Awaiting approval" screen (link to `/login`).
   - `needsProfile` → `/register/complete`.
6. On error → show message + link back to `/login`.
7. Always `supabase.auth.signOut({ scope: "local" })` after the exchange —
   the Supabase session is only a bridge; the app session is the JWT.

> This page is intentionally public (no `useRoleGuard`).

### 5.3 `frontend/src/app/register/complete/page.tsx` (**new**)

- Student only: LRN + optional contact number.
- Reads the Supabase session again (or re-runs `getSession()`), posts to
  `/api/auth/google/complete`.
- On success → "Request submitted, awaiting registrar approval" → `/login`.
- Needs the same Supabase-session guard as the callback page.

### 5.4 `frontend/src/components/auth/RegisterForm.tsx`

- Add the same "Sign up with Google" button (divider already matches the login
  form's style), with `zentra.oauth.intent = "signup"` and
  `zentra.oauth.role = role`.
- Server behaviour is identical for signup and login by design (idempotent), so
  `intent` is only used to pick the post-callback copy, not security.

### 5.5 Shared helper — `frontend/src/lib/auth/home.ts` (**new**)

Move the role → landing route switch out of `LoginForm.tsx` and reuse it in the
callback page.

### 5.6 Files touched (frontend)

- `src/components/auth/LoginForm.tsx`
- `src/components/auth/RegisterForm.tsx`
- `src/lib/auth/home.ts` (**new**)
- `src/app/auth/callback/page.tsx` (**new**)
- `src/app/register/complete/page.tsx` (**new**)
- CSS: reuse `LoginForm.module.css` classes (`googleBtn`, `divider`) and
  `AuthShell`.

## 6. Dashboard configuration (manual, outside the repo)

Supabase → Authentication → URL Configuration:

- **Site URL**: `http://localhost:3000` (prod: deployed origin)
- **Redirect URLs**: `http://localhost:3000/auth/callback`
  (prod: `https://<domain>/auth/callback`)

Google Cloud Console (already done per screenshots):

- Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback` ✅
- Authorized JavaScript origins: add `http://localhost:3000` and the prod
  origin (needed only if the Supabase project uses One Tap / implicit flow —
  harmless to add).

No `.env` changes.

## 7. Security notes

- The backend **never trusts** the email in the request body; it only trusts
  the email returned by Supabase's `/auth/v1/user` for a verified access token.
  This closes the "post any email, get a token" hole.
- Google emails are verified; Supabase's `email_confirmed_at` check is still
  enforced for defence in depth.
- New accounts are always `pending` — approval remains the real gate, so a
  random Google user cannot reach data.
- Staff self-signup via Google is refused (`GOOGLE_SIGNUP_NOT_ALLOWED`).
- OAuth-only users get a random, never-disclosed argon2 hash, so
  `change-password`/login cannot be used against them until they set one.
- Rate limiting inherited from `/api/auth`.
- Audit: account creation is visible in the pending list; add a
  `writeAudit` row (`actionType: "create"`, `sourceTable: "users"`,
  `reason: "Google sign-up"`) on creation for parity with admin provisioning.

## 8. Testing

### Backend (`backend/tests/auth-google.test.ts`, no DB)

Stub `fetch` + `prisma`:
- invalid token → 401
- unverified email → 401
- unknown email + portal `staff` → 403
- unknown email + portal `student` → `needsProfile`
- `complete` without LRN → 422
- pending user → `{status:"pending"}`, no cookie
- active user + wrong portal → 403
- active user + correct portal → access token + refresh cookie

### Manual E2E

1. Existing admin/teacher/student signs in with Google → lands on their desk.
2. Brand-new Google account on `/login/parents` → pending screen → appears in
   the registrar pending list.
3. Brand-new Google account on `/register` → `/register/complete` → LRN saved →
   pending → approve as registrar → can sign in with Google.
4. Teacher Google sign-in through `/login/parents` → 403.
5. Suspended account → 403.

### Gates

- `cd backend && npm run typecheck && npm test`
- `cd frontend && npx tsc --noEmit -p tsconfig.json && npm run lint`

## 9. Risks / open items

| Risk | Mitigation |
| --- | --- |
| Email-only matching: a Google account whose email equals someone's Zentra email can take over that account | Emails come from Google verified claims; the same trust model as "forgot password" email delivery. A `googleSub` column later removes ambiguity. |
| Supabase project must keep the Google provider enabled | Documented in §6; failure surfaces as a 400 from Supabase on the browser redirect. |
| Users who already have a password and use Google later keep the same `User` row (same email) | Intended; both methods work. |
| Supabase `getSession()` race on first mount | Callback page retries once after `onAuthStateChange("SIGNED_IN")` before failing. |
| Existing `zentra.access` from a previous session | Callback clears query cache and overwrites the token; `logout()` also clears the Supabase local session. |

## 10. Approved decisions (2026-11-09)

1. **Supabase Auth is the OAuth broker; the app keeps its own JWT.** Supabase
   owns the Google conversation and the `/auth/callback` round-trip; the
   backend only verifies the Supabase access token and issues the app session.
2. **Staff Google *login* is allowed; staff self-*signup* is blocked.**
   Existing active staff sign in with Google; unknown emails arriving from the
   staff portal are refused with `GOOGLE_SIGNUP_NOT_ALLOWED`. Staff accounts
   are provisioned the existing way.
3. **No `googleSub` column and no migration in v1.** Identity is matched by the
   Google-verified email only. `googleSub` is deferred until account
   linking/unlinking is built, because a migration here is auto-deployed to
   the live DB by CI.
4. **New accounts are always `pending`.** Approval remains the real gate; a
   random Google user cannot reach any data. Students must supply an LRN.
5. **Build order:** backend service + tests → login redirect → callback page →
   `/register/complete` → manual E2E.

## 11. Out of scope (future)

- Google account linking / unlinking from settings.
- One Tap / Google Identity Services button.
- `googleSub` column + migration.
- Parent↔student Google invitation emails.
