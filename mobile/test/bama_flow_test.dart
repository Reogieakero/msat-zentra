import 'package:flutter_test/flutter_test.dart';
import 'package:zentra_mobile/features/bama/bama_flow.dart';

void main() {
  test('Bama question order follows web bama-flow.ts', () {
    expect(nextQuestion[TextQuestion.incident], TextQuestion.location);
    expect(nextQuestion[TextQuestion.location], TextQuestion.notes);
    expect(nextQuestion[TextQuestion.notes], TextQuestion.classPerformance);
    expect(nextQuestion[TextQuestion.classPerformance], TextQuestion.attendance);
    expect(nextQuestion[TextQuestion.attendance], isNull);
  });

  test('FlowSnapshot round-trips for Hive offline drafts', () {
    final f = FlowSnapshot(studentId: 'roster:abc', classKey: 'sub|sec|term', category: 'behavioral', textQuestion: TextQuestion.incident);
    final back = FlowSnapshot.fromJson(f.toJson());
    expect(back.studentId, 'roster:abc');
    expect(back.textQuestion, TextQuestion.incident);
  });

  test('resetFlowTo clears step and downstream, keeps upstream', () {
    final f = FlowSnapshot(
      studentId: 's1',
      classKey: 'sub|sec|term',
      category: 'behavioral',
      tier: 'restricted',
      observationDate: '2026-10-01',
      observationTime: '08:00',
      incident: 'x',
      location: 'y',
      previewShown: true,
    );
    resetFlowTo(f, 'category');
    expect(f.studentId, 's1');
    expect(f.classKey, 'sub|sec|term');
    expect(f.category, isNull);
    expect(f.tier, isNull);
    expect(f.observationDate, isNull);
    expect(f.incident, isEmpty);
    expect(f.previewShown, isFalse);
    expect(f.askedCategory, isTrue);
  });

  test('resetFlowTo student clears everything', () {
    final f = FlowSnapshot(studentId: 's1', classKey: 'k', category: 'academic', tier: 'restricted');
    resetFlowTo(f, 'student');
    expect(f.studentId, isEmpty);
    expect(f.classKey, isEmpty);
    expect(f.category, isNull);
    expect(f.askedCategory, isFalse);
  });

  test('resetFlowTo ignores unknown steps', () {
    final f = FlowSnapshot(studentId: 's1', category: 'academic');
    resetFlowTo(f, 'nope');
    expect(f.studentId, 's1');
    expect(f.category, 'academic');
  });

  test('buildAnecdotalBody emits UTC Z-suffixed datetime', () {
    final withTime = buildAnecdotalBody(
      studentId: 's1', sectionId: 'sec', termId: 'term',
      observationDate: '2026-10-07', observationTime: '08:00',
      incident: 'note', location: '', notes: '', classPerformance: '',
      attendanceSummary: '', category: 'behavioral', tier: 'restricted',
    );
    final dt = withTime['observationDatetime'] as String;
    expect(dt.endsWith('Z'), isTrue);
    expect(DateTime.parse(dt).toIso8601String(), dt);
    expect(withTime['descriptionOfLocation'], 'Classroom');
    expect(withTime.containsKey('notesRecommendationsActions'), isFalse);

    final noTime = buildAnecdotalBody(
      studentId: 's1', sectionId: 'sec', termId: 'term',
      observationDate: '2026-10-07', observationTime: '',
      incident: 'note', location: 'Gate', notes: '', classPerformance: '',
      attendanceSummary: '', category: 'bullying', tier: 'confidential',
    );
    expect((noTime['observationDatetime'] as String).endsWith('Z'), isTrue);
    // Confidential tier carries the incident as notes fallback (web parity).
    expect(noTime['notesRecommendationsActions'], 'note');
  });

  test('formatApiFailure surfaces code and field detail', () {
    expect(
      formatApiFailure({'error': {'code': 'VALIDATION_ERROR', 'message': 'Invalid input', 'fields': {'observationDatetime': ['Invalid datetime']}}}, fallback: 'fb'),
      '[VALIDATION_ERROR] Invalid input (observationDatetime: Invalid datetime)',
    );
    expect(formatApiFailure({'error': {'message': 'Nope'}}, fallback: 'fb'), 'Nope');
    expect(formatApiFailure('garbage', fallback: 'fb'), 'fb');
    expect(formatApiFailure(null, fallback: 'fb'), 'fb');
  });
}
