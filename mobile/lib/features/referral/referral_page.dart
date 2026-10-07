// Referrals — web teacher/advisory/referrals parity (adviser side).
// Composer: GET /anecdotal/referable student → record picker, ADM case vs
// Other matters type split, reviewer routing, reason.
// POST /api/anecdotal/:id/refer {referredToRole, reason, consultReviewer?}.
// 409 ADM_CASE_EXISTS surfaces verbatim.
// Timeline: GET /api/referrals/mine (bare array) with status/type badges,
// search, Track detail, Cancel / Refer-again / Delete actions.

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../shared/widgets.dart';

final referralsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/referrals/mine');
    final data = res.data;
    final List list = data is List ? data : (data is Map && data['referrals'] is List ? data['referrals'] as List : []);
    return [for (final r in list) Map<String, dynamic>.from(r as Map)];
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

final referableProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/anecdotal/referable');
    final data = res.data;
    final List list = data is List ? data : (data is Map && data['records'] is List ? data['records'] as List : []);
    return [for (final r in list) Map<String, dynamic>.from(r as Map)];
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

String _apiMessage(DioException e, String fallback) {
  final d = e.response?.data;
  if (d is Map && d['error'] is Map) return d['error']['message']?.toString() ?? fallback;
  return fallback;
}

String _humanize(String? v) {
  if (v == null || v.isEmpty) return '—';
  return v.split('_').map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');
}

Color _statusColor(String status) => switch (status) {
      'pending' => const Color(0xFFF59E0B),
      'in_progress' => const Color(0xFF3B82F6),
      'info_requested' => const Color(0xFF3B82F6),
      'follow_up' => const Color(0xFFF59E0B),
      'resolved' => const Color(0xFF22C55E),
      'escalated' => const Color(0xFFDC2626),
      _ => const Color(0xFF8A8A8A),
    };

String _statusLabel(String status) => switch (status) {
      'pending' => 'Pending',
      'in_progress' => 'In progress',
      'info_requested' => 'Info requested',
      'follow_up' => 'Follow up',
      'resolved' => 'Resolved',
      'dismissed' => 'Cancelled',
      'escalated' => 'Escalated',
      _ => _humanize(status),
    };

bool _isAdm(Map<String, dynamic> r) => (r['track']?.toString() == 'adm') || (r['targetRole']?.toString() == 'adm_coordinator');

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});
  @override
  Widget build(BuildContext context) {
    final c = _statusColor(status);
    return Container(
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), color: c.withValues(alpha: 0.12)),
      child: Center(child: Text(_statusLabel(status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: c))),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  final bool adm;
  const _TypeBadge({required this.adm});
  @override
  Widget build(BuildContext context) {
    final c = adm ? const Color(0xFFF59E0B) : const Color(0xFF3B82F6);
    return Container(
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), color: c.withValues(alpha: 0.12)),
      child: Center(child: Text(adm ? 'ADM case' : 'Other matters', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: c))),
    );
  }
}

class ReferralPage extends ConsumerStatefulWidget {
  const ReferralPage({super.key});
  @override
  ConsumerState<ReferralPage> createState() => _State();
}

class _State extends ConsumerState<ReferralPage> {
  String _q = '';

