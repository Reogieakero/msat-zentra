// Student detail — drawer parity with web:
// GET /api/teacher/advisory/students/:id (+ /academic, /attendance, /anecdotal)

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
    return Scaffold(
      appBar: AppBar(title: Text(student.name)),
      body: FutureBuilder(
        future: _fetch(api),
        builder: (_, snap) {
          if (!snap.hasData) return const LoadingView();
          final d = snap.data!;
          final grades = (d['grades'] as List? ?? []);
          final referrals = (d['referrals'] as List? ?? []);
          return ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [
              RiskBadge(level: (d['riskLevel'] ?? student.riskLevel).toString()),
              const SizedBox(width: 8),
              Text('LRN ${d['lrn'] ?? student.lrn}'),
            ]),
            const SizedBox(height: 12),
            Text('Grades (${grades.length})', style: Theme.of(context).textTheme.titleMedium),
            for (final g in grades)
              ListTile(
                dense: true,
                title: Text((g as Map)['subject']?.toString() ?? ''),
                trailing: Text('Avg ${(g['computedAverage'] ?? '—')} · ${g['transmutedGrade'] ?? '—'}'),
              ),
            const SizedBox(height: 12),
            Text('Referrals (${referrals.length})', style: Theme.of(context).textTheme.titleMedium),
            for (final r in referrals)
              ListTile(dense: true, title: Text((r as Map)['referredToRole']?.toString() ?? 'Referral'), subtitle: Text(r['status']?.toString() ?? '')),
            if (referrals.isEmpty) const Text('No referrals.', style: TextStyle(color: Colors.grey)),
          ]);
        },
      ),
    );
  }
}
