// GoRouter — Login -> Term -> Gate -> drawer-routed workspace (no bottom nav).
// Drawer taps use context.go (replace): back exits. Detail/gradebook use push.
// Guards mirror web useRoleGuard: no token -> /login, no term -> /term,
// non-adviser -> /teacher/classes for /adviser/* (role from authProvider cache).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../core/api_client.dart';
import '../core/config.dart';
import '../shared/models.dart';
import 'adviser/adviser_attendance_page.dart';
import 'adviser/advisory_list_page.dart';
import 'adviser/adviser_schedule_page.dart';
import 'adviser/student_detail_page.dart';
import 'auth/first_time_gate.dart';
import 'auth/login_page.dart';
import 'auth/term_select_page.dart';
import 'bama/bama_chat_page.dart';
import 'home/role_home.dart';
import 'referral/referral_page.dart';
import 'teacher/gradebook_page.dart';
import 'teacher/teacher_attendance_page.dart';
import 'teacher/classes_page.dart';
import '../core/session.dart' show authProvider;

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) async {
      final box = Hive.box(AppConfig.termScopeBox);
      final hasTerm = box.get('termId') != null;
      final container = ProviderScope.containerOf(context);
      final token = await container.read(apiClientProvider).accessToken();
      final loc = state.matchedLocation;
      if (token == null && loc != '/login') return '/login';
      if (token != null && loc == '/login') return hasTerm ? '/gate' : '/term';
      if (token != null && !hasTerm && loc != '/term') return '/term';
      // Role gate for adviser routes (cached role set by overviewProvider).
      final role = container.read(authProvider).role;
      if (loc.startsWith('/adviser/') && role == 'subject_teacher') return '/teacher/classes';
      // Root redirects to defaults.
      if (loc == '/adviser') return '/adviser/advisory';
      if (loc == '/teacher') return '/teacher/classes';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, _) => const LoginPage()),
      GoRoute(path: '/term', builder: (context, _) => const TermSelectPage()),
      GoRoute(path: '/gate', builder: (context, _) => const FirstTimeGate()),
      // Adviser section (drawer replace-targets)
      GoRoute(path: '/adviser/advisory', builder: (context, _) => const AdviserShell(selected: AdviserRoute.advisory, child: AdvisoryListPage())),
      GoRoute(path: '/adviser/attendance', builder: (context, _) => const AdviserShell(selected: AdviserRoute.attendance, child: AdviserAttendancePage())),
      GoRoute(path: '/adviser/schedule', builder: (context, _) => const AdviserShell(selected: AdviserRoute.schedule, child: AdviserSchedulePage())),
      GoRoute(path: '/adviser/bama', builder: (context, _) => const AdviserShell(selected: AdviserRoute.bama, child: BamaChatPage())),
      GoRoute(path: '/adviser/referrals', builder: (context, _) => const AdviserShell(selected: AdviserRoute.referrals, child: ReferralPage())),
      GoRoute(
        path: '/adviser/students/:id',
        builder: (context, state) {
          final extra = state.extra;
          // Pushed from AdvisoryListPage with the full object; fallback to
          // deep-link stub (detail fetches live data itself).
          if (extra is AdvisoryStudent) return AdviserShell(selected: AdviserRoute.advisory, child: StudentDetailPage(student: extra));
          final id = state.pathParameters['id'] ?? '';
          return AdviserShell(
            selected: AdviserRoute.advisory,
            child: StudentDetailPage(
              student: AdvisoryStudent(studentId: Uri.decodeComponent(id), name: 'Student', lrn: '—', hasAccount: true),
            ),
          );
        },
      ),
      // Teacher section
      GoRoute(path: '/teacher/classes', builder: (context, _) => const TeacherShell(selected: TeacherRoute.classes, child: ClassesPage())),
      GoRoute(path: '/teacher/attendance', builder: (context, _) => const TeacherShell(selected: TeacherRoute.attendance, child: TeacherAttendancePage())),
      GoRoute(path: '/teacher/more', builder: (context, _) => const TeacherShell(selected: TeacherRoute.more, child: TeacherMorePage())),
      GoRoute(
        path: '/teacher/gradebook/:id',
        builder: (context, state) {
          final id = Uri.decodeComponent(state.pathParameters['id'] ?? '');
          final title = state.uri.queryParameters['title'] ?? 'Gradebook';
          return TeacherShell(selected: TeacherRoute.classes, child: GradebookPage(classId: id, title: title));
        },
      ),
    ],
    errorBuilder: (context, _) => const Scaffold(body: Center(child: Text('Page not found'))),
  );
});
