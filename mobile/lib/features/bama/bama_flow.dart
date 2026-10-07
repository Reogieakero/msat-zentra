// Bama flow constants — direct Dart port of
// frontend/src/app/teacher/chat/components/bama-flow.ts +
// anecdotal-data.ts label maps.
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

const textQuestionPlaceholders = {
  TextQuestion.incident: 'Describe the incident factually…',
  TextQuestion.location: 'e.g. Classroom, playground, gate…',
  TextQuestion.notes: 'Next steps, monitoring, referrals…',
  TextQuestion.classPerformance: 'e.g. Below expectations in Math…',
  TextQuestion.attendance: 'e.g. 5 absences in the last 2 weeks…',
};

const nextQuestion = {
  TextQuestion.incident: TextQuestion.location,
  TextQuestion.location: TextQuestion.notes,
  TextQuestion.notes: TextQuestion.classPerformance,
  TextQuestion.classPerformance: TextQuestion.attendance,
  TextQuestion.attendance: null,
};

const anecdotalCategories = ['behavioral', 'bullying', 'academic', 'attendance', 'health'];

const anecdotalCategoryLabels = {
  'behavioral': 'Behavioral',
  'bullying': 'Bullying',
  'academic': 'Academic',
  'attendance': 'Attendance',
  'health': 'Health',
};

const anecdotalTiers = ['restricted', 'confidential'];

const anecdotalTierLabels = {
  'restricted': 'Restricted',
  'confidential': 'Confidential',
};

String filingStageFor(int progress) {
  if (progress < 30) return 'Validating answers…';
  if (progress < 65) return 'Filing anecdotal record…';
  if (progress < 97) return 'Autofilling GCForm-01…';
  return 'Finishing…';
}

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
  bool askedCategory;
  bool askedTier;
  bool askedDatetime;
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
    this.askedCategory = false,
    this.askedTier = false,
    this.askedDatetime = false,
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
        'askedCategory': askedCategory,
        'askedTier': askedTier,
        'askedDatetime': askedDatetime,
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
        askedCategory: (j['askedCategory'] ?? false) as bool,
        askedTier: (j['askedTier'] ?? false) as bool,
        askedDatetime: (j['askedDatetime'] ?? false) as bool,
        previewShown: (j['previewShown'] ?? false) as bool,
      );
}

/// Reset [f] back to [step] (student|class|category|tier|datetime), clearing
/// that step and everything after it (including typed texts, which are
/// student-specific). Pure so it stays unit-tested without widgets.
void resetFlowTo(FlowSnapshot f, String step) {
  const order = ['student', 'class', 'category', 'tier', 'datetime'];
  final at = order.indexOf(step);
  if (at < 0) return;
  if (at <= 0) f.studentId = '';
  if (at <= 1) f.classKey = '';
  if (at <= 2) f.category = null;
  if (at <= 3) f.tier = null;
  if (at <= 4) {
    f.observationDate = null;
    f.observationTime = '';
  }
  f.incident = '';
  f.location = '';
  f.notes = '';
  f.classPerf = '';
  f.attendance = '';
  f.textQuestion = null;
  f.previewShown = false;
  f.askedCategory = at >= 2;
  f.askedTier = at >= 3;
  f.askedDatetime = at >= 4;
}
