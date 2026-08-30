# Registrar — Web Role Module Specification (Student Account Approval)

> **Purpose:** Workspace-grade reference for the **Registrar** role in Zentra, scoped to
> **student account approval (grades 11–12)**. Specified as a product/UX spec: layout
> regions, widgets, data sources, interactions, and states.
>
> **Grounded in:** `PLAN.md` §4.1 (Registrar = hardcoded, grade band 11–12, no
> self-registration) and §4.2 (approve accounts grade-banded, handle SF10 11–12).
> This document covers the **account-approval** surface only; SF10 validation is out of
> scope here.
>
> **Legend:** 👁 visible · ✎ action allowed · 🔒 denied / hidden.
>
> **Account facts:** Role = `registrar` (single hardcoded account, no self-registration,
> created/seeded by admin). JWT carries `role` claim; module pages gate on
> `requireRole('registrar')`.

---

## 0. At-a-Glance — Can Do / Cannot Do

### ✅ What the Registrar CAN do (this module)
- View the queue of **pending student accounts** for grades **11–12**.
- Open a student's profile info card from the sidebar.
- **Approve** a pending student account (sets active, records approver).
- **Reject** a pending student account (with reason).

### 🔒 What the Registrar CANNOT do (this module)
- See or approve **grade 7–10** student accounts (Record Keeper scope) — filtered server-side.
- Approve **parents, teachers, or staff** accounts from this view (student-only scope).
- Edit student profile fields (read-only info card).
- Approve already-active or already-processed accounts (409 guard).

---

## Module Page Index

1. Student Account Approvals (queue sidebar + profile info card)

---

> **How to read the page spec below**
> - **Route / Gate** — URL segment + auth gate.
> - **Page Layout** — wireframe regions.
> - **Widgets & Data Tables** — cards/lists with column specs and data sources.
> - **Interactions & Drill-downs** — clickable behavior.
> - **States** — empty / loading / error handling.
> - **Audit & Notifications** — what gets logged or fired.
> - **✅ CAN / 🔒 CANNOT** — condensed permission strip.
>
> **Visual language (PLAN.md §2):** Registrar = **task-dense workspace** — soft off-white
> `#FAFAF9`, one brand accent, `rounded-md`, 1px borders (`#E7E5E4`), data-dense lists with
> sticky headers, monospaced IDs/LRN, micro-motion only (120–180ms ease-out). No gradients,
> no decorative blobs, no AI badges.

---

## 1. Student Account Approvals

**Route / Gate:** `/registrar/student-approvals` · `requireRole('registrar')`.

**Page Layout**
```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar: Zentra · [SY ▾] [Term ▾]   🔔(n)  ⚙️                            │
├──────────────────────────────────────┬───────────────────────────────┤
│ MAIN CANVAS                          │ RIGHT SIDEBAR (pending)        │
│  [Profile Info Card area]            │  Search by name / LRN          │
│   • Empty state: "Select a →"       │  ───────────────────────────   │
│   • On row click:                    │  Row: LRN · Name · Gr · Section│
│     Profile Card                     │  Row: LRN · Name · Gr · Section│
│      LRN, Name, Grade, Section,      │  Row: ... (active highlighted) │
│      Email, Contact, Birthdate,      │                                │
│      Address, Status, Requested      │                                │
│      [Approve ▸] [Reject ▸]         │                                │
└──────────────────────────────────────┴───────────────────────────────┘
```

**Widgets & Data Tables**

- 👁 **Pending student sidebar list** — `users` where `role=student`, `status=pending`,
  joined to `student_profiles` where `grade_level` ∈ {11, 12}. Server-side filter only
  (Registrar never receives 7–10 rows).
  - **Row cols:** `lrn` (monospaced), `full_name`, `grade_level`, `section` (section name).
  - Active row highlighted on click.
  - Sorted newest-requested first.
- 👁 **Search box** — filters sidebar by `full_name` or `lrn` (client-side over the loaded pending set).
- 👁 **Profile Info Card (main canvas)** — rendered when a sidebar row is selected:
  - `lrn`, `full_name`, `grade_level`, `section` (name), `email`, `contact_number`,
    `birthdate`, `address`, `status` (pending/active/suspended), `created_at` (Requested).
  - ✎ **Approve** button → `POST /api/auth/approve/:userId`.
  - ✎ **Reject** button → opens reason prompt → reject flow.
- 👁 **Empty / unselected state** — main canvas shows "Select a student from the list →".

**Filter & Toolbar:** ✎ School year / term selectors (recompute the pending set). ✎ Name/LRN search (sidebar). No grade-level or role filters (scope is fixed to 11–12 students).

**Interactions & Drill-downs**
- Click sidebar row → main canvas renders that student's Profile Info Card.
- ✎ **Approve** → confirmation (lightweight) → `POST /api/auth/approve/:userId` sets
  `status=active`, `approved_by=registrar`, `approved_at`; writes `audit_logs`
  (`account_approval`); fires notification to the student; row removed from pending sidebar.
- ✎ **Reject** → reason prompt → reject flow (account stays `pending` or marked
  `suspended` per policy); audited with reason; row removed/relabeled in sidebar.

**States**
- Loading — sidebar skeleton rows; main canvas skeleton.
- Empty (no pending 11–12 students) — sidebar "No pending students for grades 11–12.";
  main canvas "Select a student from the list →".
- Unselected — main canvas "Select a student from the list →".
- Zero-search — "No students match your search."
- Error (already approved) — toast "This account was already approved." (409 guard).

**Audit & Notifications**
- ✎ Approve / Reject → `audit_logs` row (`action_type=account_approval`, `actor_role=registrar`,
  `source_table=users`, `source_id`, `reason`, `old_value`/`new_value`).
- ✎ Approval fires `account_approval` notification to the student.

**Confidentiality:** student profile fields are non-confidential to Registrar; no hidden columns. Grade-band (11–12) enforced server-side, not via UI hiding.

**✅ CAN** view 11–12 pending students, open profile, approve/reject with reason.
**🔒 CANNOT** see 7–10 students, approve non-student roles here, or edit profile fields.

---

## Cross-Cutting Rules (all pages)

- Registrar session requires `role = registrar` in JWT; module page gates on `requireRole('registrar')`.
- Grade-band (11–12) enforcement is **server-side** — the API returns only grade 11–12
  pending students; the client never filters by hiding 7–10 rows.
- Every approve/reject writes an `audit_logs` row with `actor_role=registrar` + reason.
- `notifications` fire to web/mobile/email per `channel`.

---

## API Surface Relevant to Registrar (from `PLAN.md` §5)

| Method | Route | Registrar capability |
|---|---|---|
| GET | `/api/auth/pending?role=student&gradeBand=11-12` | 👁 list pending 11–12 students |
| POST | `/api/auth/approve/:userId` | ✎ approve (sets active, approver, audit, notify) |
| POST | `/api/auth/reject/:userId` | ✎ reject with reason (audited) |

---

✅ Registrar student-account-approval spec complete — single module page (sidebar queue + profile info card), grades 11–12 only, server-side band enforcement, full audit + notification behavior.
