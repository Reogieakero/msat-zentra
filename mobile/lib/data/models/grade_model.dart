enum ComponentType { WRITTEN_WORK, PERFORMANCE_TASK, QUARTERLY_EXAM }

enum LockStatus { unlocked, locked, adviser_approved }

extension ComponentTypeExtension on ComponentType {
  String get shortCode {
    switch (this) {
      case ComponentType.WRITTEN_WORK:
        return 'WW';
      case ComponentType.PERFORMANCE_TASK:
        return 'PT';
      case ComponentType.QUARTERLY_EXAM:
        return 'QE';
    }
  }

  String get label {
    switch (this) {
      case ComponentType.WRITTEN_WORK:
        return 'Written Work';
      case ComponentType.PERFORMANCE_TASK:
        return 'Performance Task';
      case ComponentType.QUARTERLY_EXAM:
        return 'Quarterly Exam';
    }
  }
}

class AssessmentModel {
  final String id;
  final String title;
  final ComponentType componentType;
  final double maxScore;
  final DateTime dateGiven;

  const AssessmentModel({
    required this.id,
    required this.title,
    required this.componentType,
    required this.maxScore,
    required this.dateGiven,
  });
}

class StudentGradeEntry {
  final String studentId;
  final String assessmentId;
  final double rawScore;

  const StudentGradeEntry({
    required this.studentId,
    required this.assessmentId,
    required this.rawScore,
  });
}

class FinalGradeModel {
  final String id;
  final String studentId;
  final String subjectId;
  final String subjectName;
  final String termId;
  final double? computedAverage;
  final double? transmutedGrade;
  final String? remarks;
  final LockStatus lockStatus;

  const FinalGradeModel({
    required this.id,
    required this.studentId,
    required this.subjectId,
    required this.subjectName,
    required this.termId,
    this.computedAverage,
    this.transmutedGrade,
    this.remarks,
    this.lockStatus = LockStatus.unlocked,
  });
}
