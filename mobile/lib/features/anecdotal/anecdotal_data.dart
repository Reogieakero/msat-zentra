// Anecdotal records data — web parity with
// frontend/src/components/ocform01/folders.ts + ocform01.ts.
// Endpoints (backend anecdotal.routes.ts, owner/referred scoped):
// folders CRUD, mine, :id/folder move, :id/detail, :id/followups,
// signature GET/PUT, :id/sign|apply-signature, DELETE :id/sign,
// :id/export (.xlsx bytes).

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';

// Folder body color per anecdotal category — web parity with
// frontend/src/app/teacher/anecdotal/components/AnecdotalSideRail.tsx
// CATEGORY_COLORS (mirrored by the folder grid, Bama cards, guidance/nurse).
const anecdotalCategoryColors = {
  'behavioral': Color(0xFFF59E0B),
  'bullying': Color(0xFFEF4444),
  'academic': Color(0xFF3B82F6),
  'attendance': Color(0xFF22C55E),
  'health': Color(0xFF8B5CF6),
};

const anecdotalCategoryLabels = {
  'behavioral': 'Behavioral',
  'bullying': 'Bullying',
  'academic': 'Academic',
  'attendance': 'Attendance',
  'health': 'Health',
};

/// Web-identical lookup (case-insensitive); unknown categories fall back to
/// neutral gray like the folder SVG default.
Color anecdotalCategoryColor(String? category) =>
    anecdotalCategoryColors[category?.trim().toLowerCase()] ?? const Color(0xFF8A8A8A);

String anecdotalCategoryLabel(String? category) {
  final key = category?.trim().toLowerCase();
  if (key != null && anecdotalCategoryLabels.containsKey(key)) return anecdotalCategoryLabels[key]!;
  if (key == null || key.isEmpty) return '—';
  return key.split('_').map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');
}

class AnecdotalFolder {
  final String id;
  final String name;
  const AnecdotalFolder({required this.id, required this.name});
  factory AnecdotalFolder.fromJson(Map<String, dynamic> j) =>
      AnecdotalFolder(id: j['id']?.toString() ?? '', name: j['name']?.toString() ?? '');
}

class MyAnecdotalRecord {
  final String id;
  final String studentId;
  final String studentName;
  final String lrn;
  final String section;
  final String observationDatetime;
  final String category;
  final String confidentialityLevel;
  final String? folderId;
  final String? folderName;
  const MyAnecdotalRecord({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.lrn,
    required this.section,
    required this.observationDatetime,
    required this.category,
    required this.confidentialityLevel,
    this.folderId,
    this.folderName,
  });
  factory MyAnecdotalRecord.fromJson(Map<String, dynamic> j) => MyAnecdotalRecord(
        id: j['id']?.toString() ?? '',
        studentId: j['studentId']?.toString() ?? '',
        studentName: j['studentName']?.toString() ?? '',
        lrn: j['lrn']?.toString() ?? '',
        section: j['section']?.toString() ?? '',
        observationDatetime: j['observationDatetime']?.toString() ?? j['observationDate']?.toString() ?? '',
        category: j['category']?.toString() ?? '',
        confidentialityLevel: j['confidentialityLevel']?.toString() ?? '',
        folderId: j['folderId']?.toString(),
        folderName: j['folderName']?.toString(),
      );
  String get date => observationDatetime.length >= 10 ? observationDatetime.substring(0, 10) : observationDatetime;
}

final anecdotalMineProvider = FutureProvider<List<MyAnecdotalRecord>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/anecdotal/mine');
    final data = res.data;
    final List list = data is List ? data : (data is Map && data['records'] is List ? data['records'] as List : []);
    return [for (final r in list) MyAnecdotalRecord.fromJson(Map<String, dynamic>.from(r as Map))];
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

final anecdotalFoldersProvider = FutureProvider<List<AnecdotalFolder>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/anecdotal/folders');
    final data = res.data;
    final List list = data is List ? data : (data is Map && data['folders'] is List ? data['folders'] as List : []);
    return [for (final f in list) AnecdotalFolder.fromJson(Map<String, dynamic>.from(f as Map))];
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

void _refreshAnecdotal(WidgetRef ref) {
  ref.invalidate(anecdotalMineProvider);
  ref.invalidate(anecdotalFoldersProvider);
}

String anecdotalError(DioException e, String fallback) {
  final d = e.response?.data;
  if (d is Map && d['error'] is Map) return d['error']['message']?.toString() ?? fallback;
  return fallback;
}

Future<Map<String, dynamic>> fetchRecordDetail(WidgetRef ref, String id) async {
  final api = ref.read(apiClientProvider);
  try {
    final res = await api.dio.get('/api/anecdotal/$id/detail');
    return Map<String, dynamic>.from(res.data as Map);
  } on DioException catch (e) {
    api.throwApi(e);
  }
}

Future<void> createAnecdotalFolder(WidgetRef ref, String name) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.post('/api/anecdotal/folders', data: {'name': name.trim()});
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshAnecdotal(ref);
}

Future<void> renameAnecdotalFolder(WidgetRef ref, String id, String name) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.patch('/api/anecdotal/folders/$id', data: {'name': name.trim()});
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshAnecdotal(ref);
}

Future<void> deleteAnecdotalFolder(WidgetRef ref, String id) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.delete('/api/anecdotal/folders/$id');
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshAnecdotal(ref);
}

Future<void> moveAnecdotalRecord(WidgetRef ref, String id, String? folderId) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.patch('/api/anecdotal/$id/folder', data: {'folderId': folderId});
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshAnecdotal(ref);
}

Future<void> addRecordFollowup(WidgetRef ref, String id, String notes) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.post('/api/anecdotal/$id/followups', data: {'notes': notes.trim()});
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshAnecdotal(ref);
}

Future<String?> fetchMySignature(WidgetRef ref) async {
  final api = ref.read(apiClientProvider);
  try {
    final res = await api.dio.get('/api/anecdotal/signature');
    final data = res.data;
    if (data is Map) return (data['imageUrl'] ?? data['signatureImage'])?.toString();
    return null;
  } on DioException catch (e) {
    api.throwApi(e);
  }
}

Future<void> saveMySignature(WidgetRef ref, String dataUrl) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.put('/api/anecdotal/signature', data: {'signatureImage': dataUrl});
  } on DioException catch (e) {
    api.throwApi(e);
  }
}

Future<void> signRecord(WidgetRef ref, String id, String dataUrl) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.post('/api/anecdotal/$id/sign', data: {'signatureImage': dataUrl});
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshAnecdotal(ref);
}

Future<void> applyMySignature(WidgetRef ref, String id) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.post('/api/anecdotal/$id/apply-signature', data: {});
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshAnecdotal(ref);
}

Future<void> removeRecordSignature(WidgetRef ref, String id) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.delete('/api/anecdotal/$id/sign');
  } on DioException catch (e) {
    api.throwApi(e);
  }
  _refreshAnecdotal(ref);
}

Future<List<int>> downloadRecordExport(WidgetRef ref, String id) async {
  final api = ref.read(apiClientProvider);
  try {
    final res = await api.dio.get('/api/anecdotal/$id/export', options: Options(responseType: ResponseType.bytes));
    final data = res.data;
    if (data is List<int>) return data;
    return List<int>.from(data as List);
  } on DioException catch (e) {
    api.throwApi(e);
  }
}
