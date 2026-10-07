// Chat with Bama — full web messaging parity (adviser-only filing surface).
// Threads (anecdotal wizard + grade-flag free-chat stub), welcome cards,
// inline picker cards, datetime sheet, preview card, confirm sheet, staged
// filing progress, filed cards, ended bar, delete flow, Hive persistence.
// Ports: BamaChat.tsx, BamaThread, BamaSidebar, BamaComposer, BamaFlowDialogs,
// useAnecdotalFlow.ts, bama-conversations.ts. No record preview (toast only).

import 'dart:async';
import 'dart:math' show Random;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/session.dart';
import '../../core/sync_outbox.dart';
import '../../design/brand.dart';
import '../adviser/advisory_list_page.dart' show advisoryProvider, archivedAdvisoryProvider;
import '../referral/referral_page.dart' show referralsProvider, referableProvider;
import 'bama_conversations.dart';
import 'bama_flow.dart';

class BamaChatPage extends ConsumerStatefulWidget {
  /// When true (e.g. opened via `/adviser/bama?new=1`), land on the welcome
  /// cards with no active thread — mirrors web `?new` deep-links. Threads
  /// are preserved in Chats.
  final bool freshEntry;
  const BamaChatPage({super.key, this.freshEntry = false});
  @override
  ConsumerState<BamaChatPage> createState() => _State();
}

class _State extends ConsumerState<BamaChatPage> {
  List<BamaConversation> _convos = [];
  String? _activeId;
  // Ephemeral draft: a freshly opened thread that is NOT recorded until its
  // commit point (student picked for anecdotal, first message for
  // grade-flag). Never enters _convos, never persisted — leaving without
  // committing discards it silently.
  BamaConversation? _pending;
  bool _hydrated = false;
  int _nextMsgId = 1;
  Map<String, FlowSnapshot> _flows = {};

