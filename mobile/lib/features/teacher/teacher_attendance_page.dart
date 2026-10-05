// Subject-teacher attendance — same POST /api/attendance/bulk but scoped to
// the teacher's own subject assignments. Only past events editable client-side
// (future disabled); backend enforces same-week grace + ownership.

import 'package:flutter/material.dart';

import '../adviser/adviser_attendance_page.dart';

class TeacherAttendancePage extends StatelessWidget {
  const TeacherAttendancePage({super.key});
  @override
  Widget build(BuildContext context) {
    // Reuses the adviser per-subject workspace: subject list comes from
    // GET /api/attendance/subjects and ownership is enforced server-side
    // (TeacherSubjectAssignment / SectionTimetableEntry).
    return const AdviserAttendancePage();
  }
}
