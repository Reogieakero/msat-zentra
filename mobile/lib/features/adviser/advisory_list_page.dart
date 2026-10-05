// Advisory list — GET /api/teacher/advisory/students (or overview student-list).
// Shows Name, LRN, Risk badge, Factor chips, attendance %, academic grade.
// Tapping opens StudentDetailPage (grades + attendance + anecdotal count).

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/sync_outbox.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';
import 'student_detail_page.dart';

final advisoryProvider = FutureProvider<List<AdvisoryStudent>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    // Primary: dedicated advisory roster; fallback: overview student-list advisory mode.
    try {
      final res = await api.dio.get('/api/teacher/advisory/students');
      final students = (res.data['students'] as List? ?? []);
      if (students.isNotEmpty) return [for (final s in students) AdvisoryStudent.fromJson(s as Map<String, dynamic>)];
    } catch (_) {
      // fall through to overview-based roster
    }
    final res = await api.dio.get('/api/teacher/overview/student-list');
    final students = (res.data['students'] as List? ?? []);
    return [for (final s in students) AdvisoryStudent.fromJson(s as Map<String, dynamic>)];
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

class AdvisoryListPage extends ConsumerStatefulWidget {
  const AdvisoryListPage({super.key});
  @override
  ConsumerState<AdvisoryListPage> createState() => _State();
}

class _State extends ConsumerState<AdvisoryListPage> {
  String _q = '';
  @override
  Widget build(BuildContext context) {
    final list = ref.watch(advisoryProvider);
    final pending = ref.watch(outboxProvider).pendingCount;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          Expanded(
            child: TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search name or LRN'),
              onChanged: (v) => setState(() => _q = v.trim().toLowerCase()),
            ),
          ),
          const SizedBox(width: 8),
          PendingChip(count: pending),
        ]),
      ),
      Expanded(
        child: list.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(advisoryProvider)),
          data: (students) {
            final shown = students.where((s) => _q.isEmpty || s.name.toLowerCase().contains(_q) || s.lrn.contains(_q)).toList();
            if (shown.isEmpty) return const Center(child: Text('No students found.'));
            return RefreshIndicator(
              onRefresh: () async => ref.invalidate(advisoryProvider),
              child: ListView.builder(
                itemCount: shown.length,
                itemBuilder: (_, i) {
                  final s = shown[i];
                  return Card(
                    child: ListTile(
                      title: Text(s.name),
                      subtitle: Text('LRN ${s.lrn} · Att ${s.attendancePercentage?.toStringAsFixed(1) ?? '—'}% · Avg ${s.academicGrade?.toStringAsFixed(1) ?? '—'}'),
                      trailing: RiskBadge(level: s.riskLevel),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => StudentDetailPage(student: s))),
                    ),
                  );
                },
              ),
            );
          },
        ),
      ),
    ]);
  }
}
