// Zentra mobile — shared DTOs.
// Field names mirror the Express JSON responses so no translation layer drifts.
// See backend/src/modules/teacher/teacher.routes.ts, attendance.routes.ts,
// anecdotal.routes.ts, academics routes.

class SchoolYear {
  final String id;
  final String name;
  final bool isActive;
  final List<Term> terms;
  SchoolYear({required this.id, required this.name, required this.isActive, required this.terms});

  factory SchoolYear.fromJson(Map<String, dynamic> j) => SchoolYear(
        id: j['id'] as String,
        name: j['name'] as String,
        isActive: (j['isActive'] ?? j['is_active'] ?? false) as bool,
        terms: [for (final t in (j['terms'] as List? ?? [])) Term.fromJson(t as Map<String, dynamic>, j['id'] as String)],
      );
}

class Term {
  final String id;
  final String schoolYearId;
  final String schoolYearName;
  final int termNumber;
  Term({required this.id, required this.schoolYearId, required this.schoolYearName, required this.termNumber});

  factory Term.fromJson(Map<String, dynamic> j, String syId, [String syName = '']) => Term(
        id: j['id'] as String,
        schoolYearId: (j['schoolYearId'] ?? syId) as String,
        schoolYearName: (j['schoolYearName'] ?? syName) as String,
        termNumber: (j['termNumber'] ?? j['term_number'] ?? 1) as int,
      );

  Map<String, dynamic> toJson() => {
        'schoolYearId': schoolYearId,
        'schoolYearName': schoolYearName,
        'termId': id,
        'termNumber': termNumber,
      };

  factory Term.fromCache(Map<String, dynamic> j) => Term(
        id: j['termId'] as String,
        schoolYearId: j['schoolYearId'] as String,
        schoolYearName: j['schoolYearName'] as String? ?? '',
        termNumber: j['termNumber'] as int? ?? 1,
      );
}

class AdvisoryStudent {
  final String studentId;
  final String name;
  final String lrn;
  final bool hasAccount;
  final double? attendancePercentage;
  final int attendancePresent;
  final int attendanceTotal;
  final double? academicGrade;
  final double? computedAverage;
  final String riskLevel;
  final List<String> flags;
  AdvisoryStudent({
    required this.studentId,
    required this.name,
    required this.lrn,
    required this.hasAccount,
    this.attendancePercentage,
    this.attendancePresent = 0,
    this.attendanceTotal = 0,
    this.academicGrade,
    this.computedAverage,
    this.riskLevel = 'Low',
    this.flags = const [],
  });

