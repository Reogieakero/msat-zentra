import '../models/grade_model.dart';
import '../models/student_model.dart';
import '../mock/mock_data.dart';

abstract class IGradesRepository {
  Future<List<AssessmentModel>> getAssessments(String subjectId);
  Future<Map<String, double>> getRawGrades(String subjectId);
  Future<void> updateRawScore(String studentId, String assessmentId, double rawScore);
  Future<LockStatus> getLockStatus(String sectionId, String subjectId);
  Future<void> setLockStatus(String sectionId, String subjectId, LockStatus lockStatus);
}

class MockGradesRepository implements IGradesRepository {
  final Map<String, double> _gradesMap = Map.from(MockData.initialRawGrades);
  LockStatus _lockStatus = LockStatus.unlocked;

  @override
  Future<List<AssessmentModel>> getAssessments(String subjectId) async {
    return MockData.mathAssessments;
  }

  @override
  Future<Map<String, double>> getRawGrades(String subjectId) async {
    return Map.unmodifiable(_gradesMap);
  }

  @override
  Future<void> updateRawScore(String studentId, String assessmentId, double rawScore) async {
    final key = '${studentId}_$assessmentId';
    _gradesMap[key] = rawScore;
  }

  @override
  Future<LockStatus> getLockStatus(String sectionId, String subjectId) async {
    return _lockStatus;
  }

  @override
  Future<void> setLockStatus(String sectionId, String subjectId, LockStatus lockStatus) async {
    _lockStatus = lockStatus;
  }

  // DepEd Transmutation Table calculation helper (DO 8, s. 2015)
  static double computeDepEdTransmutedGrade(double initialPercentage) {
    if (initialPercentage >= 100.0) return 100.0;
    if (initialPercentage >= 98.4) return 99.0;
    if (initialPercentage >= 96.8) return 98.0;
    if (initialPercentage >= 95.2) return 97.0;
    if (initialPercentage >= 93.6) return 96.0;
    if (initialPercentage >= 92.0) return 95.0;
    if (initialPercentage >= 90.4) return 94.0;
    if (initialPercentage >= 88.8) return 93.0;
    if (initialPercentage >= 87.2) return 92.0;
    if (initialPercentage >= 85.6) return 91.0;
    if (initialPercentage >= 84.0) return 90.0;
    if (initialPercentage >= 82.4) return 89.0;
    if (initialPercentage >= 80.8) return 88.0;
    if (initialPercentage >= 79.2) return 87.0;
    if (initialPercentage >= 77.6) return 86.0;
    if (initialPercentage >= 76.0) return 85.0;
    if (initialPercentage >= 74.4) return 84.0;
    if (initialPercentage >= 72.8) return 83.0;
    if (initialPercentage >= 71.2) return 82.0;
    if (initialPercentage >= 69.6) return 81.0;
    if (initialPercentage >= 68.0) return 80.0;
    if (initialPercentage >= 66.4) return 79.0;
    if (initialPercentage >= 64.8) return 78.0;
    if (initialPercentage >= 63.2) return 77.0;
    if (initialPercentage >= 61.6) return 76.0;
    if (initialPercentage >= 60.0) return 75.0;
    if (initialPercentage >= 56.0) return 74.0;
    if (initialPercentage >= 52.0) return 73.0;
    if (initialPercentage >= 48.0) return 72.0;
    if (initialPercentage >= 44.0) return 71.0;
    if (initialPercentage >= 40.0) return 70.0;
    if (initialPercentage >= 36.0) return 69.0;
    if (initialPercentage >= 32.0) return 68.0;
    if (initialPercentage >= 28.0) return 67.0;
    if (initialPercentage >= 24.0) return 66.0;
    if (initialPercentage >= 20.0) return 65.0;
    if (initialPercentage >= 16.0) return 64.0;
    if (initialPercentage >= 12.0) return 63.0;
    if (initialPercentage >= 8.0) return 62.0;
    if (initialPercentage >= 4.0) return 61.0;
    return 60.0;
  }
}
