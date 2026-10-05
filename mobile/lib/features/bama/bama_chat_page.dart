// Chat with Bama — full web messaging parity (adviser-only filing surface).
// Threads (anecdotal wizard + grade-flag free-chat stub), welcome cards,
// inline picker cards, datetime sheet, preview card, confirm sheet, staged
// filing progress, filed cards, ended bar, delete flow, Hive persistence.
// Ports: BamaChat.tsx, BamaThread, BamaSidebar, BamaComposer, BamaFlowDialogs,
// useAnecdotalFlow.ts, bama-conversations.ts. No record preview (toast only).

import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/session.dart';
import '../../core/sync_outbox.dart';
import '../adviser/advisory_list_page.dart' show advisoryProvider, archivedAdvisoryProvider;
import '../referral/referral_page.dart' show referralsProvider;
import 'bama_conversations.dart';
import 'bama_flow.dart';

class BamaChatPage extends ConsumerStatefulWidget {
  const BamaChatPage({super.key});
  @override
  ConsumerState<BamaChatPage> createState() => _State();
}

class _State extends ConsumerState<BamaChatPage> {
  List<BamaConversation> _convos = [];
  String? _activeId;
  bool _hydrated = false;
  int _nextMsgId = 1;
  Map<String, FlowSnapshot> _flows = {};

  final _draft = TextEditingController();
  final _studentQ = TextEditingController();
  final _scroll = ScrollController();
  List<Map<String, dynamic>> _students = [];
  List<Map<String, dynamic>> _classes = [];
  bool _optionsPending = true;

  bool _sending = false;
  bool _filing = false;
  bool _confirmFiling = false;
  int _fileProgress = 0;
  String _fileStage = '';
  String? _flowError;
  String _dateInput = '';
  String _timeInput = '';
  Timer? _replyTimer;
  Timer? _progressTimer;
  int _progressValue = 0;

  @override
  void initState() {
    super.initState();
    _hydrate();
    _loadOptions();
  }

  @override
  void dispose() {
    _replyTimer?.cancel();
    _progressTimer?.cancel();
    _draft.dispose();
    _studentQ.dispose();
    _scroll.dispose();
    super.dispose();
  }

  // --- persistence (keys mirror web localStorage) ---

  void _hydrate() {
    final box = Hive.box(AppConfig.bamaBox);
    final rawConvos = box.get('conversations');
    final flows = box.get('flows');
    setState(() {
      if (rawConvos is List) {
        _convos = [
          for (final c in rawConvos)
            if (c is Map) BamaConversation.fromJson(Map<String, dynamic>.from(c)),
        ];
        _convos.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
      }
      _activeId = box.get('activeId') as String?;
      if (_activeId != null && _convos.every((c) => c.id != _activeId)) _activeId = null;
      _nextMsgId = (box.get('nextId') as int?) ?? 1;
      if (flows is Map) {
        _flows = {
          for (final e in flows.entries)
            if (e.value is Map) e.key.toString(): FlowSnapshot.fromJson(Map<String, dynamic>.from(e.value as Map)),
        };
      }
      _hydrated = true;
    });
  }

  void _save() {
    if (!_hydrated) return;
    Hive.box(AppConfig.bamaBox).putAll({
      'conversations': [for (final c in _convos.take(50)) c.toJson()],
      'activeId': _activeId,
      'nextId': _nextMsgId,
      'flows': {for (final e in _flows.entries) e.key: e.value.toJson()},
    });
  }

  // --- selectors ---

  BamaConversation? get _active {
    for (final c in _convos) {
      if (c.id == _activeId) return c;
    }
    return null;
  }

  bool get _anecMode => _active?.type == 'anecdotal';

  FlowSnapshot _flow() => _flows.putIfAbsent(_activeId ?? '', () => FlowSnapshot());

  Map<String, String> get _sectionNames {
    final map = <String, String>{};
    for (final c in _classes) {
      final sid = c['sectionId']?.toString() ?? '';
      if (sid.isNotEmpty) map[sid] = c['sectionName']?.toString() ?? '';
    }
    return map;
  }

  Map<String, dynamic>? _studentById(String id) {
    for (final s in _students) {
      if (s['id']?.toString() == id) return s;
    }
    return null;
  }

  List<Map<String, dynamic>> get _studentMatches {
    final needle = _studentQ.text.trim().toLowerCase();
    final names = _sectionNames;
    final matches = _students.where((s) {
      if (needle.isEmpty) return true;
      return (s['name']?.toString() ?? '').toLowerCase().contains(needle) ||
          (s['lrn']?.toString() ?? '').contains(needle) ||
          (names[s['sectionId']?.toString()] ?? '').toLowerCase().contains(needle);
    }).toList();
    return matches.take(60).toList();
  }

  List<Map<String, dynamic>> _classesFor(String? sectionId) {
    if (sectionId == null) return _classes;
    return _classes.where((c) => c['sectionId']?.toString() == sectionId).toList();
  }

  Map<String, dynamic>? _selectedClass(FlowSnapshot f) {
    for (final c in _classes) {
      if ('${c['subjectId']}|${c['sectionId']}|${c['termId']}' == f.classKey) return c;
    }
    return null;
  }

