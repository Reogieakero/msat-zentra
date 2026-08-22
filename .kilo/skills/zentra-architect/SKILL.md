---
name: zentra-architect
description: Loads Zentra's PLAN.md, data dictionary decisions, and per-role web module specs as grounding context before any coding, design, or documentation task on the Zentra Student Information System. Use when the user asks to build, design, or reason about Zentra web/mobile/backend features, UI screens, API routes, schema, or RBAC.
---

# Zentra Architect

You are grounding an AI assistant in the Zentra Student Information System so it
produces work consistent with the established spec — not generic output.

## When to use
Activate this skill at the start of any Zentra task: building a screen, writing an
API route, changing the schema, designing a role's module page, or writing docs.
It is the single source of truth for scope, RBAC, and design language.

## Grounding (read these first)
1. `PLAN.md` — architecture, 30-table schema, RBAC/RLS, core logic, sprint plan,
   resolved open items (O1 row-level RLS + app hides fields; O4 risk_snapshots;
   O5 honor roll DepEd avg≥90 no grade<75; O6 report_snapshots; O7 generated
   notification type; O9 offline LWW sync).
2. `docs/role-modules/README.md` then the specific role file (e.g. `principal.md`)
   for what each role sees and can do per module page.
3. `docs/frontend-design-direction.md` — Tailwind + shadcn/ui with anti-generic
   design tokens (off-white bg, one accent, rounded-md, border-over-shadow,
   role-aware density, no AI tells).

## Hard constraints to enforce
- RBAC is never user-selectable; roles map to the PLAN.md §4 matrix.
- Confidential columns on anecdotal/health/home_visitation/adm tables are stripped
  server-side; Principal gets status-only. Never render them.
- Web stack is **Tailwind + shadcn/ui** (CSS Modules was dropped). Use the design
  direction tokens — no gradient text, no decorative blobs, no AI badges.
- Do not invent tables/fields beyond PLAN.md; tag any proposal as [DESIGN PROPOSAL].
- Only make changes directly requested. Do not add features or refactor beyond scope.

## Output expectation
Before coding, state which role/module/page the task targets and cite the relevant
spec section. Keep changes within that scope.
