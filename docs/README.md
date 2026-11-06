# Zentra Documentation

This folder holds everything that explains Zentra: architecture, guides,
specifications, diagrams, plans, and historical audit reports.

> **Start here:** [`../README.md`](../README.md) for the project overview and
> [`../AGENTS.md`](../AGENTS.md) if you are contributing code.

---

## Architecture

| Document | What it covers |
|---|---|
| [`architecture/system-architecture.md`](architecture/system-architecture.md) | Runtime topology, frontend/backend layers, data model, auth, term scoping, caching, realtime, audit, storage, deployment, limitations |
| [`zentra-erd-full.mmd`](zentra-erd-full.mmd) | Full entity-relationship diagram (Mermaid) |
| [`zentra-erd-full.drawio`](zentra-erd-full.drawio) | Full ERD for draw.io |
| [`zentra-erd-presentation.mmd`](zentra-erd-presentation.mmd) | Condensed ERD for presentations |
| [`zentra-erd-notes.md`](zentra-erd-notes.md) | ERD modeling notes |

## Guides

| Document | Audience |
|---|---|
| [`guides/user-guide.md`](guides/user-guide.md) | Everyone who uses the system: students, teachers, advisers, guidance, nurse, coordinator, records staff, principal |
| [`guides/developer-guide.md`](guides/developer-guide.md) | Contributors: local setup, commands, conventions, testing, migrations, gotchas |

## Specifications and planning

| Document | What it covers |
|---|---|
| [`role-modules/`](role-modules/) | Per-role module specifications (principal, registrar, teacher/adviser) |
| [`role-modules/principal-board-risk-plan.md`](role-modules/principal-board-risk-plan.md) | Principal risk board plan |
| [`../PLANS/`](../PLANS/) | Per-role frontend/backend wiring plans |
| [`backend.md`](backend.md) | Backend implementation spec grounded in PLAN.md |
| [`backend-stack.md`](backend-stack.md) | Backend stack notes (partly historical — verify before trusting) |
| [`landing-page-plan.md`](landing-page-plan.md) | Landing page design plan |
| [`REGISTRAR-PLAN-SIMPLE.md`](REGISTRAR-PLAN-SIMPLE.md) | Registrar desk plan (plus PDF) |
| [`../PLAN.md`](../PLAN.md) | Original system plan and resolved design decisions |
| [`../SYSTEM_UNDERSTANDING.md`](../SYSTEM_UNDERSTANDING.md) | Deep, evidence-cited onboarding notes |

## Reports and audits

Dated audit and performance reports are kept for historical reference. Some
describe issues that have since been fixed — always verify against the current
code before acting on them.

| Folder | Contents |
|---|---|
| [`reports/role-reports/`](reports/role-reports/) | ADM coordinator, principal, nurse, registrar/record-keeper audits |
| [`reports/teacher-audits/`](reports/teacher-audits/) | Teacher dock, notifications, and performance reports (MD + PDF) |
| [`reports/security/`](reports/security/) | Dependency security patch report |
| [`zentra-progress-report.md`](zentra-progress-report.md) | September progress audit (partly outdated) |

## Other

| Document | What it covers |
|---|---|
| [`../frontend/README.md`](../frontend/README.md) | Frontend-specific notes |