  bool _canFile(FlowSnapshot f) =>
      f.incident.trim().isNotEmpty &&
      f.studentId.isNotEmpty &&
      _selectedClass(f) != null &&
      f.category != null &&
      f.tier != null &&
      f.observationDate != null &&
      !_filing;

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  void _touch(BamaConversation c) {
    c.messages.length > 200 ? c.messages.removeRange(0, c.messages.length - 200) : null;
    _bump(c);
  }

  void _bump(BamaConversation c) {
    _convos.removeWhere((e) => e.id == c.id);
    _convos.insert(0, c);
    while (_convos.length > 50) {
      _convos.removeLast();
    }
  }

  int _mid() => _nextMsgId++;

  // --- options ---

  Future<void> _loadOptions() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.get('/api/anecdotal/options');
      if (!mounted) return;
      setState(() {
        _students = [for (final s in (res.data['students'] as List? ?? [])) Map<String, dynamic>.from(s as Map)];
        _classes = [for (final c in (res.data['sectionClasses'] as List? ?? [])) Map<String, dynamic>.from(c as Map)];
        _optionsPending = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _optionsPending = false);
    }
  }

  // --- threads ---

  void _startChat(String type) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final convo = BamaConversation(
      id: bamaNewId(),
      type: type,
      title: 'New chat',
      messages: [BamaMessage(id: _mid(), fromUser: false, text: bamaGreetings[type]!, at: now)],
      updatedAt: now,
    );
    setState(() {
      _convos.insert(0, convo);
      _activeId = convo.id;
      _draft.clear();
      _studentQ.clear();
      _flowError = null;
      _dateInput = '';
      _timeInput = '';
    });
    _save();
    _scrollToBottom();
  }

  void _newChat() {
    setState(() {
      _activeId = null;
      _draft.clear();
      _flowError = null;
    });
    _save();
  }

  void _confirmDelete(BamaConversation target) {
    setState(() {
      _convos.removeWhere((c) => c.id == target.id);
      _flows.remove(target.id);
      if (_activeId == target.id) _activeId = null;
    });
    _save();
  }

  // --- anecdotal guided flow (mirrors useAnecdotalFlow) ---

  void _pushAssistant(String text, {Map<String, dynamic>? preview}) {
    final active = _active;
    if (active == null) return;
    active.messages.add(BamaMessage(id: _mid(), fromUser: false, text: text, at: DateTime.now().millisecondsSinceEpoch, preview: preview));
    _touch(active);
    setState(() {});
    _save();
    _scrollToBottom();
  }

  void _pushUser(String text) {
    final active = _active;
    if (active == null) return;
    if (active.title == 'New chat') {
      active.title = bamaTitleOf(text);
    }
    active.messages.add(BamaMessage(id: _mid(), fromUser: true, text: text, at: DateTime.now().millisecondsSinceEpoch));
    _touch(active);
    setState(() {});
    _save();
    _scrollToBottom();
  }

  void _handleStudentPick(String id) {
    final active = _active;
    if (active == null || active.filed) return;
    final f = _flow();
    if (f.studentId.isNotEmpty) return;
    final picked = _studentById(id);
    if (picked == null) return;
    final sectionClasses = _classesFor(picked['sectionId']?.toString());
    if (sectionClasses.isEmpty) {
      setState(() => _flowError = 'No classes found for that student — pick another student.');
      return;
    }
    setState(() => _flowError = null);
    f.studentId = id;
    if (active.title == 'New chat') active.title = (picked['name']?.toString() ?? 'New chat');
    _pushUser(picked['name']?.toString() ?? id);
    _pushAssistant('Which class is this report for?');
    _save();
  }

  void _handleClassPick(String key) {
    final active = _active;
    if (active == null || active.filed) return;
    final f = _flow();
    if (f.classKey.isNotEmpty) return;
    f.classKey = key;
    f.askedCategory = true;
    final picked = _selectedClass(f);
    _pushUser(picked == null ? key : '${picked['subjectName']}');
    _pushAssistant('What is the category for this report?');
    _save();
  }

  void _handleCategoryPick(String value) {
    final active = _active;
    if (active == null || active.filed) return;
    final f = _flow();
    if (f.category != null) return;
    f.category = value;
    f.askedTier = true;
    _pushUser(anecdotalCategoryLabels[value] ?? value);
    _pushAssistant('What is the confidentiality tier?');
    _save();
  }

  void _handleTierPick(String value) {
    final active = _active;
    if (active == null || active.filed) return;
    final f = _flow();
    if (f.tier != null) return;
    f.tier = value;
    f.askedDatetime = true;
    _dateInput = DateTime.now().toIso8601String().split('T').first;
    _timeInput = '';
    _pushUser(anecdotalTierLabels[value] ?? value);
    _pushAssistant('When did this happen? Pick the date of the incident below.');
    _save();
  }

  void _setTimeParts(String? hour, String? minute, String? ampm) {
    var h12 = 8;
    var min = '00';
    var ap = 'AM';
    final match = RegExp(r'^(\d{2}):(\d{2})$').firstMatch(_timeInput);
    if (match != null) {
      final h24 = int.parse(match.group(1)!);
      h12 = h24 % 12 == 0 ? 12 : h24 % 12;
      min = match.group(2)!;
      ap = h24 < 12 ? 'AM' : 'PM';
    }
    if (hour != null) h12 = int.parse(hour);
    if (minute != null) min = minute;
    if (ampm != null) ap = ampm;
    final h24 = ap == 'AM' ? h12 % 12 : (h12 % 12) + 12;
    setState(() => _timeInput = '${h24.toString().padLeft(2, '0')}:$min');
  }

  void _handleDatetimeConfirm() {
    final active = _active;
    if (active == null || active.filed) return;
    final f = _flow();
    if (_dateInput.isEmpty || f.observationDate != null) return;
    f.observationDate = _dateInput;
    f.observationTime = _timeInput;
    final when = _timeInput.length >= 5 ? '$_dateInput at $_timeInput' : _dateInput;
    _pushUser(when);
    f.textQuestion = TextQuestion.incident;
    _pushAssistant(textQuestionLabels[TextQuestion.incident]!);
    _save();
  }

  void _handleAnecSend() {
    final active = _active;
    if (active == null || active.filed || _filing) return;
    final f = _flow();
    if (f.textQuestion != null) {
      final value = _draft.text.trim();
      final student = _studentById(f.studentId);
      if (value.isEmpty || student == null) return;
      switch (f.textQuestion!) {
        case TextQuestion.incident:
          f.incident = value;
          break;
        case TextQuestion.location:
          f.location = value;
          break;
        case TextQuestion.notes:
          f.notes = value;
          break;
        case TextQuestion.classPerformance:
          f.classPerf = value;
          break;
        case TextQuestion.attendance:
          f.attendance = value;
          break;
      }
      _pushUser(value);
      _draft.clear();
      f.textQuestion = nextQuestion[f.textQuestion];
      if (f.textQuestion != null) {
        _pushAssistant(textQuestionLabels[f.textQuestion]!);
      } else if (!f.previewShown && _selectedClass(f) != null && f.category != null && f.tier != null && f.observationDate != null) {
        f.previewShown = true;
        _pushAssistant('Review the complete record before filing:', preview: _previewOf(f));
      }
      _save();
      return;
    }
    if (_canFile(f)) setState(() => _confirmFiling = true);
  }

  Map<String, dynamic> _previewOf(FlowSnapshot f) {
    final student = _studentById(f.studentId);
    final cls = _selectedClass(f);
    final obs = f.observationTime.length >= 5 ? '${f.observationDate} ${f.observationTime}' : '${f.observationDate}';
    return {
      'studentName': student?['name']?.toString() ?? '',
      'lrn': student?['lrn']?.toString() ?? '',
      'section': _sectionNames[student?['sectionId']?.toString()] ?? '—',
      'category': anecdotalCategoryLabels[f.category] ?? '',
      'tier': anecdotalTierLabels[f.tier] ?? '',
      'location': f.location.isEmpty ? 'Classroom' : f.location,
      'incident': f.incident,
      'notes': f.notes,
      'classPerformance': f.classPerf,
      'attendanceSummary': f.attendance,
      'observationDateTime': obs,
      'filedOn': DateFormat('MMM d, y').format(DateTime.now()),
      'subjectName': cls?['subjectName']?.toString() ?? '',
    };
  }

  Future<void> _fileRecord() async {
    final active = _active;
    if (active == null || active.filed || _filing) return;
    final f = _flow();
    final student = _studentById(f.studentId);
    if (student == null) {
      setState(() => _flowError = 'Pick a student first.');
      return;
    }
    if (f.category == null || f.tier == null) {
      setState(() => _flowError = 'Answer the category and confidentiality questions above.');
      return;
    }
    final cls = _selectedClass(f);
    if (cls == null) {
      setState(() => _flowError = 'Pick a class for this report.');
      return;
    }
    if (f.observationDate == null) {
      setState(() => _flowError = 'Confirm the observation date and time.');
      return;
    }
    if (f.incident.trim().isEmpty) {
      setState(() => _flowError = 'Describe the incident first.');
      return;
    }
    final obsDateTime = f.observationTime.length >= 5
        ? DateTime.parse('${f.observationDate}T${f.observationTime}:00').toIso8601String()
        : DateTime.parse('${f.observationDate}T00:00:00').toIso8601String();
    final note = f.incident.trim();
    final body = <String, dynamic>{
      'studentId': f.studentId,
      'sectionId': cls['sectionId'],
      'termId': cls['termId'],
      'observationDatetime': obsDateTime,
      'descriptionOfIncident': note,
      'descriptionOfLocation': f.location.isEmpty ? 'Classroom' : f.location,
      'category': f.category,
      'confidentialityLevel': f.tier ?? 'restricted',
      if (f.notes.trim().isNotEmpty || f.tier == 'confidential') 'notesRecommendationsActions': f.notes.trim().isEmpty ? note : f.notes.trim(),
      if (f.classPerf.trim().isNotEmpty) 'classPerformance': f.classPerf.trim(),
      if (f.attendance.trim().isNotEmpty) 'attendanceSummary': f.attendance.trim(),
    };
    final conn = await Connectivity().checkConnectivity();
    if (conn.contains(ConnectivityResult.none)) {
      await ref.read(outboxProvider).enqueue(method: 'POST', path: '/api/anecdotal', body: body);
      _pushAssistant('Saved offline — will file when you reconnect.');
      return;
    }
    setState(() {
      _filing = true;
      _confirmFiling = false;
      _flowError = null;
      _fileProgress = 4;
      _fileStage = filingStageFor(4);
    });
    _progressValue = 4;
    _progressTimer?.cancel();
    _progressTimer = Timer.periodic(const Duration(milliseconds: 220), (_) {
      _progressValue = (_progressValue + 4 + (_progressValue % 9)).clamp(0, 97);
      if (!mounted) return;
      setState(() {
        _fileProgress = _progressValue;
        _fileStage = filingStageFor(_progressValue);
      });
    });
    try {
      await ref.read(apiClientProvider).dio.post('/api/anecdotal', data: body);
      _progressTimer?.cancel();
      if (!mounted) return;
      setState(() {
        _fileProgress = 100;
        _fileStage = 'Done — GCForm-01 ready.';
      });
      final categoryLabel = anecdotalCategoryLabels[f.category] ?? '';
      final detail = _previewOf(f)..['recordFiled'] = true;
      final name = student['name']?.toString() ?? '';
      active.messages.add(BamaMessage(id: _mid(), fromUser: true, text: '$categoryLabel — $note', at: DateTime.now().millisecondsSinceEpoch, detail: detail));
      active.messages.add(BamaMessage(id: _mid(), fromUser: false, text: 'Anecdotal record filed.', at: DateTime.now().millisecondsSinceEpoch, detail: detail));
      active.title = '$name · $categoryLabel · Filed';
      _touch(active);
      _flows.remove(active.id);
      setState(() {});
      _save();
      _scrollToBottom();
      ref.invalidate(advisoryProvider);
      ref.invalidate(archivedAdvisoryProvider);
      ref.invalidate(referralsProvider);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Anecdotal record filed · $name · $categoryLabel.')));
    } on DioException catch (e) {
      final d = e.response?.data;
      final msg = d is Map && d['error'] is Map ? d['error']['message']?.toString() ?? 'Could not file this record.' : 'Could not file this record.';
      if (!mounted) return;
      setState(() {
        _flowError = msg;
        _fileProgress = 0;
        _fileStage = '';
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not file record: $msg')));
    } finally {
      _progressTimer?.cancel();
      if (mounted) setState(() => _filing = false);
    }
  }

  // --- grade-flag free chat (stub, mirrors web 700ms fake reply) ---

  void _handleFreeSend() {
    final active = _active;
    final text = _draft.text.trim();
    if (text.isEmpty || _sending || active == null || active.filed) return;
    if (active.title == 'New chat') active.title = bamaTitleOf(text);
    active.messages.add(BamaMessage(id: _mid(), fromUser: true, text: text, at: DateTime.now().millisecondsSinceEpoch));
    _touch(active);
    setState(() {
      _draft.clear();
      _sending = true;
    });
    _save();
    _scrollToBottom();
    _replyTimer?.cancel();
    _replyTimer = Timer(const Duration(milliseconds: 700), () {
      if (!mounted) return;
      active.messages.add(
        BamaMessage(id: _mid(), fromUser: false, text: bamaFreeFollowups[active.type]!, at: DateTime.now().millisecondsSinceEpoch),
      );
      _touch(active);
      setState(() => _sending = false);
      _save();
      _scrollToBottom();
    });
  }

  void _handleSend() {
    if (_anecMode) {
      _handleAnecSend();
    } else {
      _handleFreeSend();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Adviser gate (mirrors web TeacherChatPage): subject teachers see notice.
    final overview = ref.watch(overviewProvider);
    final notAdviser = overview.maybeWhen(data: (d) => d['isAdviser'] == false, orElse: () => false);
    if (notAdviser) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Chat with Bama is available to class advisers.', textAlign: TextAlign.center),
        ),
      );
    }
    if (!_hydrated) {
      return const Center(child: Text('Loading…'));
    }
    final active = _active;
    return Stack(
      children: [
        Column(children: [
          _ThreadHeader(
            active: active,
            onChats: _openChats,
            onNew: _newChat,
          ),
          Expanded(
            child: active == null
                ? _Welcome(onStart: _startChat)
                : _ThreadView(
                    key: ValueKey(active.id),
                    active: active,
                    sending: _sending,
                    filing: _filing,
                    flow: _anecMode ? _flow() : null,
                    flowError: _flowError,
                    students: _students,
                    matches: _studentMatches,
                    studentQ: _studentQ,
                    sectionNames: _sectionNames,
                    classesFor: _classesFor,
                    optionsPending: _optionsPending,
                    dateInput: _dateInput,
                    timeInput: _timeInput,
                    onStudentPick: _handleStudentPick,
                    onClassPick: _handleClassPick,
                    onCategoryPick: _handleCategoryPick,
                    onTierPick: _handleTierPick,
                    onDateChanged: (v) => setState(() => _dateInput = v),
                    onTimeParts: _setTimeParts,
                    onDatetimeConfirm: _handleDatetimeConfirm,
                    onFileRequest: () => setState(() => _confirmFiling = true),
                    scroll: _scroll,
                  ),
          ),
          if (active != null && active.filed)
            _EndedBar(onNew: () => _startChat(active.type))
          else if (active != null)
            _Composer(
              draft: _draft,
              active: active,
              anecMode: _anecMode,
              sending: _sending,
              filing: _filing,
              flow: _anecMode ? _flow() : null,
              canFile: _anecMode ? _canFile(_flow()) : false,
              onSend: _handleSend,
              onChanged: (_) => setState(() {}),
            ),
        ]),
        if (_filing) _FilingOverlay(progress: _fileProgress, stage: _fileStage),
        if (_confirmFiling && active != null && _anecMode) _ConfirmSheet(flow: _flow(), onKeep: () => setState(() => _confirmFiling = false), onFile: _fileRecord),
      ],
    );
  }

  void _openChats() {
    final query = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.7,
          builder: (_, scroll) => Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              Row(children: [
                const Expanded(child: Text('Chats', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600))),
                FilledButton.icon(icon: const Icon(Icons.add, size: 16), label: const Text('New chat'), onPressed: () {
                  Navigator.pop(ctx);
                  _newChat();
                }),
              ]),
              const SizedBox(height: 8),
              TextField(
                controller: query,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.search, size: 18), hintText: 'Search chats…'),
                onChanged: (_) => setSheet(() {}),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Builder(builder: (_) {
                  final needle = query.text.trim().toLowerCase();
                  final shown = _convos.where((c) {
                    if (needle.isEmpty) return true;
                    return c.title.toLowerCase().contains(needle) || c.messages.any((m) => m.text.toLowerCase().contains(needle));
                  }).toList();
                  if (shown.isEmpty) {
                    return Center(child: Text(needle.isEmpty ? 'No chats yet — start one below.' : 'No chats match "$needle".'));
                  }
                  String? lastType;
                  return ListView.builder(
                    controller: scroll,
                    itemCount: shown.length,
                    itemBuilder: (_, i) {
                      final c = shown[i];
                      String? header;
                      if (lastType != c.type) {
                        lastType = c.type;
                        header = bamaTypeLabels[c.type];
                      }
                      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        if (header != null)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(4, 8, 4, 4),
                            child: Text('${header.toUpperCase()} (${_convos.where((e) => e.type == c.type).length})',
                                style: Theme.of(ctx).textTheme.labelSmall),
                          ),
                        ListTile(
                          dense: true,
                          selected: c.id == _activeId,
                          selectedTileColor: Theme.of(ctx).colorScheme.surfaceContainerLow,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                          title: Text(c.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          subtitle: Text('${c.messages.length} messages',
                              style: const TextStyle(fontSize: 12, fontFeatures: [FontFeature.tabularFigures()])),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline, size: 18),
                            onPressed: () {
                              Navigator.pop(ctx);
                              _askDelete(c);
                            },
                          ),
                          onTap: () {
                            Navigator.pop(ctx);
                            setState(() {
                              _activeId = c.id;
                              _flowError = null;
                              _confirmFiling = false;
                            });
                            _save();
                          },
                        ),
                      ]);
                    },
                  );
                }),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  void _askDelete(BamaConversation target) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Delete this chat?', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('“${target.title}” will be permanently removed. This cannot be undone.', style: Theme.of(ctx).textTheme.bodySmall),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel'))),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                onPressed: () {
                  Navigator.pop(ctx);
                  _confirmDelete(target);
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

// --- header ---

class _ThreadHeader extends StatelessWidget {
  final BamaConversation? active;
  final VoidCallback onChats;
  final VoidCallback onNew;
  const _ThreadHeader({required this.active, required this.onChats, required this.onNew});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colorScheme.outline))),
      child: Row(children: [
        IconButton(icon: const Icon(Icons.forum_outlined, size: 20), tooltip: 'Chats', onPressed: onChats),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(active?.title ?? 'Chat with Bama',
                maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            if (active != null) Text(bamaTypeLabels[active!.type] ?? '', style: theme.textTheme.bodySmall),
          ]),
        ),
        IconButton(icon: const Icon(Icons.add, size: 20), tooltip: 'New chat', onPressed: onNew),
      ]),
    );
  }
}

