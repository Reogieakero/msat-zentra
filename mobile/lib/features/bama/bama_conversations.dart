// Bama conversations store — Dart port of
// frontend/src/app/teacher/chat/components/bama-conversations.ts.
// Multi-thread chats (anecdotal filing wizard + grade-flag free-chat stub),
// persisted in Hive (zentra.bama box): conversations + activeId + id counter.

import 'dart:math';

const bamaChatTypes = ['anecdotal', 'grade-flag'];

const bamaTypeLabels = {
  'anecdotal': 'Anecdotal Record',
  'grade-flag': 'Grade Flag',
};

const bamaGreetings = {
  'anecdotal': 'Hi, I\'m Bama. Tell me what happened and I\'ll help you write the anecdotal record.\nWhich student is this anecdotal report for? Pick one below.',
  'grade-flag': 'Hi, I\'m Bama. Tell me about the grade concern and I\'ll help you put the flag together.',
};

const bamaFreeFollowups = {
  'anecdotal': 'Noted — I\'ve kept that with this chat. Pick the student above and I\'ll walk you through the report.',
  'grade-flag': 'Got it — I\'ve kept that with this chat. Full grade-flag help is still learning, so please raise the actual flag from Grade Flags for now.',
};

class BamaQuestionOption {
  final String value;
  final String label;
  const BamaQuestionOption({required this.value, required this.label});
  Map<String, dynamic> toJson() => {'value': value, 'label': label};
  factory BamaQuestionOption.fromJson(Map<String, dynamic> j) =>
      BamaQuestionOption(value: j['value']?.toString() ?? '', label: j['label']?.toString() ?? '');
}

class BamaQuestion {
  final String type; // student|class|category|tier|datetime
  final List<BamaQuestionOption> options;
  final bool locked;
  const BamaQuestion({required this.type, this.options = const [], this.locked = false});
  BamaQuestion lockedCopy() => BamaQuestion(type: type, options: options, locked: true);
  Map<String, dynamic> toJson() => {'type': type, 'options': [for (final o in options) o.toJson()], 'locked': locked};
  factory BamaQuestion.fromJson(Map<String, dynamic> j) => BamaQuestion(
        type: j['type']?.toString() ?? '',
        options: [for (final o in (j['options'] as List? ?? [])) BamaQuestionOption.fromJson(Map<String, dynamic>.from(o as Map))],
        locked: (j['locked'] ?? false) as bool,
      );
}

class BamaMessage {
  final int id;
  final bool fromUser;
  final String text;
  final int at;
  final BamaQuestion? question;
  final Map<String, dynamic>? preview;
  final Map<String, dynamic>? detail;
  const BamaMessage({required this.id, required this.fromUser, required this.text, required this.at, this.question, this.preview, this.detail});
  Map<String, dynamic> toJson() => {
        'id': id,
        'fromUser': fromUser,
        'text': text,
        'at': at,
        if (question != null) 'question': question!.toJson(),
        if (preview != null) 'preview': preview,
        if (detail != null) 'detail': detail,
      };
  factory BamaMessage.fromJson(Map<String, dynamic> j) => BamaMessage(
        id: (j['id'] ?? 0) as int,
        fromUser: (j['fromUser'] ?? false) as bool,
        text: j['text']?.toString() ?? '',
        at: (j['at'] ?? 0) as int,
        question: j['question'] == null ? null : BamaQuestion.fromJson(Map<String, dynamic>.from(j['question'] as Map)),
        preview: j['preview'] == null ? null : Map<String, dynamic>.from(j['preview'] as Map),
        detail: j['detail'] == null ? null : Map<String, dynamic>.from(j['detail'] as Map),
      );
}

class BamaConversation {
  final String id;
  final String type;
  String title;
  final List<BamaMessage> messages;
  final int updatedAt;
  final bool filed;
  BamaConversation({required this.id, required this.type, required this.title, required this.messages, required this.updatedAt, this.filed = false});
  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'title': title,
        'messages': [for (final m in messages) m.toJson()],
        'updatedAt': updatedAt,
        'filed': filed,
      };
  factory BamaConversation.fromJson(Map<String, dynamic> j) => BamaConversation(
        id: j['id']?.toString() ?? '',
        type: j['type']?.toString() ?? 'anecdotal',
        title: j['title']?.toString() ?? 'New chat',
        messages: [for (final m in (j['messages'] as List? ?? [])) BamaMessage.fromJson(Map<String, dynamic>.from(m as Map))],
        updatedAt: (j['updatedAt'] ?? 0) as int,
        filed: (j['filed'] ?? false) as bool,
      );
}

String bamaTitleOf(String text) {
  final collapsed = text.trim().replaceAll(RegExp(r'\s+'), ' ');
  if (collapsed.isEmpty) return 'New chat';
  if (collapsed.length <= 42) return collapsed;
  return '${collapsed.substring(0, 42)}…';
}

String bamaNewId() {
  final rand = Random().nextInt(1 << 32).toRadixString(16);
  return '${DateTime.now().millisecondsSinceEpoch.toRadixString(16)}-$rand';
}
