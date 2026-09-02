# Zentra — Mobile Architecture & Implementation Plan

> **Scope:** Technical specification and phased roadmap for the Flutter mobile application version of Zentra (`/mobile`).
> **Design Philosophy:** Developer-centric, high-density Supabase dashboard UI (`#1C1C1C` dark theme, `#3ECF8E` emerald green accent, `#2E2E2E` subtle borders, Inter & Roboto Mono typography).
> **Backend Integration Strategy:** Mock-First UI/UX Development (Phases 1–4) followed by Final Integration (Phase 5) connecting Dio HTTP services to the existing Zentra Express REST API backend (`/backend`).

---

## 1. Architectural Alignment & Technology Stack

The Zentra mobile application is designed to provide role-tailored mobile interfaces for Teachers, ADM Coordinators, Parents, and Students. It matches the domain model and database schema defined in `PLAN.md` and `docs/backend.md`.

### Tech Stack Overview

| Layer | Technology | Function / Rationale |
|---|---|---|
| **Framework** | Flutter 3.x (Dart 3.x) | Cross-platform high-performance UI rendering for iOS and Android. |
| **State Management** | Riverpod 2.x (`flutter_riverpod` + `riverpod_annotation`) | Reactive, compile-safe state management decoupled from UI widgets. |
| **Networking** | Dio (`dio`) | Feature-rich HTTP client with custom interceptors for JWT auth and offline outbox queuing. |
| **Local Storage** | Hive (`hive_flutter`) | High-speed, lightweight key-value NoSQL database for local caching and offline sync queue. |
| **Routing** | GoRouter (`go_router`) | Declarative, role-based path routing with route guards for authenticated sessions. |
| **Typography** | `google_fonts` (Inter & Roboto Mono) | High-contrast, developer-centric typographic hierarchy. |
| **Connectivity** | `connectivity_plus` | Active network listener for automatic background sync triggering. |
| **Push Notifications** | Firebase Cloud Messaging (`firebase_messaging`) | Real-time push alerts for attendance, grade locking, and ADM stage updates. |

---

## 2. Supabase-Inspired UI/UX Design System Specification

The design system mimics a dense, developer-focused desktop dashboard on a mobile screen, emphasizing tabular clarity, dark mode aesthetics, and zero visual bloat.

### Color Palette

| Token Name | Hex Code | Purpose / Usage |
|---|---|---|
| `bg-dark` | `#1C1C1C` | App background, page canvas. |
| `surface-dark` | `#141414` | Card backgrounds, drawer panels, modal surfaces. |
| `surface-elevated` | `#222222` | Data row hover/active states, dropdown menus. |
| `border-subtle` | `#2E2E2E` | 1px clean card borders, table dividers, input borders. |
| `primary-emerald` | `#3ECF8E` | Primary buttons, active tabs, toggles, success indicators. |
| `text-primary` | `#F3F4F6` | High-contrast white text for titles, body text. |
| `text-secondary` | `#9CA3AF` | Subtitles, labels, metadata text. |
| `risk-high / absent` | `#EF4444` | High risk indicators, absent attendance status, grade drop alerts. |
| `risk-med / late` | `#F59E0B` | Moderate risk badges, tardiness alerts. |
| `risk-low / present`| `#10B981` | Low risk badges, present attendance, approved status. |

### Typography Rules

- **Standard UI Elements (Titles, Buttons, Labels):** `Inter` font. Clean, legible sans-serif.
- **Tabular Data & Key Codes (Grades, Raw Scores, LRNs, Dates, Timestamps):** `Roboto Mono` font. Fixed-width numbers ensure aligned data tables.

### Layout & Component Density

- **Borders over Shadows:** Zero drop-shadows. All cards and inputs utilize `1px solid #2E2E2E` rounded borders (`BorderRadius.circular(6)`).
- **Horizontal Data Grids:** Grade input and attendance rosters use horizontally scrollable, sticky-header data tables (`SingleChildScrollView` + custom data row builders) allowing full spreadsheet-like entry on mobile screens.
- **Feedback & Loaders:** Subtle shimmer skeleton loaders (`shimmer`) during network/disk reads, dark toast notifications (`sonner`-style floating dark pills with emerald borders) for sync queue updates.

---

## 3. Architecture & Repository Abstraction