// --- welcome ---

class _Welcome extends StatelessWidget {
  final ValueChanged<String> onStart;
  const _Welcome({required this.onStart});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(padding: const EdgeInsets.all(24), children: [
      Center(
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(shape: BoxShape.circle, color: theme.colorScheme.primary.withValues(alpha: 0.12)),
          child: const Icon(Icons.pets, size: 28),
        ),
      ),
      const SizedBox(height: 12),
      const Center(child: Text('Chat with Bama', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
      const SizedBox(height: 4),
      Center(child: Text('Pick what this chat is for.', style: theme.textTheme.bodySmall)),
      const SizedBox(height: 16),
      for (final t in bamaChatTypes)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _TypeCard(
            title: bamaTypeLabels[t]!,
            subtitle: t == 'anecdotal' ? 'Write an incident report' : 'Raise a grade concern',
            onTap: () => onStart(t),
          ),
        ),
    ]);
  }
}

class _TypeCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  const _TypeCard({required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(6),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
              ])),
              const Icon(Icons.chevron_right, size: 18),
            ]),
          ),
        ),
      );
}

// --- thread ---

class _ThreadView extends StatelessWidget {
  final BamaConversation active;
  final bool sending;
  final bool filing;
  final FlowSnapshot? flow;
  final String? flowError;
  final List<Map<String, dynamic>> students;
  final List<Map<String, dynamic>> matches;
  final TextEditingController studentQ;
  final Map<String, String> sectionNames;
  final List<Map<String, dynamic>> Function(String?) classesFor;
  final bool optionsPending;
  final String dateInput;
  final String timeInput;
  final ValueChanged<String> onStudentPick;
  final ValueChanged<String> onClassPick;
  final ValueChanged<String> onCategoryPick;
  final ValueChanged<String> onTierPick;
  final ValueChanged<String> onDateChanged;
  final void Function(String?, String?, String?) onTimeParts;
  final VoidCallback onDatetimeConfirm;
  final VoidCallback onFileRequest;
  final ScrollController scroll;
  const _ThreadView({
    super.key,
    required this.active,
    required this.sending,
    required this.filing,
    required this.flow,
    required this.flowError,
    required this.students,
    required this.matches,
    required this.studentQ,
    required this.sectionNames,
    required this.classesFor,
    required this.optionsPending,
    required this.dateInput,
    required this.timeInput,
    required this.onStudentPick,
    required this.onClassPick,
    required this.onCategoryPick,
    required this.onTierPick,
    required this.onDateChanged,
    required this.onTimeParts,
    required this.onDatetimeConfirm,
    required this.onFileRequest,
    required this.scroll,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final f = flow;
    final anecOpen = active.type == 'anecdotal' && !active.filed && f != null;
    return ListView(
      controller: scroll,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      children: [
        for (final m in active.messages) _Bubble(message: m),
        if (sending || filing) _typingRow(theme),
        if (anecOpen) ...[
          const SizedBox(height: 4),
          if (f.studentId.isEmpty)
            _StudentPicker(
              pending: optionsPending,
              matches: matches,
              total: students.length,
              query: studentQ,
              sectionNames: sectionNames,
              onPick: onStudentPick,
            )
          else if (f.classKey.isEmpty)
            _PickCard(
              title: 'Which class is this report for?',
              children: [
                for (final c in classesFor(_studentSection(f))) _OptionButton(label: '${c['subjectName']} · ${c['sectionName']}', onTap: () => onClassPick('${c['subjectId']}|${c['sectionId']}|${c['termId']}')),
              ],
            )
          else if (f.category == null)
            _PickCard(title: 'What is the category for this report?', children: [
              for (final v in anecdotalCategories) _OptionButton(label: anecdotalCategoryLabels[v]!, onTap: () => onCategoryPick(v)),
            ])
          else if (f.tier == null)
            _PickCard(title: 'What is the confidentiality tier?', children: [
              for (final v in anecdotalTiers) _OptionButton(label: anecdotalTierLabels[v]!, onTap: () => onTierPick(v)),
            ])
          else if (f.observationDate == null)
            _DatetimeCard(
              dateInput: dateInput,
              timeInput: timeInput,
              onDateChanged: onDateChanged,
              onTimeParts: onTimeParts,
              onConfirm: onDatetimeConfirm,
            )
          else if (f.previewShown && f.textQuestion == null)
            _PreviewCard(flow: f, sectionNames: sectionNames, students: students, onFile: onFileRequest, filing: filing),
        ],
        if (flowError != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(flowError!, style: TextStyle(color: theme.colorScheme.error, fontSize: 13)),
          ),
      ],
    );
  }

  String? _studentSection(FlowSnapshot f) {
    for (final s in students) {
      if (s['id']?.toString() == f.studentId) return s['sectionId']?.toString();
    }
    return null;
  }

  Widget _typingRow(ThemeData theme) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(shape: BoxShape.circle, color: theme.colorScheme.primary.withValues(alpha: 0.12)),
            child: const Icon(Icons.pets, size: 14),
          ),
          const SizedBox(width: 8),
          const Text('Bama is typing…', style: TextStyle(fontSize: 13)),
        ]),
      );
}