  final _draft = TextEditingController();
  final _studentQ = TextEditingController();
  final _scroll = ScrollController();
  List<Map<String, dynamic>> _students = [];
  List<Map<String, dynamic>> _classes = [];
  bool _optionsPending = true;
  String? _optionsError;

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
    if (widget.freshEntry) {
      _activeId = null;
      _save();
    }
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
    final convos = <BamaConversation>[];
    if (rawConvos is List) {
      for (final c in rawConvos) {
        // Skip corrupt entries instead of killing the screen (Hive reads
        // maps as Map<dynamic, dynamic>; stale shapes must never crash).
        try {
          if (c is Map) convos.add(BamaConversation.fromJson(Map<String, dynamic>.from(c)));
        } catch (_) {}
      }
      convos.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    }
    final parsedFlows = <String, FlowSnapshot>{};
    if (flows is Map) {
      for (final e in flows.entries) {
        try {
          if (e.value is Map) parsedFlows[e.key.toString()] = FlowSnapshot.fromJson(Map<String, dynamic>.from(e.value as Map));
        } catch (_) {}
      }
    }
    setState(() {
      _convos = convos;
      _activeId = box.get('activeId') as String?;
      if (_activeId != null && _convos.every((c) => c.id != _activeId)) _activeId = null;
      _nextMsgId = (box.get('nextId') as int?) ?? 1;
      _flows = parsedFlows;
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
    if (_pending != null && _pending!.id == _activeId) return _pending;
    for (final c in _convos) {
      if (c.id == _activeId) return c;
    }
    return null;
  }

  bool _isPending(BamaConversation c) => _pending?.id == c.id;

  /// Record a draft thread: insert into the list and persist from now on.
  void _commitPending(BamaConversation c) {
    if (!_isPending(c)) return;
    _pending = null;
    _convos.removeWhere((e) => e.id == c.id);
    _convos.insert(0, c);
    while (_convos.length > 50) {
      _convos.removeLast();
    }
  }

  void _discardPending() {
    final pending = _pending;
    if (pending == null) return;
    _flows.remove(pending.id);
    _pending = null;
    if (_activeId == pending.id) _activeId = null;
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
    if (c.messages.length > 200) c.messages.removeRange(0, c.messages.length - 200);
    if (_isPending(c)) return;
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
      // Same source web uses (fetchAnecdotalOptions): students + classes +
      // sectionClasses scoped to the teacher's sections and active term.
      final res = await api.dio.get('/api/teacher/grade-flags/options');
      if (!mounted) return;
      setState(() {
        _students = [for (final s in (res.data['students'] as List? ?? [])) Map<String, dynamic>.from(s as Map)];
        _classes = [for (final c in (res.data['sectionClasses'] as List? ?? [])) Map<String, dynamic>.from(c as Map)];
        _optionsPending = false;
        _optionsError = null;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      final d = e.response?.data;
      final msg = d is Map && d['error'] is Map ? d['error']['message']?.toString() : null;
      setState(() {
        _optionsPending = false;
        _optionsError = msg ?? 'Couldn\'t load students. Check your connection.';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _optionsPending = false;
        _optionsError = 'Couldn\'t load students. Check your connection.';
      });
    }
  }

  // --- threads ---

  void _startDraft(String type) {
    _discardPending();
    final now = DateTime.now().millisecondsSinceEpoch;
    final id = bamaNewId();
    _flows.remove(id);
    final convo = BamaConversation(
      id: id,
      type: type,
      title: 'New chat',
      messages: [BamaMessage(id: _mid(), fromUser: false, text: bamaGreetings[type]!, at: now)],
      updatedAt: now,
    );
    setState(() {
      _pending = convo;
      _activeId = convo.id;
      _draft.clear();
      _studentQ.clear();
      _flowError = null;
      _dateInput = '';
      _timeInput = '';
      _confirmFiling = false;
    });
    _scrollToBottom();
  }

  void _startAnecdotalChat() => _startDraft('anecdotal');

  void _startGradeFlagChat() => _startDraft('grade-flag');

  void _backToWelcome() {
    _discardPending();
    setState(() {
      _activeId = null;
      _draft.clear();
      _flowError = null;
      _confirmFiling = false;
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

  /// Reset the flow back to [step] (student|class|category|tier|datetime),
  /// clearing that step and everything after it, then re-ask conversationally.
  /// Filed threads never reach here (composer/ended bar block edits).
  void _resetToStep(String step) {
    final active = _active;
    if (active == null || active.filed || active.type != 'anecdotal') return;
    final f = _flow();
    resetFlowTo(f, step);
    if (step == 'student') _studentQ.clear();
    if (step == 'datetime') {
      _dateInput = DateTime.now().toIso8601String().split('T').first;
      _timeInput = '';
    }
    setState(() {
      _flowError = null;
      _confirmFiling = false;
    });
    const prompts = {
      'student': 'No problem — who is this report for? Pick a student to start over.',
      'class': 'No problem — which class is this report for?',
      'category': 'What is the category for this report?',
      'tier': 'What is the confidentiality tier?',
      'datetime': 'When did this happen? Pick the date of the incident below.',
    };
    _pushAssistant(prompts[step]!);
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
    _commitPending(active);
    setState(() {
      _flowError = null;
      _studentQ.clear();
    });
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
      _progressValue = (_progressValue + 4 + Random().nextInt(9)).clamp(0, 97);
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
      ref.invalidate(referableProvider);
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
    _commitPending(active);
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
          if (active != null)
            _ChatHeader(
              subtitle: active.type == 'grade-flag' ? 'Grade Flag Assistant' : 'Anecdotal Record Assistant',
              onBack: _backToWelcome,
              onDelete: () => _askDelete(active),
              onEdit: _openEditSheet,
              canEdit: _anecMode && !active.filed && _flow().studentId.isNotEmpty,
            ),
          Expanded(
            child: active == null
                ? _Welcome(
                    conversations: _convos,
                    onStartAnecdotal: _startAnecdotalChat,
                    onStartGradeFlag: _startGradeFlagChat,
                    onResume: (id) => setState(() => _activeId = id),
                    onDelete: _askDelete,
                    onSeeAll: _openHistory,
                  )
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
                    onQueryChanged: () => setState(() {}),
                    sectionNames: _sectionNames,
                    classesFor: _classesFor,
                    optionsPending: _optionsPending,
                    optionsError: _optionsError,
                    onOptionsRetry: () {
                      setState(() {
                        _optionsPending = true;
                        _optionsError = null;
                      });
                      _loadOptions();
                    },
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
                    onEditStep: _resetToStep,
                    scroll: _scroll,
                  ),
          ),
          if (active != null && active.filed)
            _EndedBar(onNew: _startAnecdotalChat)
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
        if (active == null)
          _SpeedDial(
            onAnecdotal: _startAnecdotalChat,
            onGradeFlag: _startGradeFlagChat,
          ),
        if (_filing) _FilingOverlay(progress: _fileProgress, stage: _fileStage),
        if (_confirmFiling && active != null && _anecMode) _ConfirmSheet(flow: _flow(), onKeep: () => setState(() => _confirmFiling = false), onFile: _fileRecord),
      ],
    );
  }

  void _openHistory(String type) {
    context.push(
      '/adviser/bama/history?type=$type',
      extra: {
        'type': type,
        'conversations': _convos,
        'onResume': (String id) => setState(() => _activeId = id),
        'onDelete': (BamaConversation c) => _askDelete(c),
      },
    );
  }

  void _openEditSheet() {
    final active = _active;
    if (active == null || active.filed || active.type != 'anecdotal') return;
    final f = _flow();
    final student = _studentById(f.studentId);
    final cls = _selectedClass(f);
    final steps = <Map<String, String>>[];
    if (f.studentId.isNotEmpty) steps.add({'step': 'student', 'label': 'Student', 'value': student?['name']?.toString() ?? f.studentId});
    if (f.classKey.isNotEmpty) {
      steps.add({'step': 'class', 'label': 'Class', 'value': cls == null ? f.classKey : '${cls['subjectName']} · ${cls['sectionName']}'});
    }
    if (f.category != null) steps.add({'step': 'category', 'label': 'Category', 'value': anecdotalCategoryLabels[f.category] ?? f.category!});
    if (f.tier != null) steps.add({'step': 'tier', 'label': 'Confidentiality', 'value': anecdotalTierLabels[f.tier] ?? f.tier!});
    if (f.observationDate != null) {
      steps.add({
        'step': 'datetime',
        'label': 'When',
        'value': f.observationTime.length >= 5 ? '${f.observationDate} at ${f.observationTime}' : '${f.observationDate}',
      });
    }
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Change an answer', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('Jump back to a step — everything after it is asked again.', style: Theme.of(ctx).textTheme.bodySmall),
          const SizedBox(height: 8),
          if (steps.isEmpty) Text('Nothing to change yet.', style: Theme.of(ctx).textTheme.bodySmall),
          for (final s in steps)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(s['label']!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text(s['value']!, style: Theme.of(ctx).textTheme.bodySmall),
              trailing: const Icon(Icons.edit_outlined, size: 18),
              onTap: () {
                Navigator.pop(ctx);
                _resetToStep(s['step']!);
              },
            ),
        ]),
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

// --- in-chat header (message-style) ---

class _ChatHeader extends StatelessWidget {
  final String subtitle;
  final VoidCallback onBack;
  final VoidCallback onDelete;
  final VoidCallback onEdit;
  final bool canEdit;
  const _ChatHeader({required this.subtitle, required this.onBack, required this.onDelete, required this.onEdit, required this.canEdit});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colorScheme.outline))),
      child: Row(children: [
        IconButton(icon: const Icon(Icons.arrow_back, size: 20), tooltip: 'Back', onPressed: onBack),
        const BamaAvatar(radius: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Bama', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            Text(subtitle, style: theme.textTheme.bodySmall),
          ]),
        ),
        PopupMenuButton<String>(
          icon: const Icon(Icons.more_vert, size: 20),
          onSelected: (v) {
            if (v == 'edit') onEdit();
            if (v == 'delete') onDelete();
          },
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'edit', child: Text('Change answer', style: TextStyle(fontSize: 13))),
            PopupMenuItem(value: 'delete', child: Text('Delete chat', style: TextStyle(fontSize: 13))),
          ],
        ),
      ]),
    );
  }
}

