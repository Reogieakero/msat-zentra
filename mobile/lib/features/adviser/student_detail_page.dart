// Student detail — web drawer parity: risk + LRN tabular + grades + attendance
// (present average per subject) + referrals.
// Attendance: GET /api/teacher/advisory/students/:id/attendance (term from
// session headers). Shows subjectSummary ?? summary, never mixed.
// subjectSummary = pooled present/total over subject-era takes +
// bySubject[] rows. subjectSummary null = AM/PM-only -> fallback with hint.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';

class SubjectRate {
  final String subjectId;
  final String name;
  final String code;
  final int present;
  final int total;
  final double rate;
  const SubjectRate({
    required this.subjectId,
    required this.name,
    required this.code,
    required this.present,
    required this.total,
    required this.rate,
  });
  factory SubjectRate.fromJson(Map<String, dynamic> j) => SubjectRate(
        subjectId: j['subjectId']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        code: j['code']?.toString() ?? '',
        present: (j['present'] ?? 0) as int,
        total: (j['total'] ?? 0) as int,
        rate: ((j['rate'] ?? 0) as num).toDouble(),
      );
}

class AttendanceSummary {
  final int present;
  final int absent;
  final int late;
  final int excused;
  final int total;
  final double rate;
  final bool isRisk;
  final List<SubjectRate> bySubject;
  final bool subjectEra;
  const AttendanceSummary({
    required this.present,
    required this.absent,
    required this.late,
    required this.excused,
    required this.total,
    required this.rate,
    required this.isRisk,
    required this.bySubject,
    required this.subjectEra,
  });

  factory AttendanceSummary.fromAttendancePayload(Map<String, dynamic> payload) {
    final subj = payload['subjectSummary'];
    if (subj is Map) {
      final m = Map<String, dynamic>.from(subj);
      return AttendanceSummary(
        present: (m['present'] ?? 0) as int,
        absent: (m['absent'] ?? 0) as int,
        late: (m['late'] ?? 0) as int,
        excused: (m['excused'] ?? 0) as int,
        total: (m['total'] ?? 0) as int,
        rate: ((m['rate'] ?? 0) as num).toDouble(),
        isRisk: (m['isRisk'] ?? false) as bool,
        bySubject: [for (final s in (m['bySubject'] as List? ?? [])) SubjectRate.fromJson(s as Map<String, dynamic>)],
        subjectEra: true,
      );
    }
    final sum = Map<String, dynamic>.from(payload['summary'] as Map? ?? {});
    return AttendanceSummary(
      present: (sum['present'] ?? 0) as int,
      absent: (sum['absent'] ?? 0) as int,
      late: (sum['late'] ?? 0) as int,
      excused: (sum['excused'] ?? 0) as int,
      total: (sum['total'] ?? 0) as int,
      rate: ((sum['rate'] ?? 0) as num).toDouble(),
      isRisk: (sum['isRisk'] ?? false) as bool,
      bySubject: const [],
      subjectEra: false,
    );
  }
}

class StudentDetailPage extends ConsumerWidget {
  final AdvisoryStudent student;
  const StudentDetailPage({super.key, required this.student});

  Future<(Map<String, dynamic>, Map<String, dynamic>?)> _fetch(ApiClient api) async {
    final id = Uri.encodeComponent(student.studentId);
    final detailFuture = api.dio.get('/api/teacher/advisory/students/$id').then((r) => Map<String, dynamic>.from(r.data as Map)).catchError(
        (Object e) => {'name': student.name, 'lrn': student.lrn, 'riskLevel': student.riskLevel});
    final attendanceFuture =
        api.dio.get('/api/teacher/advisory/students/$id/attendance').then((r) => Map<String, dynamic>.from(r.data as Map)).catchError((Object _) => <String, dynamic>{});
    final results = await Future.wait([detailFuture, attendanceFuture]);
    final detail = results[0];
    final attendanceRaw = results[1];
    final attendance = attendanceRaw.isEmpty ? null : attendanceRaw;
    return (detail, attendance);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.watch(apiClientProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(student.name)),
      body: FutureBuilder(
        future: _fetch(api),
        builder: (context, snap) {
          if (!snap.hasData) return const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList(count: 4));
          final d = snap.data!.$1;
          final attendancePayload = snap.data!.$2;
          final grades = (d['grades'] as List? ?? []);
          final referrals = (d['referrals'] as List? ?? []);
          final attendance = attendancePayload == null || attendancePayload['summary'] == null ? null : AttendanceSummary.fromAttendancePayload(attendancePayload);
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
            Text('Attendance', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            if (attendance == null)
              const ZEmpty(icon: Icons.fact_check_outlined, title: 'No attendance yet', subtitle: 'Records appear once takes are submitted for this term.')
            else
              _AttendanceCard(summary: attendance),
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

class _AttendanceCard extends StatelessWidget {
  final AttendanceSummary summary;
  const _AttendanceCard({required this.summary});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pct = (summary.rate * 100).toStringAsFixed(1);
    final sorted = [...summary.bySubject]..sort((a, b) => a.rate.compareTo(b.rate));
    final weakest = sorted.isEmpty ? null : sorted.first;
    return ZCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text('$pct% present',
                style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()])),
          ),
          if (summary.isRisk) const RiskBadge(level: 'High'),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(value: summary.rate.clamp(0, 1), minHeight: 6),
        ),
        const SizedBox(height: 6),
        Text(
          summary.subjectEra
              ? '${summary.present} present across ${summary.total} subject sessions'
              : '${summary.present} present across ${summary.total} sessions (AM/PM record — no per-subject takes yet)',
          style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
        ),
        Text('P ${summary.present} · A ${summary.absent} · L ${summary.late} · E ${summary.excused}',
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, fontFeatures: const [FontFeature.tabularFigures()])),
        if (weakest != null) ...[
          const SizedBox(height: 4),
          Text('Weakest: ${weakest.name} at ${(weakest.rate * 100).toStringAsFixed(1)}% (${weakest.present}/${weakest.total})',
              style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
        ],
        if (sorted.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Divider(height: 1),
          for (var i = 0; i < sorted.length; i++) ...[
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text('${sorted[i].name} (${sorted[i].code})', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              trailing: Text('${sorted[i].present}/${sorted[i].total} — ${(sorted[i].rate * 100).toStringAsFixed(1)}%',
                  style: const TextStyle(fontSize: 12, fontFeatures: [FontFeature.tabularFigures()])),
            ),
            if (i != sorted.length - 1) const Divider(height: 1),
          ],
        ],
      ]),
    );
  }
}