class _Bubble extends StatelessWidget {
  final BamaMessage message;
  const _Bubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bubble = Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: theme.colorScheme.outline),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(message.text, style: const TextStyle(fontSize: 13, height: 1.6)),
        if (message.preview != null) _InlinePreview(preview: message.preview!),
        if (message.detail != null) const _FiledTag(),
      ]),
    );
    if (message.fromUser) {
      return Align(alignment: Alignment.centerRight, child: bubble);
    }
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        width: 28,
        height: 28,
        margin: const EdgeInsets.only(right: 8, top: 2),
        decoration: BoxDecoration(shape: BoxShape.circle, color: theme.colorScheme.primary.withValues(alpha: 0.12)),
        child: const Icon(Icons.pets, size: 14),
      ),
      Flexible(child: bubble),
    ]);
  }
}

class _InlinePreview extends StatelessWidget {
  final Map<String, dynamic> preview;
  const _InlinePreview({required this.preview});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Text row(String label, String value) => Text.rich(
          TextSpan(children: [
            TextSpan(text: '$label: ', style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600)),
            TextSpan(text: value, style: theme.textTheme.bodySmall),
          ]),
        );
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Divider(height: 1),
        const SizedBox(height: 6),
        row('Student', '${preview['studentName']} · ${preview['lrn']}'),
        row('Section', '${preview['section']}'),
        row('Category', '${preview['category']}'),
        row('Observed', '${preview['observationDateTime']}'),
      ]),
    );
  }
}

