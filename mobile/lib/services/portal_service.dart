// Student/parent portal queries (backend/src/modules/{student,parent}/portal.routes.ts).
// Non-staff roles may browse historical terms, so every term-scoped call sends
// an explicit `?termId=`; null means "whatever the server considers active".

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../shared/models.dart';

final portalTermIdProvider = StateProvider.autoDispose<String?>((ref) => null);
final portalModulePageProvider = StateProvider.autoDispose<int>((ref) => 1);

Map<String, dynamic> _termQuery(Ref ref) {
  final id = ref.watch(portalTermIdProvider);
  return id == null ? const {} : {'termId': id};
}

Future<Map<String, dynamic>> _get(Ref ref, String path, {Map<String, dynamic>? query}) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get(path, queryParameters: query);
    return Map<String, dynamic>.from(res.data as Map);
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
}

// ---- Student -------------------------------------------------------------

final studentMeProvider = FutureProvider.autoDispose<PortalLearner>((ref) async {
  final data = await _get(ref, '/api/student/me', query: _termQuery(ref));
  return PortalLearner.fromJson(Map<String, dynamic>.from(data['learner'] as Map));
});

final studentTermsProvider = FutureProvider.autoDispose<List<PortalTerm>>((ref) async {
  final data = await _get(ref, '/api/student/terms');
  return [for (final t in (data['terms'] as List? ?? [])) PortalTerm.fromJson(Map<String, dynamic>.from(t as Map))];
});

final studentHomeProvider = FutureProvider.autoDispose<PortalHome>((ref) async {
  return PortalHome.fromJson(await _get(ref, '/api/student/home', query: _termQuery(ref)));
});

final studentGradesProvider = FutureProvider.autoDispose<PortalGrades>((ref) async {
  return PortalGrades.fromJson(await _get(ref, '/api/student/grades', query: _termQuery(ref)));
});

final studentAttendanceProvider = FutureProvider.autoDispose<PortalAttendance>((ref) async {
  return PortalAttendance.fromJson(await _get(ref, '/api/student/attendance', query: _termQuery(ref)));
});

final studentScheduleProvider = FutureProvider.autoDispose<PortalSchedule>((ref) async {
  return PortalSchedule.fromJson(await _get(ref, '/api/student/schedule', query: _termQuery(ref)));
});

final studentSessionsProvider = FutureProvider.autoDispose<List<PortalSession>>((ref) async {
  final data = await _get(ref, '/api/student/sessions');
  return [for (final s in (data['sessions'] as List? ?? [])) PortalSession.fromJson(Map<String, dynamic>.from(s as Map))];
});

final studentModulesProvider = FutureProvider.autoDispose<PortalModules>((ref) async {
  final page = ref.watch(portalModulePageProvider);
  return PortalModules.fromJson(await _get(ref, '/api/student/modules', query: {'page': page, 'pageSize': 15}));
});

// ---- Parent --------------------------------------------------------------

final parentChildrenProvider = FutureProvider.autoDispose<List<PortalChild>>((ref) async {
  final data = await _get(ref, '/api/parent/children');
  return [for (final c in (data['children'] as List? ?? [])) PortalChild.fromJson(Map<String, dynamic>.from(c as Map))];
});

final selectedChildProvider = StateProvider.autoDispose<String?>((ref) => null);

final parentHomeProvider = FutureProvider.autoDispose.family<PortalHome, String>((ref, childId) async {
  return PortalHome.fromJson(await _get(ref, '/api/parent/children/$childId/home', query: _termQuery(ref)));
});

final parentGradesProvider = FutureProvider.autoDispose.family<PortalGrades, String>((ref, childId) async {
  return PortalGrades.fromJson(await _get(ref, '/api/parent/children/$childId/grades', query: _termQuery(ref)));
});

final parentAttendanceProvider = FutureProvider.autoDispose.family<PortalAttendance, String>((ref, childId) async {
  return PortalAttendance.fromJson(await _get(ref, '/api/parent/children/$childId/attendance', query: _termQuery(ref)));
});

final parentScheduleProvider = FutureProvider.autoDispose.family<PortalSchedule, String>((ref, childId) async {
  return PortalSchedule.fromJson(await _get(ref, '/api/parent/children/$childId/schedule', query: _termQuery(ref)));
});

final parentSessionsProvider = FutureProvider.autoDispose.family<List<PortalSession>, String>((ref, childId) async {
  final data = await _get(ref, '/api/parent/children/$childId/sessions');
  return [for (final s in (data['sessions'] as List? ?? [])) PortalSession.fromJson(Map<String, dynamic>.from(s as Map))];
});

final parentModulesProvider = FutureProvider.autoDispose.family<PortalModules, String>((ref, childId) async {
  final page = ref.watch(portalModulePageProvider);
  return PortalModules.fromJson(await _get(ref, '/api/parent/children/$childId/modules', query: {'page': page, 'pageSize': 15}));
});

final parentTermsProvider = FutureProvider.autoDispose.family<List<PortalTerm>, String>((ref, childId) async {
  final data = await _get(ref, '/api/parent/children/$childId/terms');
  return [for (final t in (data['terms'] as List? ?? [])) PortalTerm.fromJson(Map<String, dynamic>.from(t as Map))];
});
