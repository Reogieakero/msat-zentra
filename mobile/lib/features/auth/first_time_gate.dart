// First-time gate — decides Adviser vs Subject Teacher home.
// GET /api/teacher/overview?scope=critical -> {isAdviser, advisorySection}
// GET /api/teacher/schedule/teachers/me -> {teacherName, termGrant}
// Claim: POST .../teachers/claim {code}; Verify: POST .../verify-attendance {code}
// or adviser tap-through POST .../teachers/term-grant.

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/session.dart';
import '../../shared/widgets.dart';

class FirstTimeGate extends ConsumerStatefulWidget {
  const FirstTimeGate({super.key});
  @override
  ConsumerState<FirstTimeGate> createState() => _GateState();
}

class _GateState extends ConsumerState<FirstTimeGate> {
  Map<String, dynamic>? _me;
  bool _busy = true;
  String? _error;
  final _code = TextEditingController();

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
      final me = (await api.dio.get('/api/teacher/schedule/teachers/me')).data as Map<String, dynamic>;
      // Ensure overview (sets role) is ready before routing.
      await ref.read(overviewProvider.future);
      setState(() {
        _me = me;
        _busy = false;
      });
    } on DioException catch (e) {
      String msg = 'Failed to load workspace.';
      final d = e.response?.data;
      if (d is Map && d['error'] is Map) msg = d['error']['message']?.toString() ?? msg;
      setState(() {
        _busy = false;
        _error = msg;
      });
    }
  }

  Future<void> _claim() async {
    final api = ref.read(apiClientProvider);
    try {
      await api.dio.post('/api/teacher/schedule/teachers/claim', data: {'code': _code.text.trim()});
      await _load();
    } on DioException catch (e) {
      final d = e.response?.data;
      final msg = d is Map && d['error'] is Map ? d['error']['message'].toString() : 'Claim failed';
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  Future<void> _verify() async {
    final api = ref.read(apiClientProvider);
    try {
      await api.dio.post('/api/teacher/schedule/teachers/verify-attendance', data: {'code': _code.text.trim()});
      await _load();
    } on DioException catch (e) {
      final d = e.response?.data;
      final msg = d is Map && d['error'] is Map ? d['error']['message'].toString() : 'Verification failed';
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  Future<void> _adviserTapThrough() async {
    final api = ref.read(apiClientProvider);
    try {
      await api.dio.post('/api/teacher/schedule/teachers/term-grant', data: {});
      await _load();
    } on DioException catch (e) {
      final d = e.response?.data;
      final msg = d is Map && d['error'] is Map ? d['error']['message'].toString() : 'Failed';
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_busy) return const Scaffold(body: LoadingView(label: 'Preparing workspace…'));
    if (_error != null) return Scaffold(body: ErrorView(message: _error!, onRetry: _load));
    final overview = ref.watch(overviewProvider);
    return overview.when(
      loading: () => const Scaffold(body: LoadingView()),
      error: (e, _) => Scaffold(body: ErrorView(message: e.toString(), onRetry: () => ref.invalidate(overviewProvider))),
      data: (data) {
        final isAdviser = data['isAdviser'] == true;
        final teacherName = _me?['teacherName'];
        final grant = _me?['termGrant'];
        if (teacherName == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Link your classes')),
            body: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(children: [
                const Text('First time here? Enter the link code from your Master Teacher to attach your timetable slots.'),
                const SizedBox(height: 12),
                TextField(controller: _code, decoration: const InputDecoration(labelText: 'Link code (e.g. MS-101)')),
                const SizedBox(height: 12),
                FilledButton(onPressed: _claim, child: const Text('Link classes')),
              ]),
            ),
          );
        }
        if (grant == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Verify for this term')),
            body: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(children: [
                Text('Hi ${teacherName['name'] ?? ''} — verify access for this term to take attendance and encode grades.'),
                const SizedBox(height: 12),
                TextField(controller: _code, decoration: const InputDecoration(labelText: 'Attendance code')),
                const SizedBox(height: 12),
                FilledButton(onPressed: _verify, child: const Text('Verify')),
                if (isAdviser) ...[
                  const SizedBox(height: 8),
                  OutlinedButton(onPressed: _adviserTapThrough, child: const Text('Continue as adviser (tap-through)')),
                ],
              ]),
            ),
          );
        }
        // Ready — route by role.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) context.go(isAdviser ? '/adviser' : '/teacher');
        });
        return const Scaffold(body: LoadingView(label: 'Opening workspace…'));
      },
    );
  }
}
