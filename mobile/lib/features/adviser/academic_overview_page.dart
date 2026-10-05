// Academic overview — advisory students' general averages in one place.
// Same roster fetch as Advisory list (academicGrade per student); tapping a
// row opens the student detail where the full Academic section
// (GET .../students/:id/academic: remarks, lockStatus, summary) lives.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../shared/widgets.dart';
import 'advisory_list_page.dart' show advisoryProvider;

class AcademicOverviewPage extends ConsumerStatefulWidget {
  const AcademicOverviewPage({super.key});
  @override
  ConsumerState<AcademicOverviewPage> createState() => _State();
}

class _State extends ConsumerState<AcademicOverviewPage> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final roster = ref.watch(advisoryProvider);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: ZSearchField(hint: 'Search name or LRN', onChanged: (v) => setState(() => _q = v.trim().toLowerCase())),
      ),
      Expanded(
        child: roster.when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList()),
          error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(advisoryProvider)),
          data: (r) {
            final shown = r.students.where((s) => _q.isEmpty || s.name.toLowerCase().contains(_q) || s.lrn.contains(_q)).toList()
              ..sort((a, b) => (a.academicGrade ?? 101).compareTo(b.academicGrade ?? 101));
            if (shown.isEmpty) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: ZEmpty(icon: Icons.school_outlined, title: 'No students match', subtitle: 'Try a different search.'),
              );
            }
            final graded = shown.where((s) => s.academicGrade != null).toList();
            final avg = graded.isEmpty ? null : graded.map((s) => s.academicGrade!).reduce((a, b) => a + b) / graded.length;
            final failing = graded.where((s) => s.academicGrade! < 75).length;
            return RefreshIndicator(
              onRefresh: () async => ref.invalidate(advisoryProvider),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                itemCount: shown.length + 1,
                separatorBuilder: (context, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  if (i == 0) {
                    return ZCard(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(
                          avg == null ? 'No encoded averages yet' : 'Avg ${avg.toStringAsFixed(1)} across ${graded.length} graded',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()]),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          failing == 0 ? 'No failing averages' : '$failing failing — open a student for subject detail',
                          style: theme.textTheme.bodySmall?.copyWith(color: failing == 0 ? const Color(0xFF22C55E) : const Color(0xFFDC2626)),
                        ),
                      ]),
                    );
                  }
                  final s = shown[i - 1];
                  final isFailing = (s.academicGrade ?? 100) < 75;
                  return ZCard(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    onTap: () => context.push('/adviser/students/${Uri.encodeComponent(s.studentId)}', extra: s),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(s.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          Text('LRN ${s.lrn}',
                              style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()], color: theme.colorScheme.onSurfaceVariant)),
                        ]),
                      ),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Text(s.academicGrade?.toStringAsFixed(1) ?? '—',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              fontFeatures: const [FontFeature.tabularFigures()],
                              color: isFailing ? const Color(0xFFDC2626) : null,
                            )),
                        RiskBadge(level: s.riskLevel),
                      ]),
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