  void _refresh() {
    ref.invalidate(referralsProvider);
    ref.invalidate(referableProvider);
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(referralsProvider);
    return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 80), children: [
      ZCard(
        child: Row(children: [
          const Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('New referral', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              SizedBox(height: 2),
              Text('Pick a filed anecdotal record, then route it.', style: TextStyle(fontSize: 13)),
            ]),
          ),
          FilledButton(onPressed: () => _openComposer(), child: const Text('Refer')),
        ]),
      ),
      const SizedBox(height: 12),
      ZSearchField(hint: 'Filter by name, LRN, or role', onChanged: (v) => setState(() => _q = v.trim().toLowerCase())),
      const SizedBox(height: 8),
      Text('Timeline', style: Theme.of(context).textTheme.labelSmall?.copyWith(letterSpacing: 0.4)),
      const SizedBox(height: 8),
      list.when(
        loading: () => const ZSkeletonList(),
        error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(referralsProvider)),
        data: (items) {
          final shown = items.where((r) {
            if (_q.isEmpty) return true;
            return (r['studentName']?.toString() ?? '').toLowerCase().contains(_q) ||
                (r['lrn']?.toString() ?? '').contains(_q) ||
                (r['targetRole']?.toString() ?? '').toLowerCase().contains(_q);
          }).toList();
          if (shown.isEmpty) {
            return Padding(
              padding: const EdgeInsets.only(top: 8),
              child: ZEmpty(
                icon: Icons.send_outlined,
                title: items.isEmpty ? 'No referrals this term' : 'No referrals match',
                subtitle: items.isEmpty ? 'Sent referrals and their status appear here.' : 'Try a different search.',
              ),
            );
          }
          return Column(children: [
            for (final r in shown)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _ReferralCard(referral: r, onChanged: _refresh),
              ),
          ]);
        },
      ),
    ]);
  }

  void _openComposer() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        builder: (_, scroll) => _ComposerSheet(scroll: scroll, onSent: _refresh),
      ),
    );
  }
}

class _ReferralCard extends ConsumerWidget {
  final Map<String, dynamic> referral;
  final VoidCallback onChanged;
  const _ReferralCard({required this.referral, required this.onChanged});