class _FiledTag extends StatelessWidget {
  const _FiledTag();
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text('Check Filed', style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
      );
}

class _PickCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget> children;
  const _PickCard({required this.title, this.subtitle, required this.children});

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            if (subtitle != null) ...[const SizedBox(height: 2), Text(subtitle!, style: Theme.of(context).textTheme.bodySmall)],
            const SizedBox(height: 8),
            for (final w in children) Padding(padding: const EdgeInsets.only(bottom: 6), child: w),
          ]),
        ),
      );
}

class _OptionButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _OptionButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => OutlinedButton(
        style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
        onPressed: onTap,
        child: Text(label, style: const TextStyle(fontSize: 13)),
      );
}

class _StudentPicker extends StatelessWidget {
  final bool pending;
  final List<Map<String, dynamic>> matches;
  final int total;
  final TextEditingController query;
  final Map<String, String> sectionNames;
  final ValueChanged<String> onPick;
  const _StudentPicker({
    required this.pending,
    required this.matches,
    required this.total,
    required this.query,
    required this.sectionNames,
    required this.onPick,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _PickCard(
      title: 'Pick a student',
      subtitle: 'Search name, LRN, or section…',
      children: [
        TextField(controller: query, decoration: const InputDecoration(prefixIcon: Icon(Icons.search, size: 18), hintText: 'Search name, LRN, or section…')),
        if (pending)
          const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Loading students…', style: TextStyle(fontSize: 13)))
        else if (matches.isEmpty)
          const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('No students match.', style: TextStyle(fontSize: 13)))
        else
          Container(
            constraints: const BoxConstraints(maxHeight: 224),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: matches.length,
              itemBuilder: (context, i) {
                final s = matches[i];
                return ListTile(
                  dense: true,
                  title: Text((s['name'] ?? '').toString(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  subtitle: Text('${s['lrn']} · ${sectionNames[s['sectionId']?.toString()] ?? ''}',
                      style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                  onTap: () => onPick(s['id'].toString()),
                );
              },
            ),
          ),
        if (!pending && total > matches.length)
          Text('${total - matches.length} more — refine your search.', style: theme.textTheme.bodySmall),
      ],
    );
  }
}

class _DatetimeCard extends StatelessWidget {
  final String dateInput;
  final String timeInput;
  final ValueChanged<String> onDateChanged;
  final void Function(String?, String?, String?) onTimeParts;
  final VoidCallback onConfirm;
  const _DatetimeCard({
    required this.dateInput,
    required this.timeInput,
    required this.onDateChanged,
    required this.onTimeParts,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    var hour = 'HH';
    var minute = 'MM';
    var ampm = '--';
    final match = RegExp(r'^(\d{2}):(\d{2})$').firstMatch(timeInput);
    if (match != null) {
      final h24 = int.parse(match.group(1)!);
      hour = (h24 % 12 == 0 ? 12 : h24 % 12).toString().padLeft(2, '0');
      minute = match.group(2)!;
      ampm = h24 < 12 ? 'AM' : 'PM';
    }
    const hours = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    final minutes = [for (var i = 0; i < 60; i++) i.toString().padLeft(2, '0')];
    return _PickCard(
      title: 'When did this happen?',
      subtitle: 'Pick the date of the incident below.',
      children: [
        OutlinedButton.icon(
          icon: const Icon(Icons.calendar_month_outlined, size: 16),
          label: Text(dateInput.isEmpty ? 'Pick a date' : dateInput, style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
          onPressed: () async {
            final today = DateTime.now();
            final picked = await showDatePicker(context: context, firstDate: DateTime(today.year - 1), lastDate: today, initialDate: today);
            if (picked != null) onDateChanged(picked.toIso8601String().split('T').first);
          },
        ),
        Row(children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: null,
              decoration: InputDecoration(labelText: 'Hour ($hour)'),
              items: [for (final h in hours) DropdownMenuItem(value: h, child: Text(h))],
              onChanged: (v) => onTimeParts(v, null, null),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: null,
              decoration: InputDecoration(labelText: 'Min ($minute)'),
              items: [for (final m in minutes) DropdownMenuItem(value: m, child: Text(m))],
              onChanged: (v) => onTimeParts(null, v, null),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: null,
              decoration: InputDecoration(labelText: ampm),
              items: const [DropdownMenuItem(value: 'AM', child: Text('AM')), DropdownMenuItem(value: 'PM', child: Text('PM'))],
              onChanged: (v) => onTimeParts(null, null, v),
            ),
          ),
        ]),
        FilledButton(onPressed: dateInput.isEmpty ? null : onConfirm, child: const Text('Confirm date')),
      ],
    );
  }
}

class _PreviewCard extends StatelessWidget {
  final FlowSnapshot flow;
  final Map<String, String> sectionNames;
  final List<Map<String, dynamic>> students;
  final VoidCallback onFile;
  final bool filing;
  const _PreviewCard({required this.flow, required this.sectionNames, required this.students, required this.onFile, required this.filing});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Map<String, dynamic>? student;
    for (final s in students) {
      if (s['id']?.toString() == flow.studentId) student = s;
    }
    final obs = flow.observationTime.length >= 5 ? '${flow.observationDate} ${flow.observationTime}' : '${flow.observationDate}';
    Widget row(String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
              width: 120,
              child: Text(label, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ),
            Expanded(child: Text(value.isEmpty ? '—' : value, style: const TextStyle(fontSize: 13))),
          ]),
        );
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(6),
        side: BorderSide(color: theme.colorScheme.primary, width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Review the complete record before filing:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          row('Student', '${student?['name'] ?? ''} · ${student?['lrn'] ?? ''}'),
          row('Section', sectionNames[student?['sectionId']?.toString()] ?? '—'),
          row('Category', anecdotalCategoryLabels[flow.category] ?? ''),
          row('Tier', anecdotalTierLabels[flow.tier] ?? ''),
          row('Observed', obs),
          row('Location', flow.location.isEmpty ? 'Classroom' : flow.location),
          row('Incident', flow.incident),
          if (flow.notes.isNotEmpty) row('Notes', flow.notes),
          if (flow.classPerf.isNotEmpty) row('Class', flow.classPerf),
          if (flow.attendance.isNotEmpty) row('Attendance', flow.attendance),
          const SizedBox(height: 8),
          FilledButton(onPressed: filing ? null : onFile, child: Text(filing ? 'Filing…' : 'File record')),
        ]),
      ),
    );
  }
}

