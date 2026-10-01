# ZENTRA ERD — Schema Notes (evidence-backed)

Source of truth: `backend/prisma/schema.prisma` (PostgreSQL, 1244 lines) +
`backend/prisma/migrations/*.sql` + `backend/src/modules/*` query usage.
Generator: temp script `erd-gen.mjs` (no app code modified).

Import: https://app.diagrams.net/ → File → Open from → Device →
`docs/zentra-erd-full.drawio` or `docs/zentra-erd-presentation.drawio`.

## 1. Schema Summary

```text
Total entities:          45 (44 connected + 1 isolated archive)
Total relationships:     103 FK edges (all rendered as connectors)
Total junction tables:   5 (ParentStudentLink, TeacherSubjectAssignment,
                         SectionTimetableEntry, TeacherTermGrant + dual-track xor pattern on 8 tables)
Total enums:             28
Total major modules:     8 (Identity, Academic, Scheduling, Grading,
                         Attendance/SF10, Behavioral/Guidance, Specialist/System, ADM)
```

Notation: `PK` primary key · `FK col →Parent` foreign key · `UK` unique ·
`PF/UF` = PK/UK that is also an FK (shared-PK 1:1) · `?` nullable ·
`xor` = SQL CHECK exactly-one-of (Prisma comment only) · crow-foot = MANY side.

## 2. Entity Inventory

| Entity | Primary Key | Important Foreign Keys | Purpose |
| ------ | ----------- | ---------------------- | ------- |
| User | id UUID | — (root) | Accounts, role, approval workflow |
| StudentProfile | userId (PK=FK→User) | sectionId→Section NULL | Registered student record |
| ParentProfile | userId (PK=FK→User) | — | Parent account extension |
| ParentStudentLink | id | parentId→ParentProfile, studentId→StudentProfile; UK(pair) | Parent–child junction |
| StaffProfile | userId (PK=FK→User) | — | Employee data, master-teacher flag, signature |
| SchoolYear | id | — (createdBy is plain string, no FK) | School year container |
| Term | id | schoolYearId→SchoolYear; UK(year,number) | Term/quarter container |
| Section | id | schoolYearId→SchoolYear, adviserId→User NULL | Class section + adviser |
| StudentRoster | id | sectionId→Section, schoolYearId→SchoolYear; UK(lrn,year) | Pre-account enrollment roster |
| Subject | id | —; UK(code,gradeLevel) | Subject catalog |
| TeacherSubjectAssignment | id | teacherId→User, subjectId, sectionId, termId; UK(4) | 4-way teaching assignment |
| ScheduleConfig | id | termId→Term UNIQUE (1:1) | Day-shape config per term |
| SectionTimetableEntry | id | sectionId, subjectId, termId, teacherNameId?→TeacherName, submittedBy?/reviewedBy?→User; UK(section,term,day,period) | Weekly timetable slot + review workflow |
| TeacherName | id | userId?→User UNIQUE NULL (1:1) | Display-name catalog, code-claimed |
| TeacherTermGrant | id | userId→User, termId→Term, teacherNameId?→TeacherName; UK(user,term) | Per-term workspace gate |
| AdviserArchivedStudent | id | teacherId→User only (studentId/rosterId plain strings, NO FK) | Adviser-scoped soft hide |
| GradeComponent | id | subjectId→Subject, termId→Term; UK(subject,term,type) | WRITTEN_WORK / PERFORMANCE_TASK / EXAM weights |
| Assessment | id | gradeComponentId→GradeComponent (createdBy plain string) | Quiz/exam instance |
| StudentGrade | id | assessmentId→Assessment, studentId? xor rosterId? | Per-assessment score |
| FinalGrade | id | subjectId→Subject, termId→Term, studentId? xor rosterId? | Transmuted term grade + lock workflow |
| GradeFlag | id | studentId, subjectId, sectionId, termId, raisedBy→User, ownerId?→User, resolvedBy?→User | Teacher-raised grade disputes |
| AttendanceRecord | id | sectionId, termId, subjectId? (Restrict), assignmentId? (SetNull), studentId? xor rosterId? (recordedBy plain string) | Per-subject attendance |
| AttendanceRecordLegacy | id | NONE (isolated, read-only archive) | Frozen pre-migration AM/PM rows |
| AnecdotalRecord | id | observerId→User, sectionId, termId, folderId? (SetNull), studentId? xor rosterId? | Incident/behavior report + sign-off |
| AnecdotalFolder | id | ownerId→User | Teacher-owned filing folders |
| AnecdotalRecordFollowup | id | anecdotalRecordId→AnecdotalRecord, followupBy→User | Follow-up notes |
| Referral | id | anecdotalRecordId→AnecdotalRecord, referredBy→User, termId, studentId? xor rosterId? | Case routing to nurse/guidance/ADM/principal |
| CounselingSession | id | referralId? xor interventionId?, createdBy→User (Restrict) | Guidance talks / home visits |
| ClinicSessionAttachment | id | sessionId→CounselingSession, uploadedBy→User (Restrict) | Session evidence files |
| Intervention | id | assignedTo?→User, studentId? xor rosterId? | At-risk flagged follow-ups |
| HealthRecord | id | studentId→StudentProfile, referralId?→Referral, recordedBy→User, termId | Nurse clinic visits |
| HomeVisitationRecord | id | studentId→StudentProfile, referralId?→Referral, certificationBy→User, termId | Home visit reports |
| AdmLearnerProfile | id | studentId→StudentProfile, referralId→Referral, preparedBy→User, approvedBy?→User, termId | ADM learner case + stage pipeline |
| AdmParentMeeting | id | admLearnerProfileId? xor referralId?, recordedBy→User | Parent meetings / home-venue bookings |
| AdmModule | id | admLearnerProfileId→AdmLearnerProfile, recordedBy→User | Learning modules |
| AdmDevice | id | admLearnerProfileId→AdmLearnerProfile, issuedBy→User | Issued devices |
| AdmForm | id | admLearnerProfileId→AdmLearnerProfile, uploadedBy→User | REFERRAL_FORM / ANECDOTAL_REPORT / CERTIFICATION / MINUTES / HV_FORM |
| Sf10Record | id | studentId→StudentProfile UNIQUE (1:1), verifiedBy?/validatedBy?→User | SF10 per student |
| Sf10RecordVersion | id | sf10RecordId→Sf10Record, changedBy→User | Version history |
| AuditLog | id | userId→User | Every mutating action trail |
| RiskSnapshot | id | termId→Term, studentId? xor rosterId? | Risk level snapshots |
| ReportSnapshot | id | termId→Term | Cached principal reports |
| AdviserSf10AccessRequest | id | adviserId→User, sectionId→Section, decidedBy?→User | G11–12 SF10 access workflow |
| Notification | id | userId→User | Web/mobile/email notifications |
| RefreshToken | id | userId→User; tokenHash UK | Session token store (operational) |