// --- welcome ---

class _Welcome extends StatelessWidget {
  final VoidCallback onStartAnecdotal;
  final VoidCallback onStartGradeFlag;
  final List<BamaConversation> conversations;
  final ValueChanged<String> onResume;
  final ValueChanged<BamaConversation> onDelete;
  final ValueChanged<String> onSeeAll;
  const _Welcome({
    required this.onStartAnecdotal,
    required this.onStartGradeFlag,
    required this.conversations,
    required this.onResume,
    required this.onDelete,
    required this.onSeeAll,
  });

  List<BamaConversation> _ofType(String type) => [for (final c in conversations) if (c.type == type) c];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(padding: const EdgeInsets.fromLTRB(24, 24, 24, 170), children: [
      const Center(child: BamaAvatar(radius: 28)),
      const SizedBox(height: 12),
      const Center(child: Text('Chat with Bama', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
      const SizedBox(height: 4),
      Center(
        child: Text(
          'File anecdotal records by chatting — Bama walks you through the student, class, details, and review, then files the record.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall,
        ),
      ),
      const SizedBox(height: 16),
      _EntryCard(
        title: 'Anecdotal record',
        subtitle: 'Write an incident report',
        onTap: onStartAnecdotal,
      ),
      const SizedBox(height: 8),
      _EntryCard(
        title: 'Grade flag',
        subtitle: 'Raise a grade concern',
        onTap: onStartGradeFlag,
      ),
      const SizedBox(height: 16),
      _LogSection(
        title: 'Anecdotal logs',
        emptyText: 'No anecdotal chats yet.',
        items: _ofType('anecdotal'),
        onResume: onResume,
        onDelete: onDelete,
        onSeeAll: () => onSeeAll('anecdotal'),
      ),
      const SizedBox(height: 8),
      _LogSection(
        title: 'Grade flag logs',
        emptyText: 'No grade flag chats yet.',
        items: _ofType('grade-flag'),
        onResume: onResume,
        onDelete: onDelete,
        onSeeAll: () => onSeeAll('grade-flag'),
      ),
    ]);
  }
}

class _EntryCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  const _EntryCard({required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(6),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  Text(subtitle, style: const TextStyle(fontSize: 13)),
                ]),
              ),
              const Icon(Icons.chevron_right, size: 18),
            ]),
          ),
        ),
      );
}

