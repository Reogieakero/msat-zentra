enum AttendanceStatus { present, absent, late, excused }

enum Session { AM, PM }

class AttendanceRecordModel {
  final String id;
  final String studentId;
  final String studentName;
  final String sectionId;
  final DateTime date;
  final Session session;
  final AttendanceStatus status;

  const AttendanceRecordModel({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.sectionId,
    required this.date,
    required this.session,
    required this.status,
  });

  AttendanceRecordModel copyWith({
    AttendanceStatus? status,
  }) {
    return AttendanceRecordModel(
      id: id,
      studentId: studentId,
      studentName: studentName,
      sectionId: sectionId,
      date: date,
      session: session,
      status: status ?? this.status,
    );
  }
}
