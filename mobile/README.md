# Zentra Mobile — Adviser + Subject Teacher

Flutter app that reuses the **same Express + Prisma API** as the Next.js web app.
Mobile never queries Prisma/Postgres directly.

## Run

```bash
# backend must be running (default http://localhost:4000)
# Android emulator:
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
# Physical device (same WiFi):
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:4000
```

## Structure

- `lib/core/config.dart` — API base URL, Hive box names
- `lib/core/api_client.dart` — Dio port of `frontend/src/lib/api/client.ts` (Bearer + x-school-year-id/x-term-id, single-flight refresh)
- `lib/core/session.dart` — login, school-years, term scope, overview role gate
- `lib/core/sync_outbox.dart` — Hive offline queue (PLAN.md O9: LWW + idempotent by opId)
- `lib/features/auth/` — login, term select, first-time claim/verify gate
- `lib/features/adviser/` — advisory list (Name/LRN/Risk/Factor), student detail, per-subject attendance, section schedule
- `lib/features/teacher/` — my classes, gradebook workspace (components/assessments/scores), attendance
- `lib/features/bama/` — Chat with Bama guided wizard (port of `bama-flow.ts` + `useAnecdotalFlow.ts`), Hive draft resume
- `lib/features/referral/` — refer composer + timeline

## Backend contract (verified)

- `POST /api/auth/login {email,password,role:'staff'}` → concrete `adviser|subject_teacher`
- `GET /api/academics/school-years`, `GET /api/teacher/overview?scope=critical`
- `GET/POST /api/teacher/schedule/teachers/me|claim|verify-attendance|term-grant`
- Adviser: `GET /api/teacher/advisory/students`, `.../students/:id`, `GET /api/attendance/subjects`, `GET /api/teacher/advisory/attendance`, `POST /api/attendance/bulk`, `GET /api/teacher/schedule/my-slots`, `POST /api/anecdotal`, `POST /api/anecdotal/:id/refer`
- Teacher: `GET /api/teacher/grading/classes/:id`, `POST .../assessments`, `POST /api/grades/assessments/:id/score`

## Offline

Attendance bulk, grade scores, anecdotal filing queue in Hive `zentra.outbox` with `opId` when `connectivity_plus` reports no connection. Flush FIFO on reconnect. Server remains authority (LWW by `updated_at`).

## Small backend additions allowed (Phase 5, not yet implemented)

1. `POST /api/notifications/device-token` for FCM push
2. Idempotent `POST /api/sync` deduped by `opId`
3. Pagination on advisory/gradebook lists (currently full lists)