  bool get _cancelable {
    final s = referral['status']?.toString() ?? '';
    return s != 'resolved' && s != 'dismissed';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = referral;
    final status = r['status']?.toString() ?? 'pending';
    final adm = _isAdm(r);
    return ZCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text((r['studentName']?.toString().isNotEmpty ?? false) ? r['studentName'].toString() : 'Referral',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              Text('LRN ${r['lrn'] ?? '—'} · ${_humanize(r['targetRole']?.toString())}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            ]),
          ),
          _StatusBadge(status: status),
        ]),
        const SizedBox(height: 6),
        Wrap(spacing: 6, children: [
          _TypeBadge(adm: adm),
          if ((r['consultReviewer']?.toString().isNotEmpty ?? false)) FlagChip(flag: 'review: ${r['consultReviewer']}'),
        ]),
        if ((r['reason']?.toString() ?? '').isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(r['reason'].toString(), style: Theme.of(context).textTheme.bodySmall),
        ],
        const SizedBox(height: 8),
        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () => _openTrack(context),
              child: const Text('Track'),
            ),
          ),
          const SizedBox(width: 8),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, size: 18),
            onSelected: (v) {
              if (v == 'cancel') _askCancel(context, ref);
              if (v == 'reopen') _reopen(context, ref);
              if (v == 'delete') _askDelete(context, ref);
            },
            itemBuilder: (_) => [
              if (_cancelable) const PopupMenuItem(value: 'cancel', child: Text('Cancel', style: TextStyle(fontSize: 13))),
              if (status == 'dismissed') const PopupMenuItem(value: 'reopen', child: Text('Refer again', style: TextStyle(fontSize: 13))),
              if (status == 'dismissed') const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(fontSize: 13))),
            ],
          ),
        ]),
      ]),
    );
  }

  void _openTrack(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.75,
        builder: (_, scroll) => _TrackSheet(referral: referral, scroll: scroll),
      ),
    );
  }

  void _askCancel(BuildContext context, WidgetRef ref) {
    final reason = TextEditingController();
    String? error;
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom + 16, left: 16, right: 16, top: 8),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Cancel this referral?', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('Scheduled sessions are cancelled too. This cannot be undone, but you can refer again afterwards.',
                style: Theme.of(ctx).textTheme.bodySmall),
            const SizedBox(height: 8),
            TextField(controller: reason, decoration: const InputDecoration(labelText: 'Reason (required)'), maxLength: 500, maxLines: 3),
            if (error != null) Text(error!, style: TextStyle(color: Theme.of(ctx).colorScheme.error, fontSize: 13)),
            const SizedBox(height: 8),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
              onPressed: () async {
                if (reason.text.trim().isEmpty) {
                  setSheet(() => error = 'A reason is required.');
                  return;
                }
                try {
                  await ref.read(apiClientProvider).dio.post('/api/referrals/${referral['id']}/cancel', data: {'reason': reason.text.trim()});
                  onChanged();
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Referral cancelled.')));
                } on DioException catch (e) {
                  setSheet(() => error = _apiMessage(e, 'Could not cancel.'));
                }
              },
              child: const Text('Cancel referral'),
            ),
          ]),
        ),
      ),
    );
  }

  void _reopen(BuildContext context, WidgetRef ref) {
    if (_isAdm(referral)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cancelled ADM cases cannot be re-submitted — start a new referral from scratch.')));
      return;
    }
    String target = 'guidance_counselor';
    String? reviewer;
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: const EdgeInsets.all(16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Refer again', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: target,
              decoration: const InputDecoration(labelText: 'Refer to'),
              items: const [
                DropdownMenuItem(value: 'guidance_counselor', child: Text('Guidance', style: TextStyle(fontSize: 13))),
                DropdownMenuItem(value: 'nurse', child: Text('Nurse', style: TextStyle(fontSize: 13))),
                DropdownMenuItem(value: 'adm_coordinator', child: Text('ADM Coordinator', style: TextStyle(fontSize: 13))),
                DropdownMenuItem(value: 'principal', child: Text('Principal', style: TextStyle(fontSize: 13))),
              ],
              onChanged: (v) => setSheet(() {
                target = v ?? target;
                reviewer = null;
              }),
            ),
            if (target == 'adm_coordinator') ...[
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: reviewer,
                decoration: const InputDecoration(labelText: 'Consult reviewer'),
                items: const [
                  DropdownMenuItem(value: 'nurse', child: Text('Nurse', style: TextStyle(fontSize: 13))),
                  DropdownMenuItem(value: 'guidance_counselor', child: Text('Guidance', style: TextStyle(fontSize: 13))),
                  DropdownMenuItem(value: 'lrpc', child: Text('LRPC', style: TextStyle(fontSize: 13))),
                ],
                onChanged: (v) => setSheet(() => reviewer = v),
              ),
            ],
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () async {
                final payload = <String, dynamic>{'referredToRole': target};
                final rev = reviewer;
                if (rev != null) payload['consultReviewer'] = rev;
                try {
                  // ignore: use_null_aware_elements
                  await ref.read(apiClientProvider).dio.post('/api/referrals/${referral['id']}/reopen', data: payload);
                  onChanged();
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Referral re-opened.')));
                } on DioException catch (e) {
                  if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(_apiMessage(e, 'Could not re-open.'))));
                }
              },
              child: const Text('Re-open referral'),
            ),
          ]),
        ),
      ),
    );
  }

  void _askDelete(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Delete this referral?', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('Only pristine cancelled referrals can be deleted.', style: Theme.of(ctx).textTheme.bodySmall),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Keep'))),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                onPressed: () async {
                  try {
                    await ref.read(apiClientProvider).dio.delete('/api/referrals/${referral['id']}');
                    onChanged();
                    if (ctx.mounted) Navigator.pop(ctx);
                  } on DioException catch (e) {
                    if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(_apiMessage(e, 'Could not delete.'))));
                  }
                },
                child: const Text('Delete'),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

