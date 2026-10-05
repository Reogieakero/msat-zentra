// Adviser attendance — per-subject workspace.
// GET /api/attendance/subjects?sectionId -> offered subjects
// GET /api/teacher/advisory/attendance?date&sectionId&subjectId&slot (prefill)
// POST /api/attendance/bulk {sectionId,termId,date,subjectId,assignmentId,slot,records}
// Rules (backend-enforced, mirrored client-side): PH-day, no future/weekends,
// past locked except same-week Mon-Sun grace. Offline -> outbox.

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/session.dart';
import '../../core/sync_outbox.dart';

class AdviserAttendancePage extends ConsumerStatefulWidget {
  const AdviserAttendancePage({super.key});
  @override
  ConsumerState<AdviserAttendancePage> createState() => _State();
}

class _State extends ConsumerState<AdviserAttendancePage> {
  DateTime _date = DateTime.now();
  String? _subjectId;
  List<Map<String, dynamic>> _subjects = [];
  List<Map<String, dynamic>> _marks = [];
  bool _busy = false;

  Future<void> _loadSubjects() async {
    final api = ref.read(apiClientProvider);
    final overview = await ref.read(overviewProvider.future);
    final sectionId = overview['advisorySection']?['id'] as String?;
    if (sectionId == null) return;
    try {
      final res = await api.dio.get('/api/attendance/subjects', queryParameters: {'sectionId': sectionId});
      setState(() => _subjects = [for (final s in (res.data['subjects'] as List? ?? [])) Map<String, dynamic>.from(s as Map)]);
      if (_subjects.isNotEmpty && _subjectId == null) _subjectId = _subjects.first['id'] as String?;
      await _prefill();
    } on DioException catch (e) {
      if (mounted) {
        try {
          api.throwApi(e);
        } catch (ae) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ae.toString())));
        }
      }
    }
  }

  Future<void> _prefill() async {
    if (_subjectId == null) return;
    final api = ref.read(apiClientProvider);
    final overview = await ref.read(overviewProvider.future);
    final sectionId = overview['advisorySection']?['id'] as String?;
    if (sectionId == null) return;
    final dateStr = DateFormat('yyyy-MM-dd').format(_date);
    try {
      final res = await api.dio.get('/api/teacher/advisory/attendance', queryParameters: {'date': dateStr, 'sectionId': sectionId, 'subjectId': _subjectId, 'slot': 1});
      setState(() => _marks = [for (final m in (res.data['marks'] as List? ?? [])) Map<String, dynamic>.from(m as Map)]);
    } catch (_) {
      setState(() => _marks = []);
    }
  }

  Future<void> _submit() async {
    if (_subjectId == null) return;
    final api = ref.read(apiClientProvider);
    final overview = await ref.read(overviewProvider.future);
    final sectionId = overview['advisorySection']?['id'] as String?;
    final term = ref.read(termProvider);
    if (sectionId == null || term == null) return;
    final body = {
      'sectionId': sectionId,
      'termId': term.id,
      'date': DateFormat('yyyy-MM-dd').format(_date),
      'subjectId': _subjectId,
      'slot': 1,
      'records': [for (final m in _marks) {'studentId': m['studentId'], 'status': m['status'] ?? 'present'}],
    };
    final conn = await Connectivity().checkConnectivity();
    if (conn.contains(ConnectivityResult.none)) {
      await ref.read(outboxProvider).enqueue(method: 'POST', path: '/api/attendance/bulk', body: body);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Offline — queued for sync.')));
      return;
    }
    setState(() => _busy = true);
    try {
      await api.dio.post('/api/attendance/bulk', data: body);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Attendance submitted.')));
    } on DioException catch (e) {
      try {
        api.throwApi(e);
      } catch (ae) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ae.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _loadSubjects();
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: _subjectId,
              decoration: const InputDecoration(labelText: 'Subject'),
              items: [for (final s in _subjects) DropdownMenuItem(value: s['id'] as String, child: Text(s['name']?.toString() ?? ''))],
              onChanged: (v) {
                setState(() => _subjectId = v);
                _prefill();
              },
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: () async {
              final picked = await showDatePicker(context: context, firstDate: DateTime.now().subtract(const Duration(days: 60)), lastDate: DateTime.now(), initialDate: _date);
              if (picked != null) {
                setState(() => _date = picked);
                _prefill();
              }
            },
            child: Text(DateFormat('MMM d').format(_date)),
          ),
        ]),
      ),
      Expanded(
        child: _marks.isEmpty
            ? const Center(child: Text('No roster / pick a subject + date.'))
            : ListView.builder(
                itemCount: _marks.length,
                itemBuilder: (_, i) {
                  final m = _marks[i];
                  return ListTile(
                    title: Text(m['name']?.toString() ?? m['studentId'].toString()),
                    trailing: DropdownButton<String>(
                      value: (m['status'] ?? 'present').toString(),
                      items: const [DropdownMenuItem(value: 'present', child: Text('Present')), DropdownMenuItem(value: 'absent', child: Text('Absent')), DropdownMenuItem(value: 'late', child: Text('Late')), DropdownMenuItem(value: 'excused', child: Text('Excused'))],
                      onChanged: (v) => setState(() => _marks[i] = {...m, 'status': v}),
                    ),
                  );
                },
              ),
      ),
      Padding(padding: const EdgeInsets.all(12), child: FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? 'Submitting…' : 'Submit attendance'))),
    ]);
  }
}