## 3. Relationship Inventory (103 edges — every connector in the full ERD)

Child → Parent | Cardinality | Key evidence
---|---|---
StudentProfile → User | 1:1 | shared PK userId, onDelete Cascade (schema.prisma:298)
StudentProfile → Section | N:1 NULL | sectionId nullable (:299)
ParentProfile → User | 1:1 | shared PK (:320)
ParentStudentLink → ParentProfile / StudentProfile | N:1, N:1 | M:N junction, UK(pair), Cascade (:330-331)
StaffProfile → User | 1:1 | shared PK (:353)
Term → SchoolYear | N:1 | Cascade (:379)
Section → SchoolYear / User(adviser) | N:1, N:1 NULL | Cascade + nullable adviserId (:408-409)
StudentRoster → Section / SchoolYear | N:1, N:1 | Cascade, UK(lrn,year) (:434-435)
TeacherSubjectAssignment → User / Subject / Section / Term | N:1 ×4 | UK(4) (:475-478)
ScheduleConfig → Term | 1:1 | termId @unique, Cascade (:508)
SectionTimetableEntry → Section / Subject / Term / TeacherName | N:1 | Cascade (:530-533)
SectionTimetableEntry → User (submitter / reviewer) | N:1 NULL ×2 | SetNull (:534-535)
TeacherName → User | 1:0/1 | userId @unique NULL, SetNull (:561)
TeacherTermGrant → User / Term | N:1 | Cascade, UK(user,term) (:578-579)
TeacherTermGrant → TeacherName | N:1 NULL | SetNull (:580)
AdviserArchivedStudent → User | N:1 | teacherId Cascade only; studentId/rosterId have NO FK (:597)
GradeComponent → Subject / Term | N:1 | Cascade, UK(subject,term,type) (:613-614)
Assessment → GradeComponent | N:1 | Cascade (:627)
StudentGrade → Assessment | N:1 | Cascade (:640)
StudentGrade → StudentProfile / StudentRoster | xor N:1 | CHECK `=1` (migration 20260911130000)
FinalGrade → Subject / Term | N:1 | (:668-669)
FinalGrade → StudentProfile / StudentRoster | xor N:1 | CHECK (20260911130000)
GradeFlag → StudentProfile / Subject / Section / Term / User(raisedBy) | N:1 | Cascade (:698-702)
GradeFlag → User (owner / resolvedBy) | N:1 NULL | (:703-704)
AttendanceRecord → Section / Term | N:1 | (:742-743)
AttendanceRecord → Subject | N:1 NULL | Restrict (:744)
AttendanceRecord → TeacherSubjectAssignment | N:1 NULL | SetNull (:745)
AttendanceRecord → StudentProfile / StudentRoster | xor N:1 | CHECK (20260911100000)
AttendanceRecordLegacy → (none) | isolated | no relations by design
AnecdotalRecord → User(observer) / Section / Term | N:1 | (:807-809)
AnecdotalRecord → AnecdotalFolder | N:1 NULL | SetNull (:810)
AnecdotalRecord → StudentProfile / StudentRoster | xor N:1 | CHECK (20260911110000)
AnecdotalFolder → User | N:1 | ownerId Cascade (:828)
AnecdotalRecordFollowup → AnecdotalRecord / User | N:1 | Cascade (:839-840)
Referral → AnecdotalRecord | N:1 | Cascade (:877)
Referral → User(referredBy) / Term | N:1 | Cascade (:878, :881)
Referral → StudentProfile / StudentRoster | xor N:1 | CHECK (20260911120000)
CounselingSession → Referral / Intervention | xor N:1 | CHECK (20260912030000), Cascade
CounselingSession → User(createdBy) | N:1 | Restrict (:921)
ClinicSessionAttachment → CounselingSession / User | N:1 | Cascade + Restrict (:942-943)
Intervention → StudentProfile / StudentRoster | xor N:1 | CHECK (20260911140000)
Intervention → User(assignee) | N:1 NULL | (:965)
HealthRecord → StudentProfile / User / Term | N:1 | Cascade (:987-990)
HealthRecord → Referral | N:1 NULL | (:988)
HomeVisitationRecord → StudentProfile / User / Term | N:1 | (:1006-1009)
HomeVisitationRecord → Referral | N:1 NULL | (:1007)
AdmLearnerProfile → StudentProfile / Referral / User(preparedBy) / Term | N:1 | (:1025-1029)
AdmLearnerProfile → User(approvedBy) | N:1 NULL | (:1028)
AdmParentMeeting → AdmLearnerProfile / Referral | xor N:1 | CHECK (20260923020000), Cascade
AdmParentMeeting → User | N:1 | (:1063)
AdmModule → AdmLearnerProfile / User | N:1 | Cascade (:1076-1077)
AdmDevice → AdmLearnerProfile / User(issuer) | N:1 | Cascade (:1089-1090)
AdmForm → AdmLearnerProfile / User(uploader) | N:1 | Cascade (:1103-1104)
Sf10Record → StudentProfile | 1:1 | studentId @unique Cascade (:1133)
Sf10Record → User (verifiedBy / validatedBy) | N:1 NULL | (:1134-1135)
Sf10RecordVersion → Sf10Record / User | N:1 | Cascade (:1147-1148)
AuditLog → User | N:1 | (:1161)
RiskSnapshot → Term | N:1 | (:1179)
RiskSnapshot → StudentProfile / StudentRoster | xor N:1 | CHECK (20260911140000)
ReportSnapshot → Term | N:1 | (:1193)
AdviserSf10AccessRequest → User(adviser) / Section | N:1 | Cascade (:1212-1213)
AdviserSf10AccessRequest → User(decidedBy) | N:1 NULL | (:1214)
Notification → User | N:1 | Cascade (:1233)
RefreshToken → User | N:1 | Cascade (:1243)

