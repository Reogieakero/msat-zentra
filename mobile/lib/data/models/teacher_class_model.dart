class TeacherClassModel {
  final String id;
  final String sectionId;
  final String sectionName;
  final String gradeLevel;
  final String subjectName;
  final String subjectCode;
  final String scheduleTime;
  final String room;
  final int studentCount;
  final bool isAdviser;
  final bool isAttendanceMarkedToday;
  final bool isGradesLocked;

  const TeacherClassModel({
    required this.id,
    required this.sectionId,
    required this.sectionName,
    required this.gradeLevel,
    required this.subjectName,
    required this.subjectCode,
    required this.scheduleTime,
    required this.room,
    required this.studentCount,
    this.isAdviser = false,
    this.isAttendanceMarkedToday = false,
    this.isGradesLocked = false,
  });
}
