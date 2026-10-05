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
    return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 80), children: [
      ZCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('New referral', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          TextField(controller: _anecId, decoration: const InputDecoration(labelText: 'Anecdotal record ID'), style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _target,
            decoration: const InputDecoration(labelText: 'Refer to'),
            items: const [
              DropdownMenuItem(value: 'nurse', child: Text('Nurse', style: TextStyle(fontSize: 13))),
              DropdownMenuItem(value: 'guidance_counselor', child: Text('Guidance', style: TextStyle(fontSize: 13))),
              DropdownMenuItem(value: 'adm_coordinator', child: Text('ADM Coordinator', style: TextStyle(fontSize: 13))),
              DropdownMenuItem(value: 'principal', child: Text('Principal', style: TextStyle(fontSize: 13))),
            ],
            onChanged: (v) => setState(() => _target = v ?? _target),
          ),
          const SizedBox(height: 8),
          TextField(controller: _reason, decoration: const InputDecoration(labelText: 'Reason'), maxLines: 3, style: const TextStyle(fontSize: 13)),
          const SizedBox(height: 12),
          FilledButton(onPressed: _refer, child: const Text('Send referral')),
        ]),
      ),
      const SizedBox(height: 12),
      Text('Timeline', style: Theme.of(context).textTheme.labelSmall?.copyWith(letterSpacing: 0.4)),
      const SizedBox(height: 8),
      list.when(
        loading: () => const ZSkeletonList(),
        error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(referralsProvider)),
        data: (items) {
          if (items.isEmpty) {
            return const ZEmpty(icon: Icons.send_outlined, title: 'No referrals this term', subtitle: 'Sent referrals and their status appear here.');
          }
          return Column(children: [
            for (final r in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ZCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text('${r['referredToRole'] ?? ''}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                      FlagChip(flag: (r['status']?.toString() ?? 'pending')),
                    ]),
                    if ((r['reason']?.toString() ?? '').isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(r['reason'].toString(), style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ]),
                ),
              ),
          ]);
        },
      ),
    ]);
  }
}