class _LogSection extends StatelessWidget {
  final String title;
  final String emptyText;
  final List<BamaConversation> items;
  final ValueChanged<String> onResume;
  final ValueChanged<BamaConversation> onDelete;
  final VoidCallback onSeeAll;
  const _LogSection({
    required this.title,
    required this.emptyText,
    required this.items,
    required this.onResume,
    required this.onDelete,
    required this.onSeeAll,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final recent = items.take(3).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: Text(title, style: theme.textTheme.labelSmall)),
        if (items.isNotEmpty)
          TextButton(
            style: TextButton.styleFrom(visualDensity: VisualDensity.compact, padding: const EdgeInsets.symmetric(horizontal: 8)),
            onPressed: onSeeAll,
            child: Text('See all (${items.length})', style: const TextStyle(fontSize: 12)),
          ),
      ]),
      const SizedBox(height: 4),
      if (recent.isEmpty)
        Text(emptyText, style: theme.textTheme.bodySmall)
      else
        for (final c in recent)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Card(
              margin: EdgeInsets.zero,
              child: ListTile(
                dense: true,
                title: Text(c.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                subtitle: Text(
                  '${c.messages.length} messages${c.filed ? ' · Filed' : ''}',
                  style: const TextStyle(fontSize: 12, fontFeatures: [FontFeature.tabularFigures()]),
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline, size: 18),
                  onPressed: () => onDelete(c),
                ),
                onTap: () => onResume(c.id),
              ),
            ),
          ),
    ]);
  }
}

class _SpeedDial extends StatefulWidget {
  final VoidCallback onAnecdotal;
  final VoidCallback onGradeFlag;
  const _SpeedDial({required this.onAnecdotal, required this.onGradeFlag});

  @override
  State<_SpeedDial> createState() => _SpeedDialState();
}

class _SpeedDialState extends State<_SpeedDial> with SingleTickerProviderStateMixin {
  bool _expanded = false;
  late final AnimationController _turns;

  @override
  void initState() {
    super.initState();
    _turns = AnimationController(vsync: this, duration: const Duration(milliseconds: 150));
  }