// --- composer ---

class _Composer extends StatelessWidget {
  final TextEditingController draft;
  final BamaConversation active;
  final bool anecMode;
  final bool sending;
  final bool filing;
  final FlowSnapshot? flow;
  final bool canFile;
  final VoidCallback onSend;
  final ValueChanged<String> onChanged;
  const _Composer({
    required this.draft,
    required this.active,
    required this.anecMode,
    required this.sending,
    required this.filing,
    required this.flow,
    required this.canFile,
    required this.onSend,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final f = flow;
    final bool disabled = sending || filing || (anecMode && f?.textQuestion == null);
    final String placeholder;
    if (anecMode) {
      final q = f?.textQuestion;
      if (q != null) {
        placeholder = textQuestionPlaceholders[q]!;
      } else if (f != null && f.studentId.isNotEmpty) {
        placeholder = 'Answer the questions above — typing unlocks at each description step';
      } else {
        placeholder = 'Pick a student to begin';
      }
    } else {
      placeholder = 'Ask Bama about this grade flag…';
    }
    final q0 = f?.textQuestion;
    final String label = (anecMode && q0 != null) ? textQuestionLabels[q0]! : 'Ask Bama';
    final bool sendDisabled;
    if (sending || filing) {
      sendDisabled = true;
    } else if (anecMode) {
      sendDisabled = f?.textQuestion != null ? draft.text.trim().isEmpty || (f?.studentId.isEmpty ?? true) : !canFile;
    } else {
      sendDisabled = draft.text.trim().isEmpty;
    }
    final String sendLabel = (anecMode && f?.textQuestion == null) ? 'File record' : 'Send message';
    final String hint = sending || filing ? 'Working on it…' : 'Type your answer, then send';
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colorScheme.outline))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: theme.textTheme.labelSmall),
        const SizedBox(height: 4),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: TextField(
              controller: draft,
              enabled: !disabled,
              decoration: InputDecoration(hintText: placeholder),
              minLines: 1,
              maxLines: 4,
              maxLength: 2000,
              buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
              textInputAction: TextInputAction.send,
              onChanged: onChanged,
              onSubmitted: (_) {
                if (!sendDisabled) onSend();
              },
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(shape: BoxShape.circle, color: sendDisabled ? theme.colorScheme.surfaceContainerLow : theme.colorScheme.primary),
            child: IconButton(
              icon: Icon(Icons.arrow_upward, size: 18, color: sendDisabled ? theme.colorScheme.onSurfaceVariant : theme.colorScheme.onPrimary),
              tooltip: sendLabel,
              onPressed: sendDisabled ? null : onSend,
            ),
          ),
        ]),
        const SizedBox(height: 2),
        Text(hint, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
      ]),
    );
  }
}

