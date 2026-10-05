// Advisory list — web-matched rows: name 13px/600 + LRN tabular + risk pill +
// factor dots + Att% + Avg. Filter chips mirror RiskTable.

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
    try {
      final res = await api.dio.get('/api/teacher/advisory/students');
      final students = (res.data['students'] as List? ?? []);
      if (students.isNotEmpty) return [for (final s in students) AdvisoryStudent.fromJson(s as Map<String, dynamic>)];
    } catch (_) {}
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
  String _filter = 'All';
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final list = ref.watch(advisoryProvider);
    final pending = ref.watch(outboxProvider).pendingCount;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Row(children: [
          Expanded(child: ZSearchField(hint: 'Search name or LRN', onChanged: (v) => setState(() => _q = v.trim().toLowerCase()))),
          const SizedBox(width: 8),
          PendingChip(count: pending),
        ]),
      ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          for (final f in ['All', 'High', 'academic', 'attendance', 'behavioral'])
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: ChoiceChip(label: Text(f, style: const TextStyle(fontSize: 12)), selected: _filter == f, onSelected: (_) => setState(() => _filter = f), visualDensity: VisualDensity.compact),
            ),
        ]),
      ),
      const SizedBox(height: 8),
      Expanded(
        child: list.when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList()),
          error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(advisoryProvider)),
          data: (students) {
            final shown = students.where((s) {
              final mq = _q.isEmpty || s.name.toLowerCase().contains(_q) || s.lrn.contains(_q);
              final mf = _filter == 'All' || s.riskLevel == _filter || s.flags.contains(_filter);
              return mq && mf;
            }).toList();
            if (shown.isEmpty) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: ZEmpty(icon: Icons.shield_outlined, title: 'No students match', subtitle: 'Try a different search or filter. Zero-risk sections show here too.'),
              );
            }
            return RefreshIndicator(
              onRefresh: () async => ref.invalidate(advisoryProvider),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                itemCount: shown.length,
                separatorBuilder: (context, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final s = shown[i];
                  return ZCard(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (context) => StudentDetailPage(student: s))),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(s.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 2),
                          Text('LRN ${s.lrn}',
                              style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()], color: theme.colorScheme.onSurfaceVariant)),
                          const SizedBox(height: 4),
                          Row(children: [
                            Text('Att ${s.attendancePercentage?.toStringAsFixed(1) ?? '—'}%',
                                style: const TextStyle(fontSize: 12, fontFeatures: [FontFeature.tabularFigures()])),
                            const Text(' · ', style: TextStyle(fontSize: 12)),
                            Text('Avg ${s.academicGrade?.toStringAsFixed(1) ?? '—'}',
                                style: const TextStyle(fontSize: 12, fontFeatures: [FontFeature.tabularFigures()])),
                            if (s.flags.isNotEmpty) ...[
                              const SizedBox(width: 6),
                              for (final f in s.flags) Padding(padding: const EdgeInsets.only(right: 4), child: FlagChip(flag: f)),
                            ],
                          ]),
                        ]),
                      ),
                      RiskBadge(level: s.riskLevel),
                    ]),
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
