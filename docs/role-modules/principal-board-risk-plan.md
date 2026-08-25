# Plan — Principal: Board Risk (Risk & Early Intervention) Module Page

> **Status:** PLANNING ONLY. No code, migrations, or config written. Grounded in `PLAN.md` §4.2 (RBAC), §4.3 (confidentiality tiering), §6.3 (risk engine), and `docs/role-modules/principal.md` Module 4 (lines 212–248).
>
> **Scope:** Web module page for the `principal` role only. This is "Module 4" of the Principal workspace.
>
> **Legend:** 👁 visible · ✎ action allowed · 🔒 denied / hidden.

---

## 1. Target Page Identity

| Field | Value |
|---|---|
| Module | 4 — Risk & Early Intervention (school-wide) |
| Route | `/principal/risk` |
| Auth gate | `requireRole('principal')` (JWT `role = principal`) |
| Persona | Principal = **calm overview**; data-dense, read-heavy, status-only into confidential cases |
| Purpose | Surface at-risk learners school-wide, show trend + intervention status, drill into read-only detail |

---

## 2. Page Layout (wireframe)

```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar + Filter[Risk Level▾][Grade▾][Section▾][Term▾]                  │
├──────────────────────────────────────────┬───────────────────────────┤
│  MAIN:                                                    │ RIGHT:     │
│   Student Risk Table (sticky)                            │ Heat Map   │
│   Student|Section|Risk|Count|[A][T][B] chips             │ (sec×factor)│
│   ──────────────────────────────────────                │            │
│   Open student ▸ Risk trend line + Intervention board    │ Outcome    │
│                                                         │ summary    │
└─────────────────────────────────────────────────────────┴────────────┘
```

---

## 3. Widgets & Data Tables

### 3.1 Student Risk Table (main canvas)
- **Columns:** `Student`, `Section`, `risk_level` (badge: High/Moderate/Low), `risk_count` (0–3), factor chips **[A]cademic [T]ttendance [B]ehavioral**.
- **Source:** `student_profiles` — live recompute from PLAN.md §6.3:
  - `academic_flag = overall_average < 75`
  - `attendance_flag = attendance_rate < 80%`
  - `behavioral_flag = count(anecdotal_records) >= 1`
  - `risk_count = sum(0–3)`; `risk_level = High if ≥2, Moderate if 1, Low if 0`.
- Sticky header, monospaced IDs/grades.

### 3.2 Risk Trend Line (per student, drill-down)
- **Source:** `risk_snapshots` over terms (O4).
- Shows level trajectory Low → Moderate → High ("worse or better?").

### 3.3 Intervention Board (status only)
- **Source:** `interventions` — `Student`, `risk_level_at_flag`, `approval_status` (pending/approved/rejected/modified), `outcome_status` (ongoing/resolved/unresolved), **recommended/approved action text**.
- 🔒 **Hidden (O1):** `anecdotal_records.description_of_incident`, `health_records.diagnosis`/`treatment_given`, `home_visitation_records` findings. Banner: "Confidential source hidden — status-only view."

### 3.4 Heat Map (right rail)
- Same section × factor matrix as Modules 1 / 7. Source: `report_snapshots` type=`heat_map` (O6), live fallback if stale.
- Rows = sections (Grade 7-A … 12-C). Columns = Academic / Attendance / Behavioral. Cell = count flagged (no names). Shading by intensity.

### 3.5 Outcome Summary
- Counts ongoing / resolved / unresolved (stat row or bar).

---

## 4. Filters & Toolbar

| Control | Scope impact |
|---|---|
| Risk Level ▾ | Filters student risk table + heat map |
| Grade ▾ | Filters all widgets |
| Section ▾ | Filters all widgets |
| Term ▾ | Filters all widgets (active term default) |

---

## 5. Interactions & Drill-downs

- Open student row → trend line + intervention status detail (action/outcome only).
- Click heat-map cell → filters student table to that section + factor.
- KPI / heat-map entries elsewhere link into this page with filter carried over.

---

## 6. Permission Strip

| Capability | Status |
|---|---|
| Filter by risk level / grade / section / term | ✎ allowed |
| Drill into read-only trend + intervention status | ✎ allowed |
| Mark own notifications read (cross-module) | ✎ allowed |
| Create / modify / approve interventions | 🔒 denied (Guidance Counselor / Nurse scope) |
| View confidential source detail columns | 🔒 denied (status-only, enforced server-side O1) |
| Edit any student data from this page | 🔒 denied |

---

## 7. States

| State | Handling |
|---|---|
| Loading | Skeleton table + shimmer chart |
| Empty | "No at-risk students in this scope." |
| Zero-filter result | "No students match." |
| Error / stale snapshot | Fallback to live query with banner "Live data — snapshot regenerating" (O6) |

---

## 8. Confidentiality Boundary (O1 — mandatory)

- Confidential columns on `anecdotal_records`, `health_records`, `home_visitation_records`, `adm_learner_profiles` are **stripped server-side** (row-level RLS + app-layer hide) before reaching the client. Never rendered even if requested.
- Principal sees status only: counts, outcome, recommended/approved action — not diagnosis, treatment, incident write-ups, or home-visitation findings.
- Enforcement must exist in both RLS policy (PLAN.md §4.3) and the projection layer of the API.

---

## 9. API Surface Required

| Method | Route | Principal capability | Notes |
|---|---|---|---|
| GET | `/api/risk/students` | 👁 list with `risk_level`/`risk_count`/factor chips | **[NEW]** — principal.md implies but PLAN.md §5 omits |
| GET | `/api/risk/students/:id` | 👁 live recompute for one student | PLAN.md §5 has `GET /risk/students/:id` |
| GET | `/api/risk/students/:id/snapshots` | 👁 trend line source | **[NEW]** — `risk_snapshots` read |
| GET | `/api/risk/sections/:id/heatmap` | 👁 section × factor counts | principal.md:519 (path mismatch vs PLAN.md `/sections` — align) |
| GET | `/api/interventions` | 👁 status-only projection | **[NEW]** — must project action/outcome only, hide confidential source |

### Open naming issue (flag for backend)
- PLAN.md §5 lists `GET /api/risk/students/:id` and `GET /api/risk/sections/:id/heatmap`.
- principal.md:519 lists `GET /api/risk/sections/:id/heatmap` (note `/sections` vs `/students`).
- **Action:** confirm canonical path before implementation; align frontend + backend + Swagger.

---

## 10. Acceptance Criteria (Definition of Done)

- [ ] Page renders at `/principal/risk` gated by `requireRole('principal')`.
- [ ] Student risk table shows live `risk_level`/`risk_count`/factor chips from §6.3.
- [ ] Trend line renders from `risk_snapshots`; intervention board shows status only.
- [ ] Heat map + outcome summary render from `report_snapshots` with live fallback.
- [ ] All filters (risk/grade/section/term) recompute widgets.
- [ ] Confidential columns confirmed absent in API response (tested against RBAC matrix row for Principal).
- [ ] Loading / empty / error / stale states implemented.
- [ ] No writes by Principal on this page (read-only except own notification mark-read).

---

✅ Board Risk module plan complete — grounded in Principal spec Module 4, PLAN.md §4.2/§4.3/§6.3, with API gaps and one naming conflict flagged for backend alignment.
