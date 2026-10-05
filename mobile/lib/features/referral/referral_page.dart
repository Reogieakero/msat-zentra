// Referral composer + timeline.
// POST /api/anecdotal/:id/refer {referredToRole, reason, consultReviewer?}
// 409 ADM_CASE_EXISTS = one open ADM case per student.
// GET /api/referrals/mine (term-scoped timeline), GET /api/adm/my-cases (stage-only).

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../shared/widgets.dart';

final referralsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/referrals/mine');
    return [for (final r in (res.data['referrals'] as List? ?? [])) Map<String, dynamic>.from(r as Map)];
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

class ReferralPage extends ConsumerStatefulWidget {
  const ReferralPage({super.key});
  @override
  ConsumerState<ReferralPage> createState() => _State();
}

class _State extends ConsumerState<ReferralPage> {
  final _anecId = TextEditingController();
  final _reason = TextEditingController();
  String _target = 'guidance_counselor';

  Future<void> _refer() async {
    final api = ref.read(apiClientProvider);
    try {
      await api.dio.post('/api/anecdotal/${_anecId.text.trim()}/refer', data: {'referredToRole': _target, 'reason': _reason.text.trim()});
      ref.invalidate(referralsProvider);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Referral sent.')));
    } on DioException catch (e) {
      final d = e.response?.data;
      final msg = d is Map && d['error'] is Map ? d['error']['message'].toString() : 'Refer failed';
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(referralsProvider);
    return ListView(padding: const EdgeInsets.all(12), children: [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            TextField(controller: _anecId, decoration: const InputDecoration(labelText: 'Anecdotal record ID')),
            DropdownButtonFormField<String>(
              initialValue: _target,
              decoration: const InputDecoration(labelText: 'Refer to'),
              items: const [
                DropdownMenuItem(value: 'nurse', child: Text('Nurse')),
                DropdownMenuItem(value: 'guidance_counselor', child: Text('Guidance')),
                DropdownMenuItem(value: 'adm_coordinator', child: Text('ADM Coordinator')),
                DropdownMenuItem(value: 'principal', child: Text('Principal')),
              ],
              onChanged: (v) => setState(() => _target = v ?? _target),
            ),
            TextField(controller: _reason, decoration: const InputDecoration(labelText: 'Reason'), maxLines: 3),
            const SizedBox(height: 8),
            FilledButton(onPressed: _refer, child: const Text('Send referral')),
          ]),
        ),
      ),
      const SizedBox(height: 8),
      list.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(referralsProvider)),
        data: (items) {
          if (items.isEmpty) return const Center(child: Text('No referrals this term.'));
          return Column(children: [
            for (final r in items)
              ListTile(
                title: Text('${r['referredToRole'] ?? ''} · ${r['status'] ?? ''}'),
                subtitle: Text(r['reason']?.toString() ?? ''),
              ),
          ]);
        },
      ),
    ]);
  }
}
