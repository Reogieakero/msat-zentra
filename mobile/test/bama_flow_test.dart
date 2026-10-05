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
}
