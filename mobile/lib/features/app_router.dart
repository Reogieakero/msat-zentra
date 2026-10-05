// GoRouter — Login -> Term -> Gate -> role home.
// Guards mirror web useRoleGuard: no token -> /login, no term -> /term.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../core/api_client.dart';
import '../core/config.dart';
import 'auth/first_time_gate.dart';
import 'auth/login_page.dart';
import 'auth/term_select_page.dart';
import 'home/role_home.dart';

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
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, _) => const LoginPage()),
      GoRoute(path: '/term', builder: (context, _) => const TermSelectPage()),
      GoRoute(path: '/gate', builder: (context, _) => const FirstTimeGate()),
      GoRoute(path: '/adviser', builder: (context, _) => const AdviserHome()),
      GoRoute(path: '/teacher', builder: (context, _) => const TeacherHome()),
    ],
    errorBuilder: (context, _) => const Scaffold(body: Center(child: Text('Page not found'))),
  );
});
