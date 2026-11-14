import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widget_previews.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/session.dart';
import '../../shared/user_messages.dart';
import '../../shared/widgets.dart';
import '../adviser/adviser_schedule_page.dart';
import 'overview_data.dart';

class OverviewPage extends ConsumerStatefulWidget {
  const OverviewPage({super.key});
  @override
  ConsumerState<OverviewPage> createState() => _OverviewPageState();
}

class _OverviewPageState extends ConsumerState<OverviewPage>
    with WidgetsBindingObserver {
  Timer? _timer;
  Future<void>? _refreshFlight;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (_visible) unawaited(_refresh());
    });
  }

  bool get _visible =>
      mounted &&
      WidgetsBinding.instance.lifecycleState != AppLifecycleState.paused &&
      WidgetsBinding.instance.lifecycleState != AppLifecycleState.inactive &&
      WidgetsBinding.instance.lifecycleState != AppLifecycleState.hidden &&
      WidgetsBinding.instance.lifecycleState != AppLifecycleState.detached &&
      ModalRoute.of(context)?.isCurrent == true &&
      TickerMode.valuesOf(context).enabled;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _visible) unawaited(_refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _refresh() =>
      _refreshFlight ??= _reload().whenComplete(() => _refreshFlight = null);

  Future<void> _reload() async {
    if (!mounted) return;
    setState(() => _now = DateTime.now());
    ref.invalidate(adviserScheduleProvider);
    final futures = <Future<Object?>>[
      ref.refresh(overviewProvider.future),
      ref.refresh(overviewSecondaryProvider.future),
      ref.refresh(overviewScheduleProvider.future),
    ];
    // Individual providers expose their own failures. Refresh stays active
    // until every request finishes, without swallowing healthy sections.
    await Future.wait(
      futures.map(
        (future) =>
            future.then<void>((_) {}, onError: (Object _, StackTrace _) {}),
      ),
    );
  }

  Future<void> _open(String path) async {
    await context.push(path);
    if (mounted) await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final summary = ref.watch(overviewSummaryProvider);
    final attention = ref.watch(overviewAttentionProvider);
    final schedule = ref.watch(overviewScheduleProvider);
    final term = ref.watch(termProvider);
    final adviser =
        summary.asData?.value.isAdviser ??
        (ref.watch(authProvider).role == 'adviser');
    final section = summary.asData?.value.sectionName;
    final theme = Theme.of(context);
    return RefreshIndicator(
      onRefresh: _refresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Overview',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                summary.when(
                  data: (data) => Text(
                    data.teacherName.trim().isEmpty
                        ? 'Welcome back.'
                        : 'Welcome back, ${data.teacherName}.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  loading: () => const Text('Welcome back.'),
                  error: (error, _) => _InlineError(
                    error: error,
                    retry: () => ref.invalidate(overviewProvider),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  [
                    if (term != null)
                      '${term.schoolYearName.isEmpty ? 'Selected school year' : term.schoolYearName} · Term ${term.termNumber}',
                    if (section != null && section.isNotEmpty) section,
                  ].join(' · '),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                const _Heading(
                  'Quick actions',
                  subtitle: 'Start with your classroom essentials.',
                ),
                const SizedBox(height: 12),
                OverviewQuickActions(isAdviser: adviser, onOpen: _open),
                const SizedBox(height: 24),
                _Heading(
                  'Up next',
                  subtitle: 'Next confirmed class · Philippine time',
                  action: 'View schedule',
                  onAction: () => _open(
                    adviser ? '/adviser/schedule' : '/workspace/schedule',
                  ),
                ),
                const SizedBox(height: 12),
                ZCard(
                  child: schedule.when(
                    loading: () => const ZSkeletonRow(),
                    error: (error, _) => _InlineError(
                      error: error,
                      retry: () {
                        ref.invalidate(adviserScheduleProvider);
                        ref.invalidate(schoolYearsProvider);
                        ref.invalidate(overviewScheduleProvider);
                      },
                    ),
                    data: (data) => _upNext(data),
                  ),
                ),
                const SizedBox(height: 24),
                const _Heading(
                  'Needs attention',
                  subtitle: 'A short list of things you can act on.',
                ),
                const SizedBox(height: 12),
                _attention(summary, attention),
                const SizedBox(height: 24),
                const _Heading(
                  'At a glance',
                  subtitle: 'For the selected term',
                ),
                const SizedBox(height: 12),
                summary.when(
                  loading: () => const ZSkeletonRow(),
                  error: (error, _) => _InlineError(
                    error: error,
                    retry: () => ref.invalidate(overviewProvider),
                  ),
                  data: (data) => OverviewStats(summary: data, onOpen: _open),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _upNext(OverviewSchedule schedule) {
    final notice = schedule.scopeNotice(_now);
    final next = schedule.nextClass(_now);
    if (notice != null || next == null) {
      return Text(
        notice ?? 'No upcoming confirmed classes in this term.',
        style: Theme.of(context).textTheme.bodySmall,
      );
    }
    final start = philippineTime(next.startsAt);
    final end = philippineTime(next.endsAt);
    final now = philippineTime(_now);
    final today =
        start.year == now.year &&
        start.month == now.month &&
        start.day == now.day;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.schedule_outlined,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                next.slot.subjectName,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                next.slot.sectionName,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              Text(
                '${today ? 'Today' : DateFormat('EEE, MMM d').format(start)} · ${DateFormat('h:mm a').format(start)} – ${DateFormat('h:mm a').format(end)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _attention(
    AsyncValue<OverviewSummary> summary,
    AsyncValue<OverviewAttention> attention,
  ) {
    final data = summary.asData?.value;
    final grading = attention.asData?.value;
    final pending = grading?.pendingAssessments;
    final support = data?.isAdviser == true ? data?.supportCount : null;
    final clear =
        pending == 0 && data != null && (!data.isAdviser || support == 0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        attention.when(
          loading: () => const ZSkeletonRow(),
          error: (error, _) => _InlineError(
            error: error,
            retry: () => ref.invalidate(overviewSecondaryProvider),
          ),
          data: (data) {
            final count = data.pendingAssessments;
            if (count == null) {
              return const Text(
                'Grading summary is unavailable. Open Gradebook to check your assessments.',
              );
            }
            if (count == 0) return const SizedBox.shrink();
            return _AttentionCard(
              icon: Icons.edit_note_outlined,
              title:
                  '$count assessment${count == 1 ? '' : 's'} with missing scores',
              subtitle: 'Open Gradebook to review and enter scores.',
              onTap: () => _open('/workspace/gradebook'),
            );
          },
        ),
        if (data?.isAdviser == true) ...[
          if (support == null)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Your advisory support summary is unavailable.'),
            ),
          if (support != null && support > 0)
            Padding(
              padding: EdgeInsets.only(
                top: pending != null && pending > 0 ? 10 : 0,
              ),
              child: _AttentionCard(
                icon: Icons.support_agent_outlined,
                title:
                    '$support learner${support == 1 ? '' : 's'} may need support',
                subtitle: 'Review your advisory list and risk indicators.',
                onTap: () => _open('/adviser/advisory'),
              ),
            ),
        ],
        if (clear)
          ZCard(
            child: Text(
              data.isAdviser
                  ? 'No missing scores or advisory risk alerts from these checks.'
                  : 'No missing scores from these checks.',
            ),
          ),
      ],
    );
  }
}

class OverviewQuickActions extends StatelessWidget {
  const OverviewQuickActions({
    super.key,
    required this.isAdviser,
    required this.onOpen,
  });
  final bool isAdviser;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final row =
          constraints.maxWidth >= 330 &&
          MediaQuery.textScalerOf(context).scale(13) <= 16;
      final width = row
          ? (constraints.maxWidth - 20) / 3
          : constraints.maxWidth;
      final actions = [
        (
          label: 'Chat with Bama',
          icon: Icons.chat_bubble_outline,
          path: '/adviser/bama?new=1',
          enabled: isAdviser,
        ),
        (
          label: 'Enter grades',
          icon: Icons.edit_note_outlined,
          path: '/workspace/gradebook',
          enabled: true,
        ),
        (
          label: 'Take attendance',
          icon: Icons.fact_check_outlined,
          path: '/workspace/attendance',
          enabled: true,
        ),
      ];
      return Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          for (final action in actions)
            SizedBox(
              width: width,
              child: Semantics(
                enabled: action.enabled,
                child: ZCard(
                  onTap: action.enabled ? () => onOpen(action.path) : null,
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        action.icon,
                        size: 24,
                        color: action.enabled
                            ? Theme.of(context).colorScheme.primary
                            : Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        action.label,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (!action.enabled) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Advisers only',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      );
    },
  );
}

class OverviewStats extends StatelessWidget {
  const OverviewStats({super.key, required this.summary, required this.onOpen});
  final OverviewSummary summary;
  final ValueChanged<String> onOpen;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final items = [
        (
          label: 'Classes',
          value: summary.classCount,
          path: '/workspace/classes',
        ),
        (
          label: summary.isAdviser ? 'Advisees' : 'Learners',
          value: summary.learnerCount,
          path: summary.isAdviser ? '/adviser/advisory' : '/workspace/classes',
        ),
        if (summary.isAdviser)
          (
            label: 'Need support',
            value: summary.supportCount,
            path: '/adviser/advisory',
          ),
      ];
      final columns =
          constraints.maxWidth >= 330 &&
              MediaQuery.textScalerOf(context).scale(13) <= 16
          ? items.length
          : 1;
      final width = (constraints.maxWidth - (columns - 1) * 10) / columns;
      return Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          for (final item in items)
            SizedBox(
              width: width,
              child: ZCard(
                onTap: () => onOpen(item.path),
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.value?.toString() ?? '—',
                      style: const TextStyle(
                        fontSize: 25,
                        fontWeight: FontWeight.w600,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      item.label,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (item.value == null)
                      Text(
                        'Unavailable',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                  ],
                ),
              ),
            ),
        ],
      );
    },
  );
}

class _Heading extends StatelessWidget {
  const _Heading(this.title, {this.subtitle, this.action, this.onAction});
  final String title;
  final String? subtitle;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          if (action != null)
            TextButton(onPressed: onAction, child: Text(action!)),
        ],
      ),
      if (subtitle != null) ...[
        const SizedBox(height: 4),
        Text(
          subtitle!,
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
      ],
    ],
  );
}

class _AttentionCard extends StatelessWidget {
  const _AttentionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => ZCard(
    onTap: onTap,
    child: Row(
      children: [
        Icon(icon, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
        const SizedBox(width: 6),
        const Icon(Icons.chevron_right, size: 18),
      ],
    ),
  );
}

@Preview(
  name: 'Overview quick actions',
  group: 'Overview',
  size: Size(390, 300),
)
Widget overviewQuickActionsPreview() => MaterialApp(
  home: Scaffold(
    body: Padding(
      padding: const EdgeInsets.all(16),
      child: OverviewQuickActions(isAdviser: true, onOpen: (_) {}),
    ),
  ),
);

class _InlineError extends StatelessWidget {
  const _InlineError({required this.error, required this.retry});
  final Object error;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(userMessage(error), style: Theme.of(context).textTheme.bodySmall),
        TextButton(onPressed: retry, child: const Text('Try again')),
      ],
    ),
  );
}
