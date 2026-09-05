import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/grade_model.dart';
import '../data/models/student_model.dart';
import '../data/mock/mock_data.dart';
import '../data/repositories/grades_repository.dart';
import 'sync_provider.dart';

final gradesRepositoryProvider = Provider<IGradesRepository>((ref) {
  return MockGradesRepository();
});

class GradeMatrixState {
  final List<StudentModel> students;
  final List<AssessmentModel> assessments;
  final Map<String, double> rawScores;
  final LockStatus lockStatus;

  const GradeMatrixState({
    required this.students,
    required this.assessments,
    required this.rawScores,
    required this.lockStatus,
  });

  GradeMatrixState copyWith({
    List<AssessmentModel>? assessments,
    Map<String, double>? rawScores,
    LockStatus? lockStatus,
  }) {
    return GradeMatrixState(
      students: students,
      assessments: assessments ?? this.assessments,
      rawScores: rawScores ?? this.rawScores,
      lockStatus: lockStatus ?? this.lockStatus,
    );
  }
}

class GradesNotifier extends StateNotifier<AsyncValue<GradeMatrixState>> {
  final IGradesRepository _repository;
  final Ref _ref;

  GradesNotifier(this._repository, this._ref) : super(const AsyncValue.loading()) {
    loadGradeMatrix('sec_g10_emerald', 'sub_math');
  }

  Future<void> loadGradeMatrix(String sectionId, String subjectId) async {
    state = const AsyncValue.loading();
    try {
      final assessments = await _repository.getAssessments(subjectId);
      final rawScores = await _repository.getRawGrades(subjectId);
      final lockStatus = await _repository.getLockStatus(sectionId, subjectId);

      state = AsyncValue.data(GradeMatrixState(
        students: MockData.students,
        assessments: assessments,
        rawScores: rawScores,
        lockStatus: lockStatus,
      ));
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> addAssessment(AssessmentModel newAssessment) async {
    final currentState = state.value;
    if (currentState == null || currentState.lockStatus != LockStatus.unlocked) return;

    final updatedAssessments = [...currentState.assessments, newAssessment];
    final updatedScores = Map<String, double>.from(currentState.rawScores);

    // Initialize default scores for all students for this new assessment (e.g. 0.0 or default score)
    for (final student in currentState.students) {
      final key = '${student.id}_${newAssessment.id}';
      updatedScores[key] = newAssessment.maxScore * 0.8; // Default 80% initial score
    }

    state = AsyncValue.data(currentState.copyWith(
      assessments: updatedAssessments,
      rawScores: updatedScores,
    ));

    _ref.read(syncProvider.notifier).registerMutation(
      'POST',
      '/api/grades/assessments',
      {
        'id': newAssessment.id,
        'title': newAssessment.title,
        'componentType': newAssessment.componentType.name,
        'maxScore': newAssessment.maxScore,
      },
    );
  }

  Future<void> updateScore(String studentId, String assessmentId, double newScore) async {
    final currentState = state.value;
    if (currentState == null || currentState.lockStatus != LockStatus.unlocked) return;

    final key = '${studentId}_$assessmentId';
    final updatedScores = Map<String, double>.from(currentState.rawScores)..[key] = newScore;

    state = AsyncValue.data(currentState.copyWith(rawScores: updatedScores));
    await _repository.updateRawScore(studentId, assessmentId, newScore);

    _ref.read(syncProvider.notifier).registerMutation(
      'POST',
      '/api/grades/raw',
      {'studentId': studentId, 'assessmentId': assessmentId, 'rawScore': newScore},
    );
  }

  Future<void> lockGrades(String sectionId, String subjectId) async {
    final currentState = state.value;
    if (currentState == null) return;

    state = AsyncValue.data(currentState.copyWith(lockStatus: LockStatus.locked));
    await _repository.setLockStatus(sectionId, subjectId, LockStatus.locked);

    _ref.read(syncProvider.notifier).registerMutation(
      'POST',
      '/api/grades/lock',
      {'sectionId': sectionId, 'subjectId': subjectId, 'status': 'locked'},
    );
  }
}

final gradesProvider = StateNotifierProvider<GradesNotifier, AsyncValue<GradeMatrixState>>((ref) {
  final repository = ref.watch(gradesRepositoryProvider);
  return GradesNotifier(repository, ref);
});
