// Advisory list — web-matched rows + roster actions (parity with
// frontend/src/app/teacher/advisory/list/page.tsx).
// Endpoints (backend/src/modules/teacher/advisory.routes.ts):
// - GET /api/teacher/advisory/students (?archived=true)
// - POST /api/teacher/advisory/roster {fullName, lrn, sectionId?}
// - POST /api/teacher/advisory/students/archive {studentId}
// - POST /api/teacher/advisory/students/restore {studentId}
// Enlist/archive/restore are online-only (identity rows — never outboxed).

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/sync_outbox.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';

class AdvisorySection {
  final String id;
  final String name;
  const AdvisorySection({required this.id, required this.name});
  factory AdvisorySection.fromJson(Map<String, dynamic> j) =>
      AdvisorySection(id: j['id'].toString(), name: j['name']?.toString() ?? '');
}

class AdvisoryRoster {
  final List<AdvisoryStudent> students;
  final List<AdvisorySection> sections;
  final int archivedCount;
  const AdvisoryRoster({required this.students, required this.sections, required this.archivedCount});
}

Future<AdvisoryRoster> _fetchRoster(ApiClient api, {required bool archived}) async {
  try {
    final res = await api.dio.get(
      '/api/teacher/advisory/students',
      queryParameters: archived ? {'archived': 'true'} : null,
    );
    final data = res.data as Map<String, dynamic>;
    final students = [for (final s in (data['students'] as List? ?? [])) AdvisoryStudent.fromJson(s as Map<String, dynamic>)];
    if (students.isNotEmpty || archived) {
      return AdvisoryRoster(
        students: students,
        sections: [for (final s in (data['advisorySections'] as List? ?? [])) AdvisorySection.fromJson(s as Map<String, dynamic>)],
        archivedCount: (data['archivedCount'] ?? 0) as int,
      );
    }
  } catch (_) {
    if (archived) rethrow;
    // fall through to overview-based roster (no sections/count there)
  }
  final res = await api.dio.get('/api/teacher/overview/student-list');
  final data = res.data as Map<String, dynamic>;
  return AdvisoryRoster(
    students: [for (final s in (data['students'] as List? ?? [])) AdvisoryStudent.fromJson(s as Map<String, dynamic>)],
    sections: const [],
    archivedCount: 0,
  );
}

final advisoryProvider = FutureProvider<AdvisoryRoster>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    return await _fetchRoster(api, archived: false);
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

final archivedAdvisoryProvider = FutureProvider<AdvisoryRoster>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    return await _fetchRoster(api, archived: true);
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

String _apiMessage(DioException e, String fallback) {
  final d = e.response?.data;
  if (d is Map && d['error'] is Map) return d['error']['message']?.toString() ?? fallback;
  return fallback;
}

Future<bool> _online(BuildContext context) async {
  final conn = await Connectivity().checkConnectivity();
  if (conn.contains(ConnectivityResult.none)) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Needs connection — enlisting and archiving are online-only.')));
    }
    return false;
  }
  return true;
}

class AdvisoryListPage extends ConsumerStatefulWidget {
  const AdvisoryListPage({super.key});
  @override
  ConsumerState<AdvisoryListPage> createState() => _State();
}

class _State extends ConsumerState<AdvisoryListPage> {
  String _q = '';
  String _filter = 'All';
  bool _showArchived = false;
  bool _acting = false;

  void _refreshAll() {
    ref.invalidate(advisoryProvider);
    ref.invalidate(archivedAdvisoryProvider);
  }

