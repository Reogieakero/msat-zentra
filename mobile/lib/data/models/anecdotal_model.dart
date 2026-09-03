enum AnecdotalCategory { behavioral, bullying, academic, attendance, health }

enum ReferralTarget { nurse, guidance_counselor, adm_coordinator, principal }

enum ReferralStatus { pending, in_progress, resolved }

class AnecdotalRecordModel {
  final String id;
  final String studentId;
  final String studentName;
  final String observerName;
  final String sectionName;
  final AnecdotalCategory category;
  final String incidentDescription;
  final DateTime observationDatetime;

  const AnecdotalRecordModel({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.observerName,
    required this.sectionName,
    required this.category,
    required this.incidentDescription,
    required this.observationDatetime,
  });
}
