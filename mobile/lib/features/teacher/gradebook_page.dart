// Gradebook workspace — mirrors web ClassWorkspace:
// GET /api/teacher/grading/classes/:assignmentId
// -> {assignment, students[], components[{type,weight,assessments[]}]}
// Actions: add component/preset, add/edit/delete assessment,
// POST /api/grades/assessments/:id/score {studentId,rawScore}, lock finals.

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/sync_outbox.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';

class GradebookPage extends ConsumerStatefulWidget {
  final String classId;
  final String title;
  const GradebookPage({super.key, required this.classId, required this.title});
  @override
  ConsumerState<GradebookPage> createState() => _State();
}

class _State extends ConsumerState<GradebookPage> {
  Map<String, dynamic>? _data;
  bool _busy = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.get('/api/teacher/grading/classes/${Uri.encodeComponent(widget.classId)}');
      setState(() {
        _data = Map<String, dynamic>.from(res.data as Map);
        _busy = false;
      });
    } on DioException catch (e) {
      final d = e.response?.data;
      final msg = d is Map && d['error'] is Map ? d['error']['message'].toString() : 'Failed to load gradebook';
      setState(() {
        _busy = false;
        _error = msg;
      });
    }
  }

  Future<void> _saveScore({required String assessmentId, required String studentId, required double raw}) async {
    final api = ref.read(apiClientProvider);
    final body = {'studentId': studentId, 'rawScore': raw};
    final conn = await Connectivity().checkConnectivity();
    if (conn.contains(ConnectivityResult.none)) {
      await ref.read(outboxProvider).enqueue(method: 'POST', path: '/api/grades/assessments/$assessmentId/score', body: body);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Offline — score queued.')));
      return;
    }
    try {
      await api.dio.post('/api/grades/assessments/$assessmentId/score', data: body);
      await _load();
    } on DioException catch (e) {
      final d = e.response?.data;
      final msg = d is Map && d['error'] is Map ? d['error']['message'].toString() : 'Save failed';
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  Future<void> _addAssessment(String componentType) async {
    final title = TextEditingController();
    final max = TextEditingController(text: '100');
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('New assessment ($componentType)'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: title, decoration: const InputDecoration(labelText: 'Title')),
          TextField(controller: max, decoration: const InputDecoration(labelText: 'Max score'), keyboardType: TextInputType.number),
        ]),
        actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Add'))],
      ),
    );
    if (ok != true) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post('/api/teacher/grading/classes/${Uri.encodeComponent(widget.classId)}/assessments', data: {
        'componentType': componentType,
        'title': title.text.trim(),
        'maxScore': double.tryParse(max.text) ?? 100,
      });
      await _load();
    } on DioException catch (e) {
      final d = e.response?.data;
      final msg = d is Map && d['error'] is Map ? d['error']['message'].toString() : 'Add failed';
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: _busy
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _GradebookBody(data: _data!, onScore: _saveScore, onAdd: _addAssessment),
    );
  }
}

class _GradebookBody extends StatelessWidget {
  final Map<String, dynamic> data;
  final Future<void> Function({required String assessmentId, required String studentId, required double raw}) onScore;
  final Future<void> Function(String componentType) onAdd;
  const _GradebookBody({required this.data, required this.onScore, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    final students = [for (final s in (data['students'] as List? ?? [])) GradebookStudent.fromJson(s as Map<String, dynamic>)];
    final components = [for (final c in (data['components'] as List? ?? [])) GradeComponent.fromJson(c as Map<String, dynamic>)];
    if (components.isEmpty) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('No components yet. Add Written Work / Performance Task / Exam.'),
          const SizedBox(height: 8),
          FilledButton(onPressed: () => onAdd('WRITTEN_WORK'), child: const Text('Add Written Work')),
        ]),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        for (final comp in components) ...[
          Row(children: [
            Expanded(child: Text('${comp.label} · ${comp.type} (${comp.weight}%)', style: Theme.of(context).textTheme.titleSmall)),
            IconButton(icon: const Icon(Icons.add), tooltip: 'Add assessment', onPressed: () => onAdd(comp.type)),
          ]),
          for (final a in comp.assessments)
            Card(
              child: ExpansionTile(
                title: Text('${a.title} (/${a.maxScore.toStringAsFixed(0)})'),
                children: [
                  for (final s in students)
                    ListTile(
                      dense: true,
                      title: Text(s.name),
                      trailing: SizedBox(
                        width: 90,
                        child: TextFormField(
                          initialValue: (a.scores[s.id]?.toString() ?? ''),
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(hintText: '—'),
                          onFieldSubmitted: (v) {
                            final raw = double.tryParse(v);
                            if (raw != null) onScore(assessmentId: a.id, studentId: s.id, raw: raw);
                          },
                        ),
                      ),
                    ),
                ],
              ),
            ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}
