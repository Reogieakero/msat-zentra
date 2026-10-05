// Workspace attendance — shared by Advisers + Subject Teachers.
// Web sequence verbatim (frontend/src/app/teacher/attendance/page.tsx):
// my-slots pairs -> section-roster (ONLY student source) -> subjects offered
// (resolvedSubjectId = pair subject ?? first canMark ?? first) -> prefill
// advisory/attendance -> bulk submit with assignmentId + slot.
// Never uses overview['advisorySection'] (that was the old adviser-only bug).

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/session.dart';
import '../../core/sync_outbox.dart';
import '../../shared/widgets.dart';

class TeachingPair {
  final String sectionId;
  final String sectionName;
  final String subjectId;
  final String subjectName;
  const TeachingPair({required this.sectionId, required this.sectionName, required this.subjectId, required this.subjectName});
  String get key => '$sectionId|$subjectId';
}

class WorkspaceAttendancePage extends ConsumerStatefulWidget {
  const WorkspaceAttendancePage({super.key});
  @override
  ConsumerState<WorkspaceAttendancePage> createState() => _State();
}

class _State extends ConsumerState<WorkspaceAttendancePage> {
  DateTime _date = DateTime.now();
  List<TeachingPair> _pairs = [];
  TeachingPair? _pair;
  List<Map<String, dynamic>> _offered = [];
  String? _subjectId;
  String? _assignmentId;
  List<Map<String, dynamic>> _marks = [];
  List<Map<String, dynamic>> _roster = [];
  bool _busy = false;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPairs();
  }

  Future<void> _loadPairs() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = ref.read(apiClientProvider);
    try {
      // Rail source: my-slots committed pairs (same as web + My Classes).
      final res = await api.dio.get('/api/teacher/schedule/my-slots');
      final data = res.data;
      final List raw = data is List ? data : (data is Map && data['slots'] is List ? data['slots'] as List : []);
      final seen = <String, TeachingPair>{};
      for (final s in raw) {
        final m = s as Map<String, dynamic>;
        final section = m['section'] as Map<String, dynamic>? ?? {};
        final subject = m['subject'] as Map<String, dynamic>? ?? {};
        final sectionId = (m['sectionId'] ?? section['id'])?.toString() ?? '';
        final subjectId = (m['subjectId'] ?? subject['id'])?.toString() ?? '';
        if (sectionId.isEmpty || subjectId.isEmpty) continue;
        final key = '$sectionId|$subjectId';
        seen.putIfAbsent(
          key,
          () => TeachingPair(
            sectionId: sectionId,
            sectionName: (section['name'] ?? m['sectionName'] ?? '').toString(),
            subjectId: subjectId,
            subjectName: (subject['name'] ?? m['subjectName'] ?? '').toString(),
          ),
        );
      }
      // Fallback: overview classes (assignment id or subjectId|sectionId).
      if (seen.isEmpty) {
        final overview = await ref.read(overviewProvider.future);
        for (final c in (overview['classes'] as List? ?? [])) {
          final m = c as Map<String, dynamic>;
          final id = m['id'].toString();
          String subjectId = '';
          String sectionId = '';
          if (id.contains('|')) {
            final parts = id.split('|');
            subjectId = parts[0];
            sectionId = parts[1];
          } else {
            continue; // assignment uuids resolve server-side via gradebook, not here
          }
          final key = '$sectionId|$subjectId';
          seen.putIfAbsent(
            key,
            () => TeachingPair(
              sectionId: sectionId,
              sectionName: (m['section'] ?? '').toString(),
              subjectId: subjectId,
              subjectName: (m['subject'] ?? '').toString(),
            ),
          );
        }
      }
      final pairs = seen.values.toList()..sort((a, b) => '${a.sectionName}${a.subjectName}'.compareTo('${b.sectionName}${b.subjectName}'));
      setState(() {
        _pairs = pairs;
        _pair = pairs.isEmpty ? null : pairs.first;
        _loading = false;
      });
      if (_pair != null) await _loadSection();
    } on DioException catch (e) {
      setState(() {
        _loading = false;
        _error = _msg(e, 'Failed to load teaching load.');
      });
    }
  }

  Future<void> _loadSection() async {
    final pair = _pair;
    final term = ref.read(termProvider);
    if (pair == null || term == null) return;
    final api = ref.read(apiClientProvider);
    try {
      final results = await Future.wait([
        api.dio.get('/api/attendance/section-roster', queryParameters: {'sectionId': pair.sectionId}),
        api.dio.get('/api/attendance/subjects', queryParameters: {'sectionId': pair.sectionId, 'termId': term.id}),
      ]);
      final rosterRes = results[0];
      final offeredRes = results[1];
      final students = [for (final s in ((rosterRes.data as Map)['students'] as List? ?? [])) Map<String, dynamic>.from(s as Map)];
      final offered = [for (final s in ((offeredRes.data as Map)['subjects'] as List? ?? [])) Map<String, dynamic>.from(s as Map)];
      // resolvedSubjectId = pair subject if offered, else first canMark, else first.
      String? subjectId;
      String? assignmentId;
      final match = offered.where((o) => o['subjectId']?.toString() == pair.subjectId).toList();
      if (match.isNotEmpty) {
        subjectId = match.first['subjectId']?.toString();
        assignmentId = match.first['assignmentId']?.toString();
      } else {
        final markable = offered.where((o) => o['canMark'] == true).toList();
        final pick = markable.isNotEmpty ? markable.first : (offered.isNotEmpty ? offered.first : null);
        subjectId = pick?['subjectId']?.toString();
        assignmentId = pick?['assignmentId']?.toString();
      }
      setState(() {
        _roster = students;
        _offered = offered;
        _subjectId = subjectId;
        _assignmentId = assignmentId;
      });
      await _prefill();
    } on DioException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_msg(e, 'Failed to load section.'))));
    }
  }

  Future<void> _prefill() async {
    final pair = _pair;
    if (pair == null || _subjectId == null) {
      setState(() => _marks = []);
      return;
    }
    final api = ref.read(apiClientProvider);
    final dateStr = DateFormat('yyyy-MM-dd').format(_date);
    try {
      final res = await api.dio.get('/api/teacher/advisory/attendance', queryParameters: {
        'date': dateStr,
        'sectionId': pair.sectionId,
        'subjectId': _subjectId,
        'slot': 1,
      });
      final marks = [for (final m in (res.data['marks'] as List? ?? [])) Map<String, dynamic>.from(m as Map)];
      // Merge prefill statuses onto the section roster (roster is the ONLY
      // student source; prefill only supplies statuses).
      final byId = {for (final m in marks) m['studentId']?.toString(): m['status']};
      setState(() {
        _marks = [
          for (final s in _roster)
            {'studentId': s['studentId'], 'name': s['name'], 'status': (byId[s['studentId']?.toString()] ?? 'present').toString()},
        ];
      });
    } catch (_) {
      setState(() {
        _marks = [for (final s in _roster) {'studentId': s['studentId'], 'name': s['name'], 'status': 'present'}];
      });
    }
  }

  Future<void> _submit() async {
    final pair = _pair;
    final term = ref.read(termProvider);
    if (pair == null || _subjectId == null || term == null) return;
    final body = <String, dynamic>{
      'sectionId': pair.sectionId,
      'termId': term.id,
      'date': DateFormat('yyyy-MM-dd').format(_date),
      'subjectId': _subjectId,
      'slot': 1,
      'records': [for (final m in _marks) {'studentId': m['studentId'], 'status': m['status'] ?? 'present'}],
    };
    final aid = _assignmentId;
    if (aid != null) body['assignmentId'] = aid;
    final conn = await Connectivity().checkConnectivity();
    if (conn.contains(ConnectivityResult.none)) {
      await ref.read(outboxProvider).enqueue(method: 'POST', path: '/api/attendance/bulk', body: body);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Offline — queued for sync.')));
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(apiClientProvider).dio.post('/api/attendance/bulk', data: body);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Attendance submitted.')));
    } on DioException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_msg(e, 'Submit failed.'))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _msg(DioException e, String fallback) {
    final d = e.response?.data;
    if (d is Map && d['error'] is Map) return d['error']['message']?.toString() ?? fallback;
    return fallback;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList());
    if (_error != null) {
      return ErrorView(message: _error!, onRetry: _loadPairs);
    }
    if (_pairs.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: ZEmpty(icon: Icons.class_outlined, title: 'No teaching load', subtitle: 'Link your timetable code or ask the Master Teacher. Classes from My Classes appear here.'),
      );
    }
    String subjectName = '';
    for (final o in _offered) {
      if (o['subjectId']?.toString() == _subjectId) {
        subjectName = o['name']?.toString() ?? '';
        break;
      }
    }
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Column(children: [
          DropdownButtonFormField<String>(
            initialValue: _pair?.key,
            decoration: const InputDecoration(labelText: 'Class'),
            items: [
              for (final p in _pairs)
                DropdownMenuItem(value: p.key, child: Text('${p.subjectName} · ${p.sectionName}', style: const TextStyle(fontSize: 13))),
            ],
            onChanged: (v) async {
              final next = _pairs.where((p) => p.key == v).toList();
              if (next.isEmpty) return;
              setState(() {
                _pair = next.first;
                _subjectId = null;
                _marks = [];
              });
              await _loadSection();
            },
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: _subjectId,
                decoration: const InputDecoration(labelText: 'Subject'),
                items: [for (final s in _offered) DropdownMenuItem(value: s['subjectId']?.toString(), child: Text(s['name']?.toString() ?? '', style: const TextStyle(fontSize: 13)))],
                onChanged: (v) async {
                  final match = _offered.where((o) => o['subjectId']?.toString() == v).toList();
                  setState(() {
                    _subjectId = v;
                    _assignmentId = match.isEmpty ? null : match.first['assignmentId']?.toString();
                  });
                  await _prefill();
                },
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: () async {
                final picked = await showDatePicker(context: context, firstDate: DateTime.now().subtract(const Duration(days: 60)), lastDate: DateTime.now(), initialDate: _date);
                if (picked != null) {
                  setState(() => _date = picked);
                  _prefill();
                }
              },
              child: Text(DateFormat('MMM d').format(_date), style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
            ),
          ]),
          if (subjectName.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(children: [Expanded(child: Text(subjectName, style: Theme.of(context).textTheme.bodySmall))]),
            ),
        ]),
      ),
      Expanded(
        child: _marks.isEmpty
            ? const Padding(
                padding: EdgeInsets.all(16),
                child: ZEmpty(icon: Icons.fact_check_outlined, title: 'No roster', subtitle: 'Pick a class with an elapsed meetup.'),
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                itemCount: _marks.length,
                separatorBuilder: (context, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final m = _marks[i];
                  return ZCard(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(children: [
                      Expanded(child: Text(m['name']?.toString() ?? m['studentId'].toString(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                      SegTabs<String>(
                        values: const ['present', 'absent', 'late', 'excused'],
                        labels: const ['P', 'A', 'L', 'E'],
                        selected: (m['status'] ?? 'present').toString(),
                        onChanged: (v) => setState(() => _marks[i] = {...m, 'status': v}),
                      ),
                    ]),
                  );
                },
              ),
      ),
      Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(width: double.infinity, child: FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? 'Submitting…' : 'Submit attendance'))),
      ),
    ]);
  }
}