class _TrackSheet extends StatelessWidget {
  final Map<String, dynamic> referral;
  final ScrollController scroll;
  const _TrackSheet({required this.referral, required this.scroll});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final r = referral;
    final status = r['status']?.toString() ?? 'pending';
    final adm = _isAdm(r);
    final timeline = (r['timeline'] as List? ?? []);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ListView(controller: scroll, children: [
        Row(children: [
          Expanded(child: Text((r['studentName']?.toString().isNotEmpty ?? false) ? r['studentName'].toString() : 'Referral track', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600))),
          _StatusBadge(status: status),
        ]),
        const SizedBox(height: 4),
        Text('To ${_humanize(r['targetRole']?.toString())} · LRN ${r['lrn'] ?? '—'}', style: theme.textTheme.bodySmall),
        const SizedBox(height: 8),
        Wrap(spacing: 6, children: [_TypeBadge(adm: adm)]),
        if ((r['reason']?.toString() ?? '').isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('Filing reason', style: theme.textTheme.labelSmall),
          Text(r['reason'].toString(), style: const TextStyle(fontSize: 13)),
        ],
        if ((r['referredAt']?.toString() ?? '').isNotEmpty) ...[
          const SizedBox(height: 4),
          Text('Submitted ${r['referredAt']}', style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
        ],
        if (adm) ...[
          const SizedBox(height: 8),
          Text('ADM evidence', style: theme.textTheme.labelSmall),
          Text(
            'Stage: ${(r['admStageLabel'] ?? r['admStage'] ?? '—').toString()} · Eligibility: ${(r['admEligibility'] ?? '—').toString()} · Modules ${r['modulesSubmitted'] ?? 0}/${r['modulesTotal'] ?? 0}',
            style: theme.textTheme.bodySmall,
          ),
        ],
        const SizedBox(height: 8),
        Text('Timeline (${timeline.length})', style: theme.textTheme.labelSmall),
        const SizedBox(height: 4),
        if (timeline.isEmpty)
          const Text('No timeline entries yet.', style: TextStyle(fontSize: 13))
        else
          for (final t in timeline)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text((t as Map)['label']?.toString() ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text(
                '${(t['date'] ?? t['at'] ?? '').toString()}${(t['detail']?.toString().isNotEmpty ?? false) ? ' · ${t['detail']}' : ''}',
                style: theme.textTheme.bodySmall,
              ),
            ),
      ]),
    );
  }
}

class _ComposerSheet extends ConsumerStatefulWidget {
  final ScrollController scroll;
  final VoidCallback onSent;
  const _ComposerSheet({required this.scroll, required this.onSent});

  @override
  ConsumerState<_ComposerSheet> createState() => _ComposerState();
}

class _ComposerState extends ConsumerState<_ComposerSheet> {
  String? _studentKey;
  Map<String, dynamic>? _record;
  String _kind = 'other'; // adm | other
  String _receiver = 'other:guidance';
  final _reason = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  String get _desk => _receiver.split(':').first == 'adm' ? 'adm_coordinator' : _receiver.split(':').last;
  String? get _reviewer => _receiver.startsWith('adm:') ? _receiver.split(':').last : null;
  String get _filedTo => _receiver.startsWith('adm:')
      ? 'ADM Coordinator via ${_humanize(_receiver.split(':').last)}'
      : _humanize(_desk);

