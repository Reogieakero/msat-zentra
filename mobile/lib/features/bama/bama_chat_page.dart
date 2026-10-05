// Chat with Bama — adviser-only filing surface.
// Pre-configured reply wizard (see bama_flow.dart). Each step posts nothing
// until the end: POST /api/anecdotal with the collected fields.
// Drafts persist in Hive (bamaBox) so switching threads never strands flow.

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/sync_outbox.dart';
import 'bama_flow.dart';

class BamaMessage {
  final bool fromUser;
  final String text;
  final List<String>? options;
  final String? optionKind; // student|class|category|tier
  BamaMessage({required this.fromUser, required this.text, this.options, this.optionKind});
}

class BamaChatPage extends ConsumerStatefulWidget {
  const BamaChatPage({super.key});
  @override
  ConsumerState<BamaChatPage> createState() => _State();
}

class _State extends ConsumerState<BamaChatPage> {
  final _flow = FlowSnapshot();
  final _msgs = <BamaMessage>[BamaMessage(fromUser: false, text: 'Hi! I\'m Bama. Who is this report for? Pick a student to start.')];
  final _draft = TextEditingController();
  List<Map<String, dynamic>> _students = [];
  List<Map<String, dynamic>> _classes = [];
  bool _filing = false;

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.get('/api/anecdotal/options');
      setState(() {
        _students = [for (final s in (res.data['students'] as List? ?? [])) Map<String, dynamic>.from(s as Map)];
        _classes = [for (final c in (res.data['sectionClasses'] as List? ?? [])) Map<String, dynamic>.from(c as Map)];
      });
      _persist();
    } catch (_) {
      // Offline: restore last draft so filing can continue later.
      final box = Hive.box(AppConfig.bamaBox);
      final saved = box.get('flow');
      if (saved is Map) {
        final f = FlowSnapshot.fromJson(Map<String, dynamic>.from(saved));
        setState(() {
          _flow.studentId = f.studentId;
          _flow.classKey = f.classKey;
          _flow.category = f.category;
          _flow.tier = f.tier;
          _flow.observationDate = f.observationDate;
          _flow.incident = f.incident;
          _flow.location = f.location;
          _flow.notes = f.notes;
          _flow.classPerf = f.classPerf;
          _flow.attendance = f.attendance;
          _flow.textQuestion = f.textQuestion;
        });
      }
    }
  }

  void _persist() => Hive.box(AppConfig.bamaBox).put('flow', _flow.toJson());

  void _say(String text, {List<String>? options, String? kind}) {
    setState(() => _msgs.add(BamaMessage(fromUser: false, text: text, options: options, optionKind: kind)));
  }

  void _pickStudent(String id) {
    final s = _students.firstWhere((e) => e['id'] == id, orElse: () => {});
    if (s.isEmpty || _flow.studentId.isNotEmpty) return;
    _flow.studentId = id;
    _persist();
    setState(() => _msgs.add(BamaMessage(fromUser: true, text: s['name']?.toString() ?? id)));
    final sectionClasses = _classes.where((c) => c['sectionId'] == s['sectionId']).toList();
    _say('Which class is this report for?', options: [for (final c in sectionClasses) '${c['subjectId']}|${c['sectionId']}|${c['termId']}'], kind: 'class');
  }

  void _pick(String value, String kind) {
    setState(() => _msgs.add(BamaMessage(fromUser: true, text: value)));
    if (kind == 'class') {
      _flow.classKey = value;
      _persist();
      _say('What is the category for this report?', options: anecdotalCategories, kind: 'category');
    } else if (kind == 'category') {
      _flow.category = value;
      _persist();
      _say('What is the confidentiality tier?', options: anecdotalTiers, kind: 'tier');
    } else if (kind == 'tier') {
      _flow.tier = value;
      _flow.observationDate = DateTime.now().toIso8601String().split('T').first;
      _flow.textQuestion = TextQuestion.incident;
      _persist();
      _say(textQuestionLabels[TextQuestion.incident]!);
    }
  }

  Future<void> _sendText() async {
    final v = _draft.text.trim();
    if (v.isEmpty || _flow.textQuestion == null) return;
    setState(() => _msgs.add(BamaMessage(fromUser: true, text: v)));
    _draft.clear();
    switch (_flow.textQuestion!) {
      case TextQuestion.incident:
        _flow.incident = v;
        break;
      case TextQuestion.location:
        _flow.location = v;
        break;
      case TextQuestion.notes:
        _flow.notes = v;
        break;
      case TextQuestion.classPerformance:
        _flow.classPerf = v;
        break;
      case TextQuestion.attendance:
        _flow.attendance = v;
        break;
    }
    _flow.textQuestion = nextQuestion[_flow.textQuestion];
    _persist();
    if (_flow.textQuestion != null) {
      _say(textQuestionLabels[_flow.textQuestion]!);
    } else {
      _flow.previewShown = true;
      _persist();
      _say('Review and tap File record when ready:\n${_flow.incident}\n@${_flow.location}');
    }
    setState(() {});
  }

  Future<void> _file() async {
    if (_flow.studentId.isEmpty || _flow.category == null || _flow.incident.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pick a student, category and describe the incident first.')));
      return;
    }
    final parts = _flow.classKey.split('|');
    final sectionId = parts.length >= 2 ? parts[1] : null;
    final termId = parts.length >= 3 ? parts[2] : null;
    if (sectionId == null || termId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pick a class for this report.')));
      return;
    }
    final body = {
      'studentId': _flow.studentId,
      'sectionId': sectionId,
      'termId': termId,
      'observationDatetime': DateTime.now().toIso8601String(),
      'descriptionOfIncident': _flow.incident.trim(),
      'descriptionOfLocation': _flow.location.isEmpty ? 'Classroom' : _flow.location,
      'notesRecommendationsActions': _flow.notes,
      'classPerformance': _flow.classPerf.isEmpty ? null : _flow.classPerf,
      'attendanceSummary': _flow.attendance.isEmpty ? null : _flow.attendance,
      'category': _flow.category,
      'confidentialityLevel': _flow.tier ?? 'restricted',
    };
    final conn = await Connectivity().checkConnectivity();
    if (conn.contains(ConnectivityResult.none)) {
      await ref.read(outboxProvider).enqueue(method: 'POST', path: '/api/anecdotal', body: body);
      _say('Saved offline — will file when you reconnect.');
      return;
    }
    setState(() => _filing = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post('/api/anecdotal', data: body);
      await Hive.box(AppConfig.bamaBox).delete('flow');
      _say('Anecdotal record filed. You can now refer it from Referrals if needed.');
    } on DioException catch (e) {
      final d = e.response?.data;
      final msg = d is Map && d['error'] is Map ? d['error']['message'].toString() : 'Could not file record.';
      _say('Filing failed: $msg');
    } finally {
      if (mounted) setState(() => _filing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Expanded(
        child: ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: _msgs.length,
          itemBuilder: (_, i) {
            final m = _msgs[i];
            return Align(
              alignment: m.fromUser ? Alignment.centerRight : Alignment.centerLeft,
              child: Card(
                color: m.fromUser ? Theme.of(context).colorScheme.primaryContainer : null,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(m.text),
                    if (m.options != null)
                      Wrap(
                        spacing: 6,
                        children: [
                          for (final o in m.options!.take(12))
                            ActionChip(
                              label: Text(o.length > 28 ? '${o.substring(0, 28)}…' : o),
                              onPressed: () => m.optionKind == null ? _pick(o, 'category') : _pick(o, m.optionKind!),
                            ),
                          if (m.optionKind == 'student' || (m.text.contains('student') && _students.isNotEmpty))
                            for (final s in _students.take(10))
                              ActionChip(label: Text((s['name'] ?? '').toString()), onPressed: () => _pickStudent(s['id'].toString())),
                        ],
                      ),
                  ]),
                ),
              ),
            );
          },
        ),
      ),
      if (_flow.textQuestion != null || _msgs.length <= 2)
        Padding(
          padding: const EdgeInsets.all(8),
          child: Row(children: [
            Expanded(child: TextField(controller: _draft, decoration: InputDecoration(hintText: _flow.textQuestion != null ? textQuestionLabels[_flow.textQuestion] : 'Type…'), onSubmitted: (_) => _sendText())),
            IconButton(icon: const Icon(Icons.send), onPressed: _sendText),
          ]),
        ),
      if (_flow.previewShown)
        Padding(padding: const EdgeInsets.all(8), child: FilledButton(onPressed: _filing ? null : _file, child: Text(_filing ? 'Filing…' : 'File record'))),
    ]);
  }
}