// --- ended bar ---

class _EndedBar extends StatelessWidget {
  final VoidCallback onNew;
  const _EndedBar({required this.onNew});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: Theme.of(context).colorScheme.outline))),
        child: Row(children: [
          const Expanded(child: Text('This chat has ended.', style: TextStyle(fontSize: 13))),
          OutlinedButton(onPressed: onNew, child: const Text('Start new chat')),
        ]),
      );
}

// --- confirm + progress ---

class _ConfirmSheet extends StatelessWidget {
  final FlowSnapshot flow;
  final VoidCallback onKeep;
  final VoidCallback onFile;
  const _ConfirmSheet({required this.flow, required this.onKeep, required this.onFile});

  @override
  Widget build(BuildContext context) => Positioned.fill(
        child: GestureDetector(
          onTap: onKeep,
          child: Container(
            color: Theme.of(context).colorScheme.scrim.withValues(alpha: 0.45),
            child: Center(
              child: Card(
                margin: const EdgeInsets.all(24),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    const Text('File this record?', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text('This creates the anecdotal record and autofills GCForm-01.', style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: OutlinedButton(onPressed: onKeep, child: const Text('Keep editing'))),
                      const SizedBox(width: 8),
                      Expanded(child: FilledButton(onPressed: onFile, child: const Text('File record'))),
                    ]),
                  ]),
                ),
              ),
            ),
          ),
        ),
      );
}

class _FilingOverlay extends StatelessWidget {
  final int progress;
  final String stage;
  const _FilingOverlay({required this.progress, required this.stage});

  @override
  Widget build(BuildContext context) => Positioned.fill(
        child: Container(
          color: Theme.of(context).colorScheme.scrim.withValues(alpha: 0.45),
          child: Center(
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Text('Filing your record…', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                  SizedBox(width: 220, child: LinearProgressIndicator(value: progress / 100, minHeight: 6)),
                  const SizedBox(height: 8),
                  Text('$stage $progress%', style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 4),
                  Text('Please wait — don\'t close.', style: Theme.of(context).textTheme.bodySmall),
                ]),
              ),
            ),
          ),
        ),
      );
}
