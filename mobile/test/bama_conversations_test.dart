import 'package:flutter_test/flutter_test.dart';
import 'package:zentra_mobile/features/bama/bama_conversations.dart';

/// Hive deserializes stored maps as dynamic-keyed maps — parsers must
/// accept them. A jsonEncode/jsonDecode round-trip would NOT catch this
/// (it yields String-keyed maps), so fixtures are built dynamic-keyed.
Map<dynamic, dynamic> hiveLike(Map<String, dynamic> m) {
  dynamic convert(Object? v) {
    if (v is Map<String, dynamic>) {
      return Map<dynamic, dynamic>.fromEntries(
        v.entries.map((e) => MapEntry<dynamic, dynamic>(e.key, convert(e.value))),
      );
    }
    if (v is List) return [for (final e in v) convert(e)];
    return v;
  }

  return convert(m) as Map<dynamic, dynamic>;
}

void main() {
  test('BamaConversation round-trips Hive-shaped maps', () {
    final convo = BamaConversation(
      id: 'abc',
      type: 'anecdotal',
      title: 'Juan · Behavioral · Filed',
      messages: [
        BamaMessage(
          id: 1,
          fromUser: false,
          text: 'Which class is this report for?',
          at: 123,
          question: const BamaQuestion(
            type: 'class',
            options: [BamaQuestionOption(value: 's|sec|t', label: 'Math · 7-A')],
          ),
        ),
        BamaMessage(id: 2, fromUser: true, text: 'Math', at: 124),
        BamaMessage(
          id: 3,
          fromUser: false,
          text: 'Anecdotal record filed.',
          at: 125,
          preview: const {'studentName': 'Juan', 'lrn': '123'},
          detail: const {'recordFiled': true},
        ),
      ],
      updatedAt: 999,
      filed: true,
    );
    final stored = hiveLike(convo.toJson());
    expect(stored, isA<Map<dynamic, dynamic>>());

    final back = BamaConversation.fromJson(Map<String, dynamic>.from(stored));
    expect(back.id, 'abc');
    expect(back.title, 'Juan · Behavioral · Filed');
    expect(back.filed, isTrue);
    expect(back.messages, hasLength(3));
    expect(back.messages[0].question!.options.single.label, 'Math · 7-A');
    expect(back.messages[2].preview!['lrn'], '123');
    expect(back.messages[2].detail!['recordFiled'], isTrue);
  });
}