  Future<void> _send() async {
    if (_record == null) {
      setState(() => _error = 'Pick an anecdotal record first.');
      return;
    }
    if (_reason.text.trim().isEmpty) {
      setState(() => _error = 'A reason is required.');
      return;
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      await ref.read(apiClientProvider).dio.post('/api/anecdotal/${_record!['id']}/refer', data: {
        'referredToRole': _desk,
        'reason': _reason.text.trim(),
        if (_reviewer != null) 'consultReviewer': _reviewer,
      });
      widget.onSent();
      if (mounted) Navigator.pop(context);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Referral sent.')));
    } on DioException catch (e) {
      setState(() {
        _busy = false;
        _error = _apiMessage(e, 'Refer failed.');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final referable = ref.watch(referableProvider);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: referable.when(
        loading: () => const ZSkeletonList(count: 3),
        error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(referableProvider)),
        data: (records) {
          final open = records.where((r) => r['hasReferral'] != true).toList();
          final students = <String, Map<String, String>>{};
          for (final r in open) {
            final key = (r['studentId']?.toString().isNotEmpty ?? false) ? r['studentId'].toString() : 'lrn:${r['lrn']}';
            students.putIfAbsent(key, () => {'name': (r['studentName'] ?? '').toString(), 'lrn': (r['lrn'] ?? '').toString()});
          }
          if (_studentKey != null && !students.containsKey(_studentKey)) _studentKey = null;
          final studentRecords = _studentKey == null ? const <Map<String, dynamic>>[] : open.where((r) {
            final key = (r['studentId']?.toString().isNotEmpty ?? false) ? r['studentId'].toString() : 'lrn:${r['lrn']}';
            return key == _studentKey;
          }).toList();
          if (_record != null && !studentRecords.any((r) => r['id'] == _record!['id'])) _record = null;
          return ListView(controller: widget.scroll, children: [
            const Text('New referral', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _studentKey,
              decoration: const InputDecoration(labelText: 'Student'),
              items: [
                for (final e in students.entries)
                  DropdownMenuItem(value: e.key, child: Text('${e.value['name']} · ${e.value['lrn']}', style: const TextStyle(fontSize: 13))),
              ],
              onChanged: (v) => setState(() {
                _studentKey = v;
                _record = null;
              }),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<Map<String, dynamic>>(
              initialValue: _record,
              decoration: const InputDecoration(labelText: 'Anecdotal record'),
              items: [
                for (final r in studentRecords)
                  DropdownMenuItem(
                    value: r,
                    child: Text('${r['observationDate'] ?? ''} · ${_humanize(r['category']?.toString())}', style: const TextStyle(fontSize: 13)),
                  ),
              ],
              onChanged: _studentKey == null ? null : (v) => setState(() => _record = v),
            ),
            if (_record != null && ( _record!['excerpt']?.toString().isNotEmpty ?? false)) ...[
              const SizedBox(height: 4),
              Text((_record!['excerpt'] ?? '').toString(), maxLines: 3, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: 8),
            SegTabs<String>(
              values: const ['adm', 'other'],
              labels: const ['ADM case', 'Other matters'],
              selected: _kind,
              onChanged: (v) => setState(() {
                _kind = v;
                _receiver = v == 'adm' ? 'adm:nurse' : 'other:guidance';
              }),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _receiver,
              decoration: const InputDecoration(labelText: 'Received by'),
              items: _kind == 'adm'
                  ? const [
                      DropdownMenuItem(value: 'adm:nurse', child: Text('Nurse (ADM)', style: TextStyle(fontSize: 13))),
                      DropdownMenuItem(value: 'adm:guidance', child: Text('Guidance (ADM)', style: TextStyle(fontSize: 13))),
                      DropdownMenuItem(value: 'adm:lrpc', child: Text('LRPC (ADM)', style: TextStyle(fontSize: 13))),
                    ]
                  : const [
                      DropdownMenuItem(value: 'other:guidance', child: Text('Guidance', style: TextStyle(fontSize: 13))),
                      DropdownMenuItem(value: 'other:nurse', child: Text('Nurse', style: TextStyle(fontSize: 13))),
                    ],
              onChanged: (v) => setState(() => _receiver = v ?? _receiver),
            ),
            const SizedBox(height: 4),
            Text('Filed to: $_filedTo', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            TextField(controller: _reason, decoration: const InputDecoration(labelText: 'Reason'), maxLines: 3, style: const TextStyle(fontSize: 13)),
            if (_error != null) ...[
              const SizedBox(height: 4),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13)),
            ],
            const SizedBox(height: 12),
            FilledButton(onPressed: _busy ? null : _send, child: Text(_busy ? 'Sending…' : 'Send referral')),
          ]);
        },
      ),
    );
  }
}
