// Student portal screens — all read-only, self-scoped via /api/student/*.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/portal_shell.dart';
import '../../services/portal_service.dart';
import '../portal/portal_views.dart';

class StudentHomePage extends ConsumerWidget {
  const StudentHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PortalShell(
      portal: 'student',
      selectedPath: '/student/home',
      child: PortalAsync(
        value: ref.watch(studentHomeProvider),
        builder: (data) => PortalHomeBody(home: data, portal: 'student'),
      ),
    );
  }
}

class StudentGradesPage extends ConsumerWidget {
  const StudentGradesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PortalShell(
      portal: 'student',
      selectedPath: '/student/grades',
      child: PortalAsync(
        value: ref.watch(studentGradesProvider),
        builder: (data) => PortalGradesBody(data: data),
      ),
    );
  }
}

class StudentAttendancePage extends ConsumerWidget {
  const StudentAttendancePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PortalShell(
      portal: 'student',
      selectedPath: '/student/attendance',
      child: PortalAsync(
        value: ref.watch(studentAttendanceProvider),
        builder: (data) => PortalAttendanceBody(data: data),
      ),
    );
  }
}

class StudentSchedulePage extends ConsumerWidget {
  const StudentSchedulePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PortalShell(
      portal: 'student',
      selectedPath: '/student/schedule',
      child: PortalAsync(
        value: ref.watch(studentScheduleProvider),
        builder: (data) => PortalScheduleBody(data: data),
      ),
    );
  }
}

class StudentModulesPage extends ConsumerWidget {
  const StudentModulesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PortalShell(
      portal: 'student',
      selectedPath: '/student/modules',
      child: PortalAsync(
        value: ref.watch(studentModulesProvider),
        builder: (data) => PortalModulesBody(data: data, canSubmit: true),
      ),
    );
  }
}

class StudentSessionsPage extends ConsumerWidget {
  const StudentSessionsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PortalShell(
      portal: 'student',
      selectedPath: '/student/sessions',
      child: PortalAsync(
        value: ref.watch(studentSessionsProvider),
        builder: (data) => PortalSessionsBody(sessions: data),
      ),
    );
  }
}