To decouple UI/UX development from backend availability, the app uses an **Interface-Driven Repository Pattern**. 

```
lib/
├── app/
│   ├── config/              # Colors, Theme, Constants, GoRouter
│   └── theme/               # Dark Supabase theme configuration
├── data/
│   ├── local/               # Hive boxes & outbox storage logic
│   ├── mock/                # Mock datasets matching backend Prisma schemas
│   ├── models/              # Freezed / JsonSerializable data classes
│   └── repositories/        # Repository Interfaces & Implementations
│       ├── auth_repository.dart
│       ├── grades_repository.dart
│       ├── attendance_repository.dart
│       ├── adm_repository.dart
│       ├── anecdotal_repository.dart
│       └── notifications_repository.dart
├── providers/               # Riverpod state providers & workers
└── presentation/            # Role-based Workspaces & Components
    ├── auth/                # Login & Role switcher UI
    ├── teacher/             # Attendance, Grade Spreadsheet, Locking, Incident Log
    ├── adm_coordinator/     # ADM Stage Kanban & Analytics
    ├── parent/              # Child Selector, Attendance Heatmap, Report Card
    ├── student/             # Grade Tracker, Attendance Log, ADM Modules
    └── shared/              # Reusable UI components (Borders, Grids, Toasts, Badges)
```

### Dual Repository Implementation Pattern

```dart
// Repository Interface
abstract class IGradesRepository {
  Future<List<StudentGrade>> getGradesForSection(String sectionId, String subjectId, String termId);
  Future<void> saveGradeEntry(String studentId, String assessmentId, double rawScore);
  Future<void> lockGrades(String sectionId, String subjectId, String termId);
}

// Mock Implementation (Used in Phases 1-4)
class MockGradesRepository implements IGradesRepository { ... }

// API + Offline Implementation (Used in Phase 5)
class ApiGradesRepository implements IGradesRepository {
  final Dio dio;
  final HiveBox syncQueueBox;
  ...
}
```

---

## 4. Hive Offline Engine & Outbox Sync Pattern

The offline engine ensures continuous teacher productivity during network drops in classrooms.

```
       [ Teacher Inputs Grade / Attendance ]
                       │
                       ▼
            [ Is Device Online? ]
             /                 \
        (Yes)                   (No / SocketException)
          │                               │
          ▼                               ▼
[ Direct Dio Request ]        [ Save to `sync_queue_box` ]
 (POST/PUT to Express)       [ Optimistic Update Local Hive ]
          │                               │
          └───────────┐       ┌───────────┘
                      ▼       ▼
           [ UI Updates Instantly ]
                      │
                      ▼ (When Network Restored)
        [ Background Sync Worker Drains Outbox ]
        [ Sequential Re-attempts via Dio ]
```

### Hive Box Registry

1. `user_profile_box` — Stores active user profile, JWT tokens, and cached role permissions.
2. `grades_cache_box` — Cached student grade matrices per section and subject.
3. `attendance_cache_box` — Cached daily roster attendance records.
4. `adm_cache_box` — Cached ADM learner cases, stages, and module checklists.
5. `sync_queue_box` — Outbox table storing pending offline mutations:
   - `op_id` (String, UUID)
   - `endpoint` (String, e.g. `/api/attendance/bulk`)
   - `method` (String, `POST`/`PUT`/`PATCH`)
   - `payload` (JSON Map)
   - `timestamp` (DateTime)
   - `retryCount` (Int)

---

## 5. Role-Specific Mobile Workspaces

### 1. Advisers & Subject Teachers

- **Roster Attendance Marking:**
  - Fast AM/PM session selector.
  - "Mark All Present" batch action button.
  - One-tap status toggle pills: `Present` (Emerald), `Absent` (Red), `Late` (Amber), `Excused` (Blue).
  - Background outbox submission on connection drop.
- **Grade Input Matrix (Spreadsheet UI):**
  - Horizontally scrollable spreadsheet with sticky student name column.
  - Columns for Written Work (WW), Performance Tasks (PT), and Quarterly Exams (QE).
  - Real-time client-side DepEd transmuted grade calculation preview.
- **Grade Locking Workflow:**
  - "Lock Grades" action bar with summary modal.
  - Locks local fields immediately, queues lock request, and triggers notification alert to Adviser/Registrar.