  factory AdvisoryStudent.fromJson(Map<String, dynamic> j) => AdvisoryStudent(
        studentId: j['studentId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        lrn: j['lrn'] as String? ?? '',
        hasAccount: (j['hasAccount'] ?? true) as bool,
        attendancePercentage: (j['attendancePercentage'] as num?)?.toDouble(),
        attendancePresent: (j['attendancePresent'] ?? 0) as int,
        attendanceTotal: (j['attendanceTotal'] ?? 0) as int,
        academicGrade: (j['academicGrade'] as num?)?.toDouble(),
        computedAverage: (j['computedAverage'] as num?)?.toDouble(),
        riskLevel: j['riskLevel'] as String? ?? 'Low',
        flags: [for (final f in (j['flags'] as List? ?? [])) f.toString()],
      );
}

class ClassSlot {
  final String id; // assignmentId or subjectId|sectionId
  final String subject;
  final String section;
  final String gradeLevel;
  final int studentCount;
  ClassSlot({required this.id, required this.subject, required this.section, required this.gradeLevel, required this.studentCount});
  factory ClassSlot.fromJson(Map<String, dynamic> j) => ClassSlot(
        id: j['id'].toString(),
        subject: j['subject'] as String? ?? '',
        section: j['section'] as String? ?? '',
        gradeLevel: j['gradeLevel'] as String? ?? '',
        studentCount: (j['studentCount'] ?? 0) as int,
      );
}

class TimetableSlot {
  final int day; // 1=Mon..5=Fri
  final int period;
  final String status;
  final String subjectName;
  final String subjectCode;
  final String sectionName;
  TimetableSlot({required this.day, required this.period, required this.status, required this.subjectName, required this.subjectCode, required this.sectionName});
  factory TimetableSlot.fromJson(Map<String, dynamic> j) => TimetableSlot(
        day: (j['day'] ?? 1) as int,
        period: (j['period'] ?? 0) as int,
        status: j['status'] as String? ?? '',
        subjectName: j['subject']?['name'] as String? ?? j['subjectName'] as String? ?? '',
        subjectCode: j['subject']?['code'] as String? ?? '',
        sectionName: j['section']?['name'] as String? ?? j['sectionName'] as String? ?? '',
      );
}

class GradeAssessment {
  final String id;
  final String title;
  final double maxScore;
  final String dateGiven;
  final Map<String, double> scores;
  GradeAssessment({required this.id, required this.title, required this.maxScore, required this.dateGiven, required this.scores});
  factory GradeAssessment.fromJson(Map<String, dynamic> j) => GradeAssessment(
        id: j['id'] as String,
        title: j['title'] as String? ?? '',
        maxScore: ((j['maxScore'] ?? 0) as num).toDouble(),
        dateGiven: j['dateGiven'] as String? ?? '',
        scores: {for (final e in ((j['scores'] ?? {}) as Map).entries) e.key.toString(): ((e.value ?? 0) as num).toDouble()},
      );
}

class GradeComponent {
  final String type; // WRITTEN_WORK | PERFORMANCE_TASK | EXAM
  final String label; // WW | PT | E
  final int weight;
  final List<GradeAssessment> assessments;
  GradeComponent({required this.type, required this.label, required this.weight, required this.assessments});
  factory GradeComponent.fromJson(Map<String, dynamic> j) => GradeComponent(
        type: j['type'] as String? ?? '',
        label: j['label'] as String? ?? '',
        weight: (j['weight'] ?? 0) as int,
        assessments: [for (final a in (j['assessments'] as List? ?? [])) GradeAssessment.fromJson(a as Map<String, dynamic>)],
      );
}

class GradebookStudent {
  final String id;
  final String name;
  final String lrn;
  final bool hasAccount;
  final Map<String, dynamic>? finalGrade;
  GradebookStudent({required this.id, required this.name, required this.lrn, required this.hasAccount, this.finalGrade});
  factory GradebookStudent.fromJson(Map<String, dynamic> j) => GradebookStudent(
        id: j['id'] as String? ?? j['studentId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        lrn: j['lrn'] as String? ?? '',
        hasAccount: (j['hasAccount'] ?? true) as bool,
        finalGrade: j['final'] as Map<String, dynamic>?,
      );
}

class ApiException implements Exception {
  final String code;
  final String message;
  final int? statusCode;
  final Object? cause;
  ApiException(this.code, this.message, {this.statusCode, this.cause});
  @override
  String toString() => '$code: $message';
}

// ---------------------------------------------------------------------------
// Student / Parent portal DTOs (backend/src/services/portal/learnerData.service.ts)
// ---------------------------------------------------------------------------

class PortalTerm {
  final String id;
  final int termNumber;
  final String schoolYearId;
  final String schoolYearName;
  PortalTerm({required this.id, required this.termNumber, required this.schoolYearId, required this.schoolYearName});
  factory PortalTerm.fromJson(Map<String, dynamic> j) => PortalTerm(
        id: j['id'] as String? ?? '',
        termNumber: (j['termNumber'] ?? 1) as int,
        schoolYearId: j['schoolYearId'] as String? ?? '',
        schoolYearName: j['schoolYearName'] as String? ?? '',
      );
  String get label => '$schoolYearName · Term $termNumber';
}

class PortalLearner {
  final String studentId;
  final String name;
  final String lrn;
  final String gradeLevel;
  final String? mascot;
  final String? photoUrl;
  final String? sectionId;
  final String? sectionName;
  final String? adviserName;
  PortalLearner({
    required this.studentId,
    required this.name,
    required this.lrn,
    required this.gradeLevel,
    this.mascot,
    this.photoUrl,
    this.sectionId,
    this.sectionName,
    this.adviserName,
  });
  factory PortalLearner.fromJson(Map<String, dynamic> j) => PortalLearner(
        studentId: j['studentId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        lrn: j['lrn'] as String? ?? '',
        gradeLevel: j['gradeLevel'] as String? ?? '',
        mascot: j['mascot'] as String?,
        photoUrl: j['photoUrl'] as String?,
        sectionId: j['sectionId'] as String?,
        sectionName: j['sectionName'] as String?,
        adviserName: j['adviserName'] as String?,
      );
}

class PortalChild {
  final String studentId;
  final String name;
  final String lrn;
  final String gradeLevel;
  final String? sectionName;
  final String? relationship;
  PortalChild({
    required this.studentId,
    required this.name,
    required this.lrn,
    required this.gradeLevel,
    this.sectionName,
    this.relationship,
  });
  factory PortalChild.fromJson(Map<String, dynamic> j) => PortalChild(
        studentId: j['studentId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        lrn: j['lrn'] as String? ?? '',
        gradeLevel: j['gradeLevel'] as String? ?? '',
        sectionName: j['sectionName'] as String?,
        relationship: j['relationship'] as String?,
      );
}

class PortalGrade {
  final String id;
  final String subjectId;
  final String subjectName;
  final String subjectCode;
  final double? computedAverage;
  final double? transmutedGrade;
  final String? remarks;
  final String lockStatus;
  PortalGrade({
    required this.id,
    required this.subjectId,
    required this.subjectName,
    required this.subjectCode,
    this.computedAverage,
    this.transmutedGrade,
    this.remarks,
    required this.lockStatus,
  });
  factory PortalGrade.fromJson(Map<String, dynamic> j) => PortalGrade(
        id: j['id'] as String? ?? '',
        subjectId: j['subjectId'] as String? ?? '',
        subjectName: j['subjectName'] as String? ?? '',
        subjectCode: j['subjectCode'] as String? ?? '',
        computedAverage: (j['computedAverage'] as num?)?.toDouble(),
        transmutedGrade: (j['transmutedGrade'] as num?)?.toDouble(),
        remarks: j['remarks'] as String?,
        lockStatus: j['lockStatus'] as String? ?? 'unlocked',
      );
}

class PortalAttendanceSummary {
  final double rate;
  final int present;
  final int absent;
  final int late;
  final int excused;
  final int total;
  final bool isRisk;
  PortalAttendanceSummary({
    required this.rate,
    required this.present,
    required this.absent,
    required this.late,
    required this.excused,
    required this.total,
    required this.isRisk,
  });
  factory PortalAttendanceSummary.fromJson(Map<String, dynamic> j) => PortalAttendanceSummary(
        rate: (j['rate'] as num?)?.toDouble() ?? 1,
        present: (j['present'] ?? 0) as int,
        absent: (j['absent'] ?? 0) as int,
        late: (j['late'] ?? 0) as int,
        excused: (j['excused'] ?? 0) as int,
        total: (j['total'] ?? 0) as int,
        isRisk: (j['isRisk'] ?? false) as bool,
      );
  int get percent => (rate * 100).round();
}

class PortalSubjectAttendance {
  final String subjectId;
  final String subjectName;
  final String subjectCode;
  final int present;
  final int absent;
  final int late;
  final int excused;
  final int total;
  final double rate;
  PortalSubjectAttendance({
    required this.subjectId,
    required this.subjectName,
    required this.subjectCode,
    required this.present,
    required this.absent,
    required this.late,
    required this.excused,
    required this.total,
    required this.rate,
  });
  factory PortalSubjectAttendance.fromJson(Map<String, dynamic> j) => PortalSubjectAttendance(
        subjectId: j['subjectId'] as String? ?? '',
        subjectName: j['subjectName'] as String? ?? '',
        subjectCode: j['subjectCode'] as String? ?? '',
        present: (j['present'] ?? 0) as int,
        absent: (j['absent'] ?? 0) as int,
        late: (j['late'] ?? 0) as int,
        excused: (j['excused'] ?? 0) as int,
        total: (j['total'] ?? 0) as int,
        rate: (j['rate'] as num?)?.toDouble() ?? 1,
      );
  int get percent => (rate * 100).round();
}

class PortalAttendanceRecord {
  final String id;
  final String date;
  final String status;
  final String session;
  final String? subjectName;
  PortalAttendanceRecord({
    required this.id,
    required this.date,
    required this.status,
    required this.session,
    this.subjectName,
  });
  factory PortalAttendanceRecord.fromJson(Map<String, dynamic> j) => PortalAttendanceRecord(
        id: j['id'] as String? ?? '',
        date: j['date'] as String? ?? '',
        status: j['status'] as String? ?? '',
        session: j['session'] as String? ?? '',
        subjectName: j['subjectName'] as String?,
      );
}

class PortalAttendance {
  final PortalTerm? term;
  final PortalAttendanceSummary summary;
  final List<PortalSubjectAttendance> bySubject;
  final List<PortalAttendanceRecord> recent;
  PortalAttendance({required this.term, required this.summary, required this.bySubject, required this.recent});
  factory PortalAttendance.fromJson(Map<String, dynamic> j) => PortalAttendance(
        term: j['term'] is Map ? PortalTerm.fromJson(Map<String, dynamic>.from(j['term'] as Map)) : null,
        summary: PortalAttendanceSummary.fromJson(Map<String, dynamic>.from((j['summary'] as Map?) ?? {})),
        bySubject: [for (final x in (j['bySubject'] as List? ?? [])) PortalSubjectAttendance.fromJson(Map<String, dynamic>.from(x as Map))],
        recent: [for (final x in (j['recent'] as List? ?? [])) PortalAttendanceRecord.fromJson(Map<String, dynamic>.from(x as Map))],
      );
}

class PortalScheduleSlot {
  final String id;
  final int day;
  final int period;
  final String status;
  final String subjectName;
  final String subjectCode;
  final String? teacherName;
  PortalScheduleSlot({
    required this.id,
    required this.day,
    required this.period,
    required this.status,
    required this.subjectName,
    required this.subjectCode,
    this.teacherName,
  });
  factory PortalScheduleSlot.fromJson(Map<String, dynamic> j) => PortalScheduleSlot(
        id: j['id'] as String? ?? '',
        day: (j['day'] ?? 1) as int,
        period: (j['period'] ?? 0) as int,
        status: j['status'] as String? ?? '',
        subjectName: j['subjectName'] as String? ?? '',
        subjectCode: j['subjectCode'] as String? ?? '',
        teacherName: j['teacherName'] as String?,
      );
  String get dayLabel => const ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day.clamp(0, 7)];
}

class PortalModule {
  final String id;
  final String kind;
  final String moduleName;
  final String? moduleUrl;
  final String? description;
  final String? releaseDate;
  final String? dueDate;
  final bool submitted;
  final String submissionKind;
  final String? submissionUrl;
  final String? fileUrl;
  final String? fileName;
  final String? submittedAt;
  final String? remarks;
  final String status;
  PortalModule({
    required this.id,
    required this.kind,
    required this.moduleName,
    this.moduleUrl,
    this.description,
    this.releaseDate,
    this.dueDate,
    required this.submitted,
    required this.submissionKind,
    this.submissionUrl,
    this.fileUrl,
    this.fileName,
    this.submittedAt,
    this.remarks,
    required this.status,
  });
  factory PortalModule.fromJson(Map<String, dynamic> j) => PortalModule(
        id: j['id'] as String? ?? '',
        kind: j['kind'] as String? ?? 'general',
        moduleName: j['moduleName'] as String? ?? '',
        moduleUrl: j['moduleUrl'] as String?,
        description: j['description'] as String?,
        releaseDate: j['releaseDate'] as String?,
        dueDate: j['dueDate'] as String?,
        submitted: (j['submitted'] ?? false) as bool,
        submissionKind: j['submissionKind'] as String? ?? 'link',
        submissionUrl: j['submissionUrl'] as String?,
        fileUrl: j['fileUrl'] as String?,
        fileName: j['fileName'] as String?,
        submittedAt: j['submittedAt'] as String?,
        remarks: j['remarks'] as String?,
        status: j['status'] as String? ?? 'posted',
      );
  bool get tracked => kind == 'adm';
}

class PortalSession {
  final String sessionId;
  final String sourceTable;
  final String track;
  final String sessionType;
  final String scheduledAt;
  final String venue;
  final String status;
  PortalSession({
    required this.sessionId,
    required this.sourceTable,
    required this.track,
    required this.sessionType,
    required this.scheduledAt,
    required this.venue,
    required this.status,
  });
  factory PortalSession.fromJson(Map<String, dynamic> j) => PortalSession(
        sessionId: j['sessionId'] as String? ?? '',
        sourceTable: j['sourceTable'] as String? ?? '',
        track: j['track'] as String? ?? '',
        sessionType: j['sessionType'] as String? ?? '',
        scheduledAt: j['scheduledAt'] as String? ?? '',
        venue: j['venue'] as String? ?? '',
        status: j['status'] as String? ?? '',
      );
}

class PortalModuleCounts {
  final int all;
  final int submitted;
  final int pending;
  final int overdue;
  PortalModuleCounts({required this.all, required this.submitted, required this.pending, required this.overdue});
  factory PortalModuleCounts.fromJson(Map<String, dynamic> j) => PortalModuleCounts(
        all: (j['all'] ?? 0) as int,
        submitted: (j['submitted'] ?? 0) as int,
        pending: (j['pending'] ?? 0) as int,
        overdue: (j['overdue'] ?? 0) as int,
      );
}

class PortalHome {
  final PortalLearner learner;
  final PortalTerm term;
  final List<PortalScheduleSlot> todaySlots;
  final PortalAttendanceSummary attendance;
  final List<PortalGrade> grades;
  final double? average;
  final PortalModuleCounts moduleCounts;
  final List<PortalSession> upcomingSessions;
  PortalHome({
    required this.learner,
    required this.term,
    required this.todaySlots,
    required this.attendance,
    required this.grades,
    this.average,
    required this.moduleCounts,
    required this.upcomingSessions,
  });
  factory PortalHome.fromJson(Map<String, dynamic> j) => PortalHome(
        learner: PortalLearner.fromJson(Map<String, dynamic>.from((j['learner'] as Map?) ?? {})),
        term: PortalTerm.fromJson(Map<String, dynamic>.from((j['term'] as Map?) ?? {})),
        todaySlots: [for (final x in (j['todaySlots'] as List? ?? [])) PortalScheduleSlot.fromJson(Map<String, dynamic>.from(x as Map))],
        attendance: PortalAttendanceSummary.fromJson(Map<String, dynamic>.from((j['attendance'] as Map?) ?? {})),
        grades: [for (final x in (j['grades'] as List? ?? [])) PortalGrade.fromJson(Map<String, dynamic>.from(x as Map))],
        average: (j['average'] as num?)?.toDouble(),
        moduleCounts: PortalModuleCounts.fromJson(Map<String, dynamic>.from((j['moduleCounts'] as Map?) ?? {})),
        upcomingSessions: [for (final x in (j['upcomingSessions'] as List? ?? [])) PortalSession.fromJson(Map<String, dynamic>.from(x as Map))],
      );
}

class PortalGrades {
  final PortalTerm? term;
  final List<PortalGrade> grades;
  PortalGrades({required this.term, required this.grades});
  factory PortalGrades.fromJson(Map<String, dynamic> j) => PortalGrades(
        term: j['term'] is Map ? PortalTerm.fromJson(Map<String, dynamic>.from(j['term'] as Map)) : null,
        grades: [for (final x in (j['grades'] as List? ?? [])) PortalGrade.fromJson(Map<String, dynamic>.from(x as Map))],
      );
}

class PortalSchedule {
  final PortalTerm? term;
  final List<PortalScheduleSlot> slots;
  PortalSchedule({required this.term, required this.slots});
  factory PortalSchedule.fromJson(Map<String, dynamic> j) => PortalSchedule(
        term: j['term'] is Map ? PortalTerm.fromJson(Map<String, dynamic>.from(j['term'] as Map)) : null,
        slots: [for (final x in (j['slots'] as List? ?? [])) PortalScheduleSlot.fromJson(Map<String, dynamic>.from(x as Map))],
      );
}

class PortalModules {
  final int page;
  final int totalPages;
  final PortalTerm? term;
  final PortalModuleCounts counts;
  final List<PortalModule> modules;
  PortalModules({required this.term, required this.counts, required this.modules, this.page = 1, this.totalPages = 1});
  factory PortalModules.fromJson(Map<String, dynamic> j) => PortalModules(
        page: (j['page'] as num?)?.toInt() ?? 1,
        totalPages: (j['totalPages'] as num?)?.toInt() ?? 1,
        term: j['term'] is Map ? PortalTerm.fromJson(Map<String, dynamic>.from(j['term'] as Map)) : null,
        counts: PortalModuleCounts.fromJson(Map<String, dynamic>.from((j['counts'] as Map?) ?? {})),
        modules: [for (final x in (j['data'] as List? ?? [])) PortalModule.fromJson(Map<String, dynamic>.from(x as Map))],
      );
}
