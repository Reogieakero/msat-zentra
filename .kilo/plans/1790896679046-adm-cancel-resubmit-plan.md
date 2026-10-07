# Plan: ADM case cancel → re-submit from scratch

## Target
`/teacher/advisory/referrals` — adviser's referral board. When an adviser cancels a referred ADM case and then tries to "Refer again", the case must NOT reopen the same row (current `POST /:id/reopen` behavior). Instead, it must start a brand-new referral from scratch: pick the anecdotal record, pick the role, and submit — exactly like the "New referral" form.

## Current behavior (gap)
- `POST /api/referrals/:id/cancel` (adviser-only) sets `status: "dismissed"` — works for all referral types including ADM. ✓
- `POST /api/referrals/:id/reopen` (adviser-only) flips the SAME dismissed row back to `pending` — works for all types including ADM. ✗ (ADM cases should not reopen.)
- Frontend table dropdown: dismissed rows show "Refer again" → calls `useReopenReferral` → `reopen()`. No distinction between ADM and general.
- Frontend `DismissedRereferCard` (sidebar): same reopen flow for all dismissed cases, no ADM distinction.

## Changes

### 1. Backend — `backend/src/modules/referrals/referrals.routes.ts`
- In `POST /:id/reopen` handler, add guard before the existing `referredBy` check:
  - If `referral.referredToRole === "adm_coordinator"`, throw `AppError(400, "INVALID_ACTION", "Cancelled ADM cases cannot be re-submitted — start a new referral from the beginning.")`
- This prevents any caller from reopening an ADM referral via the reopen endpoint.

### 2. Frontend — `frontend/src/app/teacher/advisory/referrals/page.tsx`
- Lift the `ReferStudentCard` form-open state to the page level: `const [newReferralOpen, setNewReferralOpen] = React.useState(false)`
- Pass `open={newReferralOpen}` and `onOpenChange={setNewReferralOpen}` to `ReferStudentCard`.
- In the table dropdown actions:
  - For dismissed **ADM** referrals (`r.track === "adm"`): change the "Refer again" `onSelect` to `setNewReferralOpen(true)` instead of `reopenReferral(r)`.
  - For dismissed **general** referrals: keep existing `reopenReferral(r)` behavior.
- The `useReopenReferral` hook stays for general referrals only.

### 3. Frontend — `frontend/src/app/teacher/advisory/referrals/components/ReferStudentCard.tsx`
- Accept `open` and `onOpenChange` props from parent (page.tsx).
- In `DismissedRereferCard` / `DismissedRow`:
  - For ADM-track dismissed cases (`row.track === "adm"` — need to pass track info to the card): change "Refer again" button to call `onOpenChange(true)` (expand the new-referral form) instead of `reopen`.
  - For general-track dismissed cases: keep existing `reopen` behavior.
- The `DismissedMine` interface needs a `track` field (`"adm" | "general"`) so the card can distinguish.

### 4. Frontend — `frontend/src/app/teacher/advisory/referrals/components/ReferralActionDialogs.tsx`
- No changes needed (cancel dialog is unaffected).

## Data flow
1. Adviser cancels ADM referral → `POST /:id/cancel` → status → `dismissed`.
2. Adviser clicks "Refer again" on the dismissed ADM row → frontend opens the `ReferStudentCard` new-referral form (student → record → type → staff → reason → send).
3. New referral is created via `POST /api/anecdotal/:id/refer` → brand new row, no link to the cancelled row.

## Edge cases
- Adviser cancels ADM case, then tries to reopen via API directly → backend rejects with 400.
- Adviser cancels general (non-ADM) case → reopen still works (unchanged).
- ADM case with `referredToRole !== "adm_coordinator"` (shouldn't happen, but guard is role-based) → rejected by backend.
- Multiple dismissed ADM cases for same student → each starts a fresh form; the one-ADM-case guard on the backend (`admCoordinator` check in reopen) is bypassed since we never call reopen for ADM.

## Verification
1. Backend: `tsc --noEmit` in backend.
2. Login as adviser → cancel an ADM referral → "Refer again" opens the new-referral form (not reopen toast).
3. Login as adviser → cancel a general referral → "Refer again" still reopens the same row (unchanged).
4. API test: `POST /api/referrals/:id/reopen` on an ADM referral → 400 with correct error message.
5. API test: `POST /api/referrals/:id/reopen` on a general referral → 200, row flips to pending (unchanged).
