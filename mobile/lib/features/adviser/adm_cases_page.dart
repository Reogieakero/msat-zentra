// ADM Cases — advisory list of the teacher's ADM cases.
// GET /api/adm/my-cases (term-scoped, status-only). Same fetch as web
// advisory/adm-cases (fetchMyAdmCases) + per-student filter in detail.
// Tapping a case opens the student detail (ADM section kept in context).

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';
import 'adm_case_card.dart';

final admCasesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/adm/my-cases');
    final data = res.data;
    final List list = data is List ? data : (data is Map && data['cases'] is List ? data['cases'] as List : []);
    final cases = [for (final c in list) Map<String, dynamic>.from(c as Map)];
    cases.sort((a, b) => admOrderOf(a['stage']?.toString() ?? '').compareTo(admOrderOf(b['stage']?.toString() ?? '')));
    return cases;
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

class AdmCasesPage extends ConsumerWidget {
  const AdmCasesPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cases = ref.watch(admCasesProvider);
    return cases.when(
      loading: () => const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList()),
      error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(admCasesProvider)),
      data: (list) {
        if (list.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: ZEmpty(
              icon: Icons.folder_shared_outlined,
              title: 'No ADM cases',
              subtitle: 'Referred students under ADM monitoring appear here with their stage.',
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(admCasesProvider),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
            itemCount: list.length,
            separatorBuilder: (context, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final c = list[i];
              return AdmCaseCard(
                caseData: c,
                onTap: (c['studentId'] == null)
                    ? null
                    : () {
                        final sid = c['studentId'].toString();
                        context.push(
                          '/adviser/students/${Uri.encodeComponent(sid)}',
                          extra: AdvisoryStudent(
                            studentId: sid,
                            name: (c['studentName'] ?? 'Student').toString(),
                            lrn: (c['lrn'] ?? '—').toString(),
                            hasAccount: !sid.startsWith('roster:'),
                          ),
                        );
                      },
              );
            },
          ),
        );
      },
    );
  }
}