  Future<void> _archive(AdvisoryStudent s) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Archive this student?', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('${s.name} will leave your advisory list. Grades, attendance, anecdotal records, and referrals are kept — restoring brings everything back.',
              style: Theme.of(ctx).textTheme.bodySmall),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel'))),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Archive'),
              ),
            ),
          ]),
        ]),
      ),
    );
    if (confirmed != true || !mounted) return;
    if (!await _online(context)) return;
    setState(() => _acting = true);
    try {
      await ref.read(apiClientProvider).dio.post('/api/teacher/advisory/students/archive', data: {'studentId': s.studentId});
      _refreshAll();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${s.name} archived. Records are kept.')));
    } on DioException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_apiMessage(e, 'Could not archive this student.'))));
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _restore(AdvisoryStudent s) async {
    if (!await _online(context)) return;
    setState(() => _acting = true);
    try {
      await ref.read(apiClientProvider).dio.post('/api/teacher/advisory/students/restore', data: {'studentId': s.studentId});
      _refreshAll();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${s.name} restored with full history.')));
    } on DioException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_apiMessage(e, 'Could not restore this student.'))));
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _openAdd(List<AdvisorySection> sections) async {
    if (!await _online(context)) return;
    if (!mounted) return;
    final name = TextEditingController();
    final lrn = TextEditingController();
    String? sectionId = sections.length == 1 ? sections.first.id : null;
    String? error;
    var saving = false;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom + 16, left: 16, right: 16, top: 8),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Add student', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              sections.length == 1 && sections.isNotEmpty ? 'Enlist into your advisory section (${sections.first.name}).' : 'Enlist a student into your advisory section.',
              style: Theme.of(ctx).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name', hintText: 'e.g. Juan Garcia'), maxLength: 120),
            TextField(
              controller: lrn,
              decoration: const InputDecoration(labelText: 'LRN', hintText: '12-digit LRN'),
              maxLength: 32,
              keyboardType: TextInputType.number,
              style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()]),
            ),
            if (sections.length > 1)
              DropdownButtonFormField<String>(
                initialValue: sectionId,
                decoration: const InputDecoration(labelText: 'Section'),
                items: [for (final s in sections) DropdownMenuItem(value: s.id, child: Text(s.name, style: const TextStyle(fontSize: 13)))],
                onChanged: (v) => setSheet(() => sectionId = v),
              ),
            if (error != null) ...[
              const SizedBox(height: 4),
              Text(error!, style: TextStyle(color: Theme.of(ctx).colorScheme.error, fontSize: 13)),
            ],
            const SizedBox(height: 12),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      final fullName = name.text.trim();
                      final lrnVal = lrn.text.trim();
                      if (fullName.isEmpty || lrnVal.isEmpty) {
                        setSheet(() => error = 'Name and LRN are both required.');
                        return;
                      }
                      setSheet(() {
                        saving = true;
                        error = null;
                      });
                      final payload = <String, dynamic>{'fullName': fullName, 'lrn': lrnVal};
                      final sid = sectionId;
                      if (sid != null) payload['sectionId'] = sid;
                      try {
                        // ignore: use_null_aware_elements
                        await ref.read(apiClientProvider).dio.post('/api/teacher/advisory/roster', data: payload);
                        _refreshAll();
                        if (ctx.mounted) Navigator.pop(ctx);
                        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$fullName enlisted.')));
                      } on DioException catch (e) {
                        setSheet(() {
                          saving = false;
                          error = _apiMessage(e, 'Could not enlist this student.');
                        });
                      }
                    },
              child: Text(saving ? 'Enlisting…' : 'Enlist student'),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final active = ref.watch(advisoryProvider);
    final archived = _showArchived ? ref.watch(archivedAdvisoryProvider) : null;
    final pending = ref.watch(outboxProvider).pendingCount;
    final archivedCount = active.maybeWhen(data: (r) => r.archivedCount, orElse: () => 0);
    final sections = active.maybeWhen(data: (r) => r.sections, orElse: () => const <AdvisorySection>[]);

    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Column(children: [
          Row(children: [
            Expanded(child: ZSearchField(hint: 'Search name or LRN', onChanged: (v) => setState(() => _q = v.trim().toLowerCase()))),
            const SizedBox(width: 8),
            PendingChip(count: pending),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: FilledButton.icon(icon: const Icon(Icons.person_add_outlined, size: 16), label: const Text('Add student'), onPressed: () => _openAdd(sections))),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                icon: const Icon(Icons.archive_outlined, size: 16),
                label: Text(_showArchived ? 'Back to list' : 'Archived ($archivedCount)'),
                onPressed: () => setState(() => _showArchived = !_showArchived),
              ),
            ),
          ]),
        ]),
      ),
      if (_showArchived)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            Expanded(
              child: Text('Archived advisees — records are kept. Restore brings everything back.',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ),
          ]),
        ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
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
        child: (_showArchived ? archived! : active).when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList()),
          error: (e, _) => ErrorView(
              message: e.toString(),
              onRetry: () => _showArchived ? ref.invalidate(archivedAdvisoryProvider) : ref.invalidate(advisoryProvider)),
          data: (roster) {
            final shown = roster.students.where((s) {
              final mq = _q.isEmpty || s.name.toLowerCase().contains(_q) || s.lrn.contains(_q);
              final mf = _filter == 'All' || s.riskLevel == _filter || s.flags.contains(_filter);
              return mq && mf;
            }).toList();
            if (shown.isEmpty) {
              return Padding(
                padding: const EdgeInsets.all(16),
                child: ZEmpty(
                  icon: _showArchived ? Icons.archive_outlined : Icons.shield_outlined,
                  title: _showArchived ? 'No archived students' : 'No students match',
                  subtitle: _showArchived
                      ? 'Students you archive land here — restore brings them back with full history.'
                      : 'Try a different search or filter. Zero-risk sections show here too.',
                  actionLabel: _showArchived ? null : 'Add student',
                  onAction: _showArchived ? null : () => _openAdd(sections),
                ),
              );
            }
            return RefreshIndicator(
              onRefresh: () async => _refreshAll(),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                itemCount: shown.length,
                separatorBuilder: (context, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final s = shown[i];
                  return ZCard(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    onTap: () => context.push('/adviser/students/${Uri.encodeComponent(s.studentId)}', extra: s),
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
                      Column(mainAxisSize: MainAxisSize.min, children: [
                        RiskBadge(level: s.riskLevel),
                        PopupMenuButton<String>(
                          icon: const Icon(Icons.more_vert, size: 18),
                          enabled: !_acting,
                          onSelected: (v) {
                            if (v == 'archive') _archive(s);
                            if (v == 'restore') _restore(s);
                          },
                          itemBuilder: (_) => [
                            if (!_showArchived)
                              const PopupMenuItem(value: 'archive', child: Text('Archive', style: TextStyle(fontSize: 13))),
                            if (_showArchived)
                              const PopupMenuItem(value: 'restore', child: Text('Restore', style: TextStyle(fontSize: 13))),
                          ],
                        ),
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
