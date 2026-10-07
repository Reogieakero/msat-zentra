// Zentra mobile — auth + term session stores (Riverpod).
// Mirrors frontend TermContext + useSession: login -> pick SY/term -> gate.

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'api_client.dart';
import 'config.dart';
import '../shared/models.dart';

class AuthState {
  final bool loading;
  final String? role; // adviser | subject_teacher
  final String? error;
  final bool loggedIn;
  const AuthState({this.loading = false, this.role, this.error, this.loggedIn = false});
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(apiClientProvider));
});

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient api;
  AuthNotifier(this.api) : super(const AuthState()) {
    _restore();
  }

  Future<void> _restore() async {
    final token = await api.accessToken();
    if (token == null) return;
    // Role is re-hydrated lazily via overview; keep session alive.
    state = const AuthState(loggedIn: true);
  }

  Future<bool> login({required String email, required String password}) async {
    state = const AuthState(loading: true);
    try {
      // Backend expects role:'staff' for both adviser + subject_teacher and
      // returns the concrete role. 403 ROLE_MISMATCH if wrong portal.
      final res = await api.dio.post('/api/auth/login', data: {
        'email': email,
        'password': password,
        'role': 'staff',
      });
      await api.saveSession(
        access: res.data['accessToken'] as String,
        refresh: res.data['refreshToken'] as String,
      );
      final role = res.data['role']?.toString();
      state = AuthState(loggedIn: true, role: role);
      return true;
    } on DioException catch (e) {
      try {
        api.throwApi(e);
      } on ApiException catch (ae) {
        state = AuthState(error: ae.message);
      }
      return false;
    }
  }

  Future<void> logout() async {
    await api.logout();
    state = const AuthState();
  }

  void setRole(String role) => state = AuthState(loggedIn: true, role: role);
}

// --- Term scope: persisted in Hive, sent as headers by ApiClient ---

final termProvider = StateNotifierProvider<TermNotifier, Term?>((ref) => TermNotifier());

class TermNotifier extends StateNotifier<Term?> {
  TermNotifier() : super(null) {
    final box = Hive.box(AppConfig.termScopeBox);
    final cached = box.get('scope');
    if (cached is Map) {
      state = Term.fromCache(Map<String, dynamic>.from(cached));
    }
  }

  Future<void> select(Term t) async {
    final box = Hive.box(AppConfig.termScopeBox);
    await box.put('schoolYearId', t.schoolYearId);
    await box.put('termId', t.id);
    await box.put('scope', t.toJson());
    state = t;
  }

  Future<void> clear() async {
    await Hive.box(AppConfig.termScopeBox).clear();
    state = null;
  }
}

final schoolYearsProvider = FutureProvider<List<SchoolYear>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/academics/school-years');
    final list = (res.data['schoolYears'] ?? res.data['school_years'] ?? []) as List;
    return [for (final s in list) SchoolYear.fromJson(s as Map<String, dynamic>)];
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

// Secondary overview: assessments + standings for the Gradebook dashboard.
// GET /api/teacher/overview?scope=secondary — mirrors web
// useTeacherOverviewSecondary (teacher/grading/page.tsx).
final overviewSecondaryProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final term = ref.watch(termProvider);
  if (term == null) throw ApiException('NO_TERM', 'Select a school year and term first.');
  try {
    final res = await api.dio.get('/api/teacher/overview', queryParameters: {'scope': 'secondary'});
    return Map<String, dynamic>.from(res.data as Map);
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

// Overview decides Adviser vs Subject Teacher home + first-time gates.
// GET /api/teacher/overview?scope=critical (light) — see teacher.routes.ts.
final overviewProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final term = ref.watch(termProvider);
  if (term == null) throw ApiException('NO_TERM', 'Select a school year and term first.');
  try {
    final res = await api.dio.get('/api/teacher/overview', queryParameters: {'scope': 'critical'});
    final data = Map<String, dynamic>.from(res.data as Map);
    final role = data['isAdviser'] == true ? 'adviser' : 'subject_teacher';
    ref.read(authProvider.notifier).setRole(role);
    return data;
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});
