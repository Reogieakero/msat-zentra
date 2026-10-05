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
  ApiException(this.code, this.message);
  @override
  String toString() => '$code: $message';
}
