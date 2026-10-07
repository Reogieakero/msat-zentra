// Teacher settings data — web parity with
// frontend/src/app/teacher/settings (ProfileCard, AdviserCard,
// Master Teacher toggle, PaletteCard, PasswordCard) and
// backend teacher.routes.ts /api/teacher/settings/*.
// Endpoints: GET+PATCH profile, POST photo, PATCH master-teacher,
// GET adviser-sections, POST/DELETE advisory/claim, POST change-password.

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/session.dart';
import '../adviser/advisory_list_page.dart' show advisoryProvider, archivedAdvisoryProvider;

class TeacherProfile {
  final String fullName;
  final String? photoUrl;
  final String? primaryColor;
  final String? secondaryColor;
  const TeacherProfile({required this.fullName, this.photoUrl, this.primaryColor, this.secondaryColor});
  factory TeacherProfile.fromJson(Map<String, dynamic> j) => TeacherProfile(
        fullName: j['fullName']?.toString() ?? '',
        photoUrl: j['photoUrl']?.toString(),
        primaryColor: j['primaryColor']?.toString(),
        secondaryColor: j['secondaryColor']?.toString(),
      );
}

final teacherProfileProvider = FutureProvider<TeacherProfile>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/teacher/settings/profile');
    return TeacherProfile.fromJson(Map<String, dynamic>.from(res.data as Map));
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

class AdviserSectionOption {
  final String id;
  final String name;
  final int gradeNumber;
  final String adviserLabel;
  final bool claimable;
  final bool advisedByMe;
  final String? holderName;
  final bool inMasterSchedule;
  const AdviserSectionOption({
    required this.id,
    required this.name,
    required this.gradeNumber,
    required this.adviserLabel,
    required this.claimable,
    required this.advisedByMe,
    this.holderName,
    required this.inMasterSchedule,
  });
  factory AdviserSectionOption.fromJson(Map<String, dynamic> j) => AdviserSectionOption(
        id: j['id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        gradeNumber: (j['gradeNumber'] ?? 0) as int,
        adviserLabel: j['adviserLabel']?.toString() ?? '',
        claimable: (j['claimable'] ?? false) as bool,
        advisedByMe: (j['advisedByMe'] ?? false) as bool,
        holderName: j['holderName']?.toString(),
        inMasterSchedule: (j['inMasterSchedule'] ?? false) as bool,
      );
}

final adviserSectionsProvider = FutureProvider<List<AdviserSectionOption>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/teacher/settings/adviser-sections');
    final data = Map<String, dynamic>.from(res.data as Map);
    final list = [for (final s in (data['sections'] as List? ?? [])) AdviserSectionOption.fromJson(s as Map<String, dynamic>)];
    list.sort((a, b) {
      var c = (b.inMasterSchedule ? 1 : 0).compareTo(a.inMasterSchedule ? 1 : 0);
      if (c != 0) return c;
      c = (b.claimable ? 1 : 0).compareTo(a.claimable ? 1 : 0);
      if (c != 0) return c;
      c = a.gradeNumber.compareTo(b.gradeNumber);
      if (c != 0) return c;
      return a.name.compareTo(b.name);
    });
    return list;
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

void _refreshSettings(WidgetRef ref) {
  ref.invalidate(teacherProfileProvider);
  ref.invalidate(overviewProvider);
  ref.invalidate(adviserSectionsProvider);
  ref.invalidate(advisoryProvider);
  ref.invalidate(archivedAdvisoryProvider);
}

String settingsError(DioException e, String fallback) {
  final d = e.response?.data;
  if (d is Map && d['error'] is Map) return d['error']['message']?.toString() ?? fallback;
  return fallback;
}

Future<void> patchTeacherProfile(WidgetRef ref, Map<String, dynamic> body) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.patch('/api/teacher/settings/profile', data: body);
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshSettings(ref);
}

Future<void> uploadTeacherPhoto(WidgetRef ref, String dataUrl) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.post('/api/teacher/settings/photo', data: {'photoUrl': dataUrl});
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshSettings(ref);
}

Future<void> setMasterTeacher(WidgetRef ref, bool value) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.patch('/api/teacher/settings/master-teacher', data: {'isMasterTeacher': value});
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshSettings(ref);
}

Future<void> claimAdvisorySection(WidgetRef ref, String sectionId) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.post('/api/teacher/advisory/claim', data: {'sectionId': sectionId});
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshSettings(ref);
}

Future<void> releaseAdvisorySection(WidgetRef ref, String? sectionId) async {
  final api = ref.read(apiClientProvider);
  try {
    if (sectionId != null) {
      await api.dio.delete('/api/teacher/advisory/claim?sectionId=${Uri.encodeComponent(sectionId)}', data: {'sectionId': sectionId});
    } else {
      await api.dio.delete('/api/teacher/advisory/claim');
    }
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshSettings(ref);
}

Future<void> changePassword(WidgetRef ref, {required String currentPassword, required String newPassword}) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.post('/api/auth/change-password', data: {'currentPassword': currentPassword, 'newPassword': newPassword});
  } on DioException catch (e) {
    api.throwApi(e);
  }
}
