// GoRouter — Login -> Term -> Gate -> drawer-routed workspace (no bottom nav).
// Drawer taps use context.go (replace): back exits. Detail/gradebook use push.
// Menu: Advisory (adviser-only) + shared Workspace Class/Attendance (both
// roles, same web data). Gradebook detail is push-only under /workspace/classes.
// Deprecated /workspace/gradebook*, /teacher/* + /adviser/attendance redirect.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../core/api_client.dart';
import '../core/config.dart';
import '../shared/models.dart';
import 'adviser/academic_overview_page.dart';
import 'adviser/adm_cases_page.dart';
import 'adviser/advisory_list_page.dart';
import 'adviser/adviser_schedule_page.dart';
import 'adviser/student_detail_page.dart';
import 'auth/first_time_gate.dart';
import 'auth/login_page.dart';
import 'auth/term_select_page.dart';
import 'bama/bama_chat_page.dart';
import 'home/role_home.dart';
import 'referral/referral_page.dart';
import 'teacher/classes_page.dart';
import 'teacher/gradebook_page.dart';
import 'workspace/workspace_attendance_page.dart';
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
      if (loc.startsWith('/adviser/') && role == 'subject_teacher') return '/workspace/classes';
      // Root redirects to defaults.
      if (loc == '/adviser') return '/adviser/advisory';
      if (loc == '/teacher') return '/workspace/classes';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, _) => const LoginPage()),
      GoRoute(path: '/term', builder: (context, _) => const TermSelectPage()),
      GoRoute(path: '/gate', builder: (context, _) => const FirstTimeGate()),
      // Adviser section (drawer replace-targets; no Advisory attendance)
      GoRoute(path: '/adviser/advisory', builder: (context, _) => const AdviserShell(selected: AdviserRoute.advisory, child: AdvisoryListPage())),
      GoRoute(path: '/adviser/academic', builder: (context, _) => const AdviserShell(selected: AdviserRoute.academic, child: AcademicOverviewPage())),
      GoRoute(path: '/adviser/adm-cases', builder: (context, _) => const AdviserShell(selected: AdviserRoute.admCases, child: AdmCasesPage())),
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
      // Shared Workspace (both roles, same web data)
      GoRoute(path: '/workspace/classes', builder: (context, _) => const WorkspaceShell(selected: WorkspaceRoute.classes, child: ClassesPage())),
      GoRoute(
        path: '/workspace/classes/:id',
        builder: (context, state) {
          final id = Uri.decodeComponent(state.pathParameters['id'] ?? '');
          final title = state.uri.queryParameters['title'] ?? 'Gradebook';
          return WorkspaceShell(selected: WorkspaceRoute.classes, child: GradebookPage(classId: id, title: title));
        },
      ),
      GoRoute(path: '/workspace/attendance', builder: (context, _) => const WorkspaceShell(selected: WorkspaceRoute.attendance, child: WorkspaceAttendancePage())),
      GoRoute(path: '/teacher/more', builder: (context, _) => const WorkspaceShell(selected: WorkspaceRoute.more, child: TeacherMorePage())),
      // Deprecated aliases (one release): old installs may hold these paths.
      GoRoute(path: '/workspace/gradebook', redirect: (context, _) => '/workspace/classes'),
      GoRoute(
        path: '/workspace/gradebook/:id',
        redirect: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          final title = state.uri.queryParameters['title'];
          return '/workspace/classes/$id${title == null ? '' : '?title=${Uri.encodeComponent(title)}'}';
        },
      ),
      GoRoute(path: '/adviser/attendance', redirect: (context, _) => '/workspace/attendance'),
      GoRoute(path: '/teacher/classes', redirect: (context, _) => '/workspace/classes'),
      GoRoute(path: '/teacher/attendance', redirect: (context, _) => '/workspace/attendance'),
      GoRoute(
        path: '/teacher/gradebook/:id',
        redirect: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          final title = state.uri.queryParameters['title'];
          return '/workspace/classes/$id${title == null ? '' : '?title=${Uri.encodeComponent(title)}'}';
        },
      ),
    ],
    errorBuilder: (context, _) => const Scaffold(body: Center(child: Text('Page not found'))),
  );
});
