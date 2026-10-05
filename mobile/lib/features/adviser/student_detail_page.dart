// Student detail — web drawer parity: risk + LRN tabular + grades + referrals.

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';

class StudentDetailPage extends ConsumerWidget {
  final AdvisoryStudent student;
  const StudentDetailPage({super.key, required this.student});

  Future<Map<String, dynamic>> _fetch(ApiClient api) async {
    final id = Uri.encodeComponent(student.studentId);
    try {
      final res = await api.dio.get('/api/teacher/advisory/students/$id');
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException {
      return {'name': student.name, 'lrn': student.lrn, 'riskLevel': student.riskLevel};
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.watch(apiClientProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(student.name)),
      body: FutureBuilder(
        future: _fetch(api),
        builder: (_, snap) {
          if (!snap.hasData) return const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList(count: 4));
          final d = snap.data!;
          final grades = (d['grades'] as List? ?? []);
          final referrals = (d['referrals'] as List? ?? []);
          return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
            ZCard(
              child: Row(children: [
                RiskBadge(level: (d['riskLevel'] ?? student.riskLevel).toString()),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('LRN ${d['lrn'] ?? student.lrn}',
                      style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                ),
              ]),
            ),
            const SizedBox(height: 12),
            Text('Grades (${grades.length})', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            if (grades.isEmpty)
              const ZEmpty(icon: Icons.grade_outlined, title: 'No grades yet', subtitle: 'Scores appear once the subject teacher encodes them.')
            else
              ZCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (var i = 0; i < grades.length; i++) ...[
                    ListTile(
                      dense: true,
                      title: Text((grades[i] as Map)['subject']?.toString() ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      trailing: Text('${(grades[i] as Map)['computedAverage'] ?? '—'} · ${(grades[i] as Map)['transmutedGrade'] ?? '—'}',
                          style: const TextStyle(fontSize: 12, fontFeatures: [FontFeature.tabularFigures()])),
                    ),
                    if (i != grades.length - 1) const Divider(height: 1),
                  ],
                ]),
              ),
            const SizedBox(height: 12),
            Text('Referrals (${referrals.length})', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            if (referrals.isEmpty)
              const ZEmpty(icon: Icons.send_outlined, title: 'No referrals', subtitle: 'File an anecdotal in Bama, then refer from there.')
            else
              for (final r in referrals)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ZCard(
                    child: Row(children: [
                      Expanded(child: Text('${(r as Map)['referredToRole'] ?? ''}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                      FlagChip(flag: (r['status']?.toString() ?? 'pending')),
                    ]),
                  ),
                ),
          ]);
        },
      ),
    );
  }
}
