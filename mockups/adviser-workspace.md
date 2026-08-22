# Adviser — Workspace Mockup

Source: `docs/role-modules/` (Adviser not yet written — inferred from PLAN.md §4.2:
all teacher duties + AM/PM attendance, anecdotal for advisees, ADM tracking, lock
finals, SF10 upload/OCR/verify). Task-dense, keyboard-first.

## Home (Adviser)
```
┌──────────────┬───────────────────────────────────────────────────────────┐
│  SIDEBAR     │  Adviser Home · Grade 9-A                       [today]     │
│  Adviser     ├───────────────────────────────────────────────────────────┤
│  Home ●      │  Quick actions: [Take Attendance] [Encode Grade] [New Anec]│
│  Attendance  │                                                           │
│  Grades      │  My advisees (table, sticky header):                     │
│  Anecdotals  │  ┌────────┬────────┬──────┬──────┬────────┬─────┐        │
│  ADM Track   │  │ LRN    │ Name   │Risk  │Att   │Last Anec│ ⚙   │        │
│  My Advisees │  │2025…01 │ Reyes  │Mod   │88%   │2d ago   │ →   │        │
│  SF10        │  │2025…02 │ Cruz   │Low   │95%   │—        │ →   │        │
│  Notif       │  └────────┴────────┴──────┴──────┴────────┴─────┘        │
└──────────────┴───────────────────────────────────────────────────────────┘
```
- "My advisees" = `Table` (@tanstack/react-table), monospaced LRN, Risk badge
  (red/amber/green), row → advisee detail.

## Attendance (AM/PM bulk)
```
┌───────────────────────────────────────────────────────────────────────────┐
│ Take Attendance · 9-A · [date] · Term 2                                    │
│ Section: [9-A ▾]   Session: (● AM ○ PM)                                     │
├───────────────────────────────────────────────────────────────────────────┤
│ ┌────────┬────────┬───────────┬───────────┬───────────┐                     │
│ │ LRN   │ Name   │ Present   │ Absent    │ Late      │  (radio per row)   │
│ │ …01   │ Reyes  │ (●)       │ ( )       │ ( )       │                     │
│ │ …02   │ Cruz   │ ( )       │ (●)       │ ( )       │                     │
│ └────────┴────────┴───────────┴───────────┴───────────┘                     │
│ [Save & Lock]  [Save Draft]                                                 │
└───────────────────────────────────────────────────────────────────────────┘
```
- `RadioGroup` per row (present/absent/late/excused). `Button` Save & Lock writes
  `attendance_records` + recomputes risk. Keyboard-first (arrow+space).

## Anecdotal (new record — GCForm-01)
```
┌───────────────────────────────────────────────────────────────────────────┐
│ New Anecdotal Record                                                        │
│ Student: [Reyes, J. ▾]   Date/Time: [picker]   Term: [2 ▾]                 │
│ Category: (Behavioral ○ Academic ○ Emotional)                              │
│ Incident: [textarea]                                                        │
│ Location: [input]   Class perf: [input]   Attendance summary: [input]      │
│ Confidentiality: [level ▾]   Attachment: [upload]                         │
│ [Create & Refer →]  [Save]                                                 │
└───────────────────────────────────────────────────────────────────────────┘
```
- `Form` (react-hook-form + zod) + `Textarea`, `Select`, `Input`, `FileUpload`.
  "Create & Refer" → opens referral `Dialog` (referred_to_role).

## Actions (✎ from PLAN.md §4.2)
- Take/lock AM-PM attendance; encode grades; create anecdotal + refer; track ADM;
  lock final grades for registrar approval; upload/OCR/verify SF10.

## Anti-generic notes
- High density, sticky headers, monospaced IDs. Borders not shadows. One accent on
  primary actions only. Micro-motion on row hover/expand.