## 4. Conflicts (do NOT silently resolve)

1. `StudentRoster`: full Prisma model + 8 FKs reference it, but NO `CREATE TABLE`
   in any migration SQL. Included from Prisma as app truth; needs a migration.
2. `Intervention.assignedTo`, `TeacherSubjectAssignment.*`, `FinalGrade`
   subject/term, `GradeFlag` owner/resolvedBy, `AuditLog.userId`: SQL says
   SET NULL/RESTRICT, Prisma has no explicit onDelete (NoAction default).
   Diagram shows the relation; SQL behavior noted in legend.
3. Legacy AM/PM dedup = partial unique indexes `WHERE subjectId IS NULL`
   (migration 20260927190000), SQL-only. Prisma `@@unique` covers subject-era only.
4. `AdviserArchivedStudent`: comment claims exactly-one-of studentId/rosterId
   but migration has no CHECK and no FKs — rendered edge-less with footnote.

## 5. Final validation

- [x] Every table exists in `schema.prisma`; no invented tables/columns/edges
- [x] Every PK correct (shared-PK 1:1 for User extensions; `id` elsewhere)
- [x] Every FK correct; plain-string non-FKs (recordedBy, createdBy, legacy cols) NOT drawn as edges
- [x] UK composites + xor CHECKs labeled; junction tables explicit (no direct M:N)
- [x] Cardinalities from nullability + @unique (1:1 only where unique/shared-PK)
- [x] Both `.drawio` files XML-validated (tags balanced, ids unique, edge refs resolve)
- [x] Prisma schema + migrations + API query usage cross-checked; conflicts reported above
- [x] No app/database code modified (new files only under `docs/`)
