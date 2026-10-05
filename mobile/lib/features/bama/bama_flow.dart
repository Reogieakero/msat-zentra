// Bama flow constants — direct Dart port of
// frontend/src/app/teacher/chat/components/bama-flow.ts.
// Bama is a guided wizard with pre-configured replies (NOT an LLM):
// student -> class -> category -> tier -> datetime -> 5 texts -> preview -> file.

enum TextQuestion { incident, location, notes, classPerformance, attendance }

const textQuestionLabels = {
  TextQuestion.incident: 'Describe the incident',
  TextQuestion.location: 'Description of Location/Setting',
  TextQuestion.notes: 'Notes / Recommendations / Actions',
  TextQuestion.classPerformance: 'Class Performance',
  TextQuestion.attendance: 'Attendance in Classes for the last 2 weeks/Month',
};

const nextQuestion = {
  TextQuestion.incident: TextQuestion.location,
  TextQuestion.location: TextQuestion.notes,
  TextQuestion.notes: TextQuestion.classPerformance,
  TextQuestion.classPerformance: TextQuestion.attendance,
  TextQuestion.attendance: null,
};

const anecdotalCategories = ['behavioral', 'bullying', 'academic', 'attendance', 'health'];
const anecdotalTiers = ['restricted', 'confidential'];

class FlowSnapshot {
  String studentId;
  String classKey;
  String? category;
  String? tier;
  String? observationDate;
  String observationTime;
  String incident;
  String location;
  String notes;
  String classPerf;
  String attendance;
  TextQuestion? textQuestion;
  bool previewShown;
  FlowSnapshot({
    this.studentId = '',
    this.classKey = '',
    this.category,
    this.tier,
    this.observationDate,
    this.observationTime = '',
    this.incident = '',
    this.location = '',
    this.notes = '',
    this.classPerf = '',
    this.attendance = '',
    this.textQuestion,
    this.previewShown = false,
  });

  Map<String, dynamic> toJson() => {
        'studentId': studentId,
        'classKey': classKey,
        'category': category,
        'tier': tier,
        'observationDate': observationDate,
        'observationTime': observationTime,
        'incident': incident,
        'location': location,
        'notes': notes,
        'classPerf': classPerf,
        'attendance': attendance,
        'textQuestion': textQuestion?.name,
        'previewShown': previewShown,
      };

  factory FlowSnapshot.fromJson(Map<String, dynamic> j) => FlowSnapshot(
        studentId: j['studentId']?.toString() ?? '',
        classKey: j['classKey']?.toString() ?? '',
        category: j['category']?.toString(),
        tier: j['tier']?.toString(),
        observationDate: j['observationDate']?.toString(),
        observationTime: j['observationTime']?.toString() ?? '',
        incident: j['incident']?.toString() ?? '',
        location: j['location']?.toString() ?? '',
        notes: j['notes']?.toString() ?? '',
        classPerf: j['classPerf']?.toString() ?? '',
        attendance: j['attendance']?.toString() ?? '',
        textQuestion: j['textQuestion'] == null ? null : TextQuestion.values.byName(j['textQuestion'].toString()),
        previewShown: (j['previewShown'] ?? false) as bool,
      );
}