- **Incident Logger & ADM Referral:**
  - Form to log anecdotal incidents (Behavioral, Academic, Attendance, Health).
  - One-tap "Escalate to ADM / Guidance" button creating a referral row.

### 2. ADM Coordinator

- **ADM Pipeline Stage Tracker:**
  - Horizontal Kanban / Stepper board visualizing student cases across 8 DepEd ADM stages:
    `Anecdotal` ➔ `Consultation` ➔ `Meeting Parents` ➔ `Home Visitation` ➔ `Certification` ➔ `Principal Approval` ➔ `Monitoring` ➔ `Completion`
  - Drag-and-drop or tap-to-advance stage movement.
- **Module & Asset Tracking:**
  - Tracking matrix for self-learning modules released vs. submitted.
  - Issued device log (tablets/laptops) with serial numbers and return status.
- **Coordinator Analytics Dashboard:**
  - Cards showing total active cases, high-risk flags, and intervention success rates.

### 3. Parents

- **Multi-Child Switcher:**
  - Header bar to toggle between enrolled children.
- **Attendance Heatmap & Real-Time Alerts:**
  - Monthly calendar view with color-coded day dots (Green = Present, Red = Absent, Amber = Late).
  - Instant banner notification when a teacher flags an absence.
- **Locked Grade Cards:**
  - Quarterly report card view showing finalized transmuted grades and teacher remarks.
- **ADM Status Tracker:**
  - Simple milestone tracker if child is enrolled in an ADM program.

### 4. Students

- **Academic Progress Tracker:**
  - Current Term GPA summary card with Risk Level status indicator (`Low`, `Moderate`, `High`).
  - Subject-by-subject grade breakdown with assessment details.
- **Personal Attendance Log:**
  - Personal monthly attendance summary and percentage rate.
- **ADM Module Checklist:**
  - View assigned ADM learning modules, due dates, and submission statuses.

---

## 6. Phased Development Roadmap

```
Phase 1: Foundation & Design System (Week 1)
  ├── Flutter setup in /mobile
  ├── Supabase-inspired Dark Theme (#1C1C1C, #3ECF8E, #2E2E2E)
  ├── Typography (Inter & Roboto Mono) setup
  └── GoRouter Navigation Shell & Role Switcher Mock

Phase 2: Core Workspaces with Mock Data (Weeks 2–3)
  ├── Mock Data Repositories matching Express Prisma schema
  ├── Teacher Workspace (Roster Attendance & Grade Spreadsheet)
  ├── ADM Coordinator Workspace (Stage Kanban & Device Log)
  ├── Parent & Student Dashboards (Heatmaps & Grade Cards)
  └── Anecdotal / Referral Incident Logging UI

Phase 3: Hive Storage & Offline Outbox Simulation (Week 4)
  ├── Hive Box initializations (profiles, cache, sync queue)
  ├── Offline Outbox queue engine logic (`sync_queue_box`)
  ├── Mock connection toggle (Online/Offline simulator in dev drawer)
  └── Sync Status Toast alerts & optimistic UI updates

Phase 4: Notifications & Risk Alerts UI (Week 5)
  ├── Firebase Cloud Messaging (FCM) Flutter integration setup
  ├── Notification Feed UI & In-App Alert Banners
  └── UI Polish & Accessibility checks matching Zentra web spec

Phase 5: Backend Connection to Zentra Express REST API (Week 6)
  ├── Replace `MockRepositories` with `ApiRepositories`
  ├── Dio Client setup with JWT Access/Refresh Token interceptors
  ├── Wire Outbox Queue to Express REST Endpoints (/api/attendance, /api/grades, etc.)
  └── End-to-End Sync Testing & Production Verification
```

---

## 7. Next Steps for Implementation

1. Initialize the Flutter application inside `/home/jeslito/Desktop/zentra/msat-zentra/mobile`.
2. Configure `pubspec.yaml` with required dependencies (`flutter_riverpod`, `dio`, `hive_flutter`, `go_router`, `google_fonts`, `connectivity_plus`, `freezed_annotation`, `shimmer`).
3. Build the Supabase dark theme configuration and theme tokens in `lib/app/theme/theme.dart`.
4. Create mock JSON datasets and `Mock*Repository` providers to power all 4 role views immediately.