  @override
  void dispose() {
    _turns.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() => _expanded = !_expanded);
    if (_expanded) {
      _turns.forward();
    } else {
      _turns.reverse();
    }
  }

  @override
  Widget build(BuildContext context) => Positioned(
        right: 16,
        bottom: 88,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
          SizeTransition(
            sizeFactor: CurvedAnimation(parent: _turns, curve: Curves.easeOut),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
              _DialOption(
                label: 'Anecdotal',
                icon: Icons.note_outlined,
                onTap: () {
                  _toggle();
                  widget.onAnecdotal();
                },
              ),
              const SizedBox(height: 8),
              _DialOption(
                label: 'Grade flag',
                icon: Icons.flag_outlined,
                onTap: () {
                  _toggle();
                  widget.onGradeFlag();
                },
              ),
              const SizedBox(height: 8),
            ]),
          ),
          FloatingActionButton(
            tooltip: _expanded ? 'Close' : 'New chat',
            onPressed: _toggle,
            child: RotationTransition(
              turns: Tween(begin: 0.0, end: 0.125).animate(_turns),
              child: Icon(_expanded ? Icons.close : Icons.add),
            ),
          ),
        ]),
      );
}

class _DialOption extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _DialOption({required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            color: Theme.of(context).colorScheme.surfaceContainerLow,
            border: Border.all(color: Theme.of(context).colorScheme.outline),
          ),
          child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        ),
        const SizedBox(width: 8),
        FloatingActionButton.small(
          heroTag: 'bama-dial-$label',
          tooltip: label,
          onPressed: onTap,
          child: Icon(icon, size: 18),
        ),
      ]);
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
  final VoidCallback onQueryChanged;
  final Map<String, String> sectionNames;
  final List<Map<String, dynamic>> Function(String?) classesFor;
  final bool optionsPending;
  final String? optionsError;
  final VoidCallback onOptionsRetry;
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
  final ValueChanged<String> onEditStep;
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
    required this.onQueryChanged,
    required this.sectionNames,
    required this.classesFor,
    required this.optionsPending,
    required this.optionsError,
    required this.onOptionsRetry,
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
    required this.onEditStep,
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
              onQueryChanged: onQueryChanged,
              loadError: optionsError,
              onRetry: onOptionsRetry,
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
            _PreviewCard(
              flow: f,
              sectionNames: sectionNames,
              students: students,
              onFile: onFileRequest,
              filing: filing,
              onEditStep: onEditStep,
            ),
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
          const BamaAvatar(radius: 14),
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
      const Padding(
        padding: EdgeInsets.only(right: 8, top: 2),
        child: BamaAvatar(radius: 14),
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
  final String? loadError;
  final VoidCallback onRetry;
  final List<Map<String, dynamic>> matches;
  final int total;
  final TextEditingController query;
  final VoidCallback onQueryChanged;
  final Map<String, String> sectionNames;
  final ValueChanged<String> onPick;
  const _StudentPicker({
    required this.pending,
    required this.loadError,
    required this.onRetry,
    required this.matches,
    required this.total,
    required this.query,
    required this.onQueryChanged,
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
        TextField(
          controller: query,
          decoration: const InputDecoration(prefixIcon: Icon(Icons.search, size: 18), hintText: 'Search name, LRN, or section…'),
          onChanged: (_) => onQueryChanged(),
        ),
        if (pending)
          const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Loading students…', style: TextStyle(fontSize: 13)))
        else if (loadError != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(loadError!, style: TextStyle(color: theme.colorScheme.error, fontSize: 13)),
              const SizedBox(height: 6),
              OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
            ]),
          )
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
  final ValueChanged<String> onEditStep;
  const _PreviewCard({required this.flow, required this.sectionNames, required this.students, required this.onFile, required this.filing, required this.onEditStep});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Map<String, dynamic>? student;
    for (final s in students) {
      if (s['id']?.toString() == flow.studentId) student = s;
    }
    final obs = flow.observationTime.length >= 5 ? '${flow.observationDate} ${flow.observationTime}' : '${flow.observationDate}';
    Widget row(String label, String value, {String? editStep}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
              width: 100,
              child: Text(label, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ),
            Expanded(child: Text(value.isEmpty ? '—' : value, style: const TextStyle(fontSize: 13))),
            if (editStep != null)
              InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: () => onEditStep(editStep),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  child: Text('Edit', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ),
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
          row('Student', '${student?['name'] ?? ''} · ${student?['lrn'] ?? ''}', editStep: 'student'),
          row('Section', sectionNames[student?['sectionId']?.toString()] ?? '—'),
          row('Category', anecdotalCategoryLabels[flow.category] ?? '', editStep: 'category'),
          row('Tier', anecdotalTierLabels[flow.tier] ?? '', editStep: 'tier'),
          row('Observed', obs, editStep: 'datetime'),
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
