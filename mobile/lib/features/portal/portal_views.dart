// Shared read-only views for the student and parent portals.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/notifications.dart';
import '../../core/session.dart';
import '../../design/portal_shell.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';
import '../../services/portal_service.dart';
import '../student/module_submission.dart';

class PortalAsync<T> extends StatelessWidget {
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  const PortalAsync({super.key, required this.value, required this.builder});

  @override
  Widget build(BuildContext context) => value.when(
        loading: () => const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList(count: 5)),
        error: (e, _) => Padding(padding: const EdgeInsets.all(16), child: ErrorView(message: e)),
        data: builder,
      );
}

Widget _sectionTitle(BuildContext context, String text) => Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 8),
      child: Text(text, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
    );

class PortalHomeBody extends StatelessWidget {
  final PortalHome home;
  final String portal;
  const PortalHomeBody({super.key, required this.home, required this.portal});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l = home.learner;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ZCard(
          child: Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: theme.colorScheme.surfaceContainerLow,
                child: Text(
                  l.name.isEmpty ? '?' : l.name.substring(0, 1).toUpperCase(),
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(l.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  Text('${l.gradeLevel}${l.sectionName == null ? '' : ' · ${l.sectionName}'}',
                      style: theme.textTheme.bodySmall),
                  if (l.adviserName != null)
                    Text('Adviser: ${l.adviserName}', style: theme.textTheme.labelSmall),
                  Text(home.term.label, style: theme.textTheme.labelSmall),
                ]),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: ZKpi(
              value: home.average == null ? '—' : home.average!.toStringAsFixed(1),
              label: 'Average',
              icon: Icons.grade_outlined,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ZKpi(
              value: '${home.attendance.percent}%',
              label: 'Attendance',
              icon: Icons.fact_check_outlined,
              desc: home.attendance.isRisk ? 'Below 80%' : null,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ZKpi(
              value: '${home.moduleCounts.overdue}',
              label: 'Overdue',
              icon: Icons.folder_off_outlined,
            ),
          ),
        ]),
        _sectionTitle(context, "Today's classes"),
        if (home.todaySlots.isEmpty)
          const ZEmpty(icon: Icons.free_breakfast_outlined, title: 'No classes today')
        else
          ZCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (final slot in home.todaySlots)
                  ListTile(
                    dense: true,
                    leading: CircleAvatar(radius: 14, backgroundColor: theme.colorScheme.surfaceContainerLow, child: Text('${slot.period}', style: const TextStyle(fontSize: 11))),
                    title: Text(slot.subjectName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: Text(slot.teacherName ?? slot.subjectCode, style: const TextStyle(fontSize: 11)),
                    trailing: _slotStatusChip(context, slot.status),
                  ),
              ],
            ),
          ),
        _sectionTitle(context, 'Grades'),
        if (home.grades.isEmpty)
          const ZEmpty(icon: Icons.grade_outlined, title: 'No grades yet for this term')
        else
          _GradeList(grades: home.grades.take(6).toList(), compact: true),
        if (home.upcomingSessions.isNotEmpty) ...[
          _sectionTitle(context, 'Upcoming sessions'),
          _SessionList(sessions: home.upcomingSessions),
        ],
      ],
    );
  }

  Widget _slotStatusChip(BuildContext context, String status) {
    final theme = Theme.of(context);
    final label = status.isEmpty ? 'scheduled' : status.replaceAll('_', ' ');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: theme.textTheme.labelSmall),
    );
  }
}

class PortalGradesBody extends StatelessWidget {
  final PortalGrades data;
  const PortalGradesBody({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (data.term != null) Text(data.term!.label, style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 8),
        if (data.grades.isEmpty)
          const ZEmpty(icon: Icons.grade_outlined, title: 'No grades for this term')
        else
          _GradeList(grades: data.grades),
      ],
    );
  }
}

class _GradeList extends StatelessWidget {
  final List<PortalGrade> grades;
  final bool compact;
  const _GradeList({required this.grades, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        for (final g in grades)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: ZCard(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(g.subjectName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      Text(g.subjectCode, style: theme.textTheme.labelSmall),
                      if (!compact && g.remarks != null) Text(g.remarks!, style: theme.textTheme.labelSmall),
                    ]),
                  ),
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(
                      g.transmutedGrade?.toStringAsFixed(0) ?? '—',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 18,
                        color: (g.transmutedGrade ?? 100) < 75 ? theme.colorScheme.error : null,
                      ),
                    ),
                    Text(g.lockStatus.replaceAll('_', ' '), style: theme.textTheme.labelSmall),
                  ]),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class PortalAttendanceBody extends StatelessWidget {
  final PortalAttendance data;
  const PortalAttendanceBody({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final s = data.summary;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (data.term != null) Text(data.term!.label, style: theme.textTheme.labelMedium),
        const SizedBox(height: 8),
        ZCard(
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('Overall attendance', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              Text('${s.percent}%', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20, color: s.isRisk ? theme.colorScheme.error : null)),
            ]),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(value: s.rate.clamp(0, 1), minHeight: 8),
            ),
            const SizedBox(height: 10),
            Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
              _stat(theme, 'Present', s.present),
              _stat(theme, 'Absent', s.absent),
              _stat(theme, 'Late', s.late),
              _stat(theme, 'Excused', s.excused),
            ]),
          ]),
        ),
        if (data.bySubject.isNotEmpty) ...[
          _sectionTitle(context, 'By subject'),
          for (final sub in data.bySubject)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ZCard(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Expanded(child: Text(sub.subjectName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                  Text('${sub.percent}%', style: TextStyle(fontWeight: FontWeight.w700, color: sub.percent < 80 ? theme.colorScheme.error : null)),
                ]),
              ),
            ),
        ],
        _sectionTitle(context, 'Recent records'),
        if (data.recent.isEmpty)
          const ZEmpty(icon: Icons.fact_check_outlined, title: 'No attendance records yet')
        else
          ZCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(children: [
              for (final r in data.recent.take(20))
                ListTile(
                  dense: true,
                  title: Text(r.subjectName ?? 'Daily attendance', style: const TextStyle(fontSize: 13)),
                  subtitle: Text(formatPortalDate(r.date), style: const TextStyle(fontSize: 11)),
                  trailing: _statusChip(theme, r.status),
                ),
            ]),
          ),
      ],
    );
  }

  Widget _stat(ThemeData theme, String label, int value) => Column(children: [
        Text('$value', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        Text(label, style: theme.textTheme.labelSmall),
      ]);

  Widget _statusChip(ThemeData theme, String status) {
    final color = switch (status) {
      'present' => Colors.green,
      'absent' => theme.colorScheme.error,
      'late' => Colors.orange,
      _ => theme.colorScheme.onSurfaceVariant,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(status, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

class PortalScheduleBody extends StatelessWidget {
  final PortalSchedule data;
  const PortalScheduleBody({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (data.slots.isEmpty) {
      return const Padding(padding: EdgeInsets.all(16), child: ZEmpty(icon: Icons.calendar_month_outlined, title: 'No schedule published yet'));
    }
    final byDay = <int, List<PortalScheduleSlot>>{};
    for (final s in data.slots) {
      byDay.putIfAbsent(s.day, () => []).add(s);
    }
    final days = byDay.keys.toList()..sort();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (data.term != null) Text(data.term!.label, style: theme.textTheme.labelMedium),
        for (final day in days) ...[
          _sectionTitle(context, _dayName(day)),
          for (final slot in byDay[day]!)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ZCard(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  CircleAvatar(radius: 14, backgroundColor: theme.colorScheme.surfaceContainerLow, child: Text('${slot.period}', style: const TextStyle(fontSize: 11))),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(slot.subjectName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      Text(slot.teacherName ?? slot.subjectCode, style: theme.textTheme.labelSmall),
                    ]),
                  ),
                  if (slot.status.isNotEmpty) Text(slot.status.replaceAll('_', ' '), style: theme.textTheme.labelSmall),
                ]),
              ),
            ),
        ],
      ],
    );
  }

  String _dayName(int day) => const ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day.clamp(0, 7)];
}

class PortalModulesBody extends ConsumerWidget {
  final PortalModules data;
  final bool canSubmit;
  const PortalModulesBody({super.key, required this.data, this.canSubmit = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(children: [
          Expanded(child: _count(theme, '${data.counts.all}', 'All')),
          Expanded(child: _count(theme, '${data.counts.submitted}', 'Submitted')),
          Expanded(child: _count(theme, '${data.counts.pending}', 'Pending')),
          Expanded(child: _count(theme, '${data.counts.overdue}', 'Overdue')),
        ]),
        const SizedBox(height: 12),
        if (data.modules.isEmpty)
          const ZEmpty(icon: Icons.folder_shared_outlined, title: 'No modules released yet')
        else
          for (final m in data.modules)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ZCard(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(m.moduleName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
                    _status(theme, m.status),
                  ]),
                  if (m.description != null) ...[
                    const SizedBox(height: 4),
                    Text(m.description!, style: theme.textTheme.bodySmall),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    m.dueDate == null ? 'No due date' : 'Due ${formatPortalDate(m.dueDate)}',
                    style: theme.textTheme.labelSmall,
                  ),
                  const SizedBox(height: 8),
                  Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    if (m.moduleUrl != null)
                      OutlinedButton.icon(
                        onPressed: () => _open(m.moduleUrl!),
                        icon: const Icon(Icons.open_in_new, size: 14),
                        label: const Text('Open module', style: TextStyle(fontSize: 12)),
                      ),
                    if (m.submitted)
                      Text('Submitted ${formatPortalDate(m.submittedAt)}', style: theme.textTheme.labelSmall)
                    else if (m.tracked)
                      Text('Not yet submitted', style: theme.textTheme.labelSmall),
                  ]),
                  if (canSubmit && m.tracked && m.moduleUrl != null)
                    TextButton.icon(
                      icon: const Icon(Icons.upload_outlined, size: 16),
                      label: Text(m.submitted ? 'Update answer' : 'Submit answer'),
                      onPressed: () => showModalBottomSheet(
                        context: context, isScrollControlled: true, showDragHandle: true,
                        builder: (_) => ModuleSubmissionSheet(module: m),
                      ),
                    ),
                ]),
              ),
            ),
        if (data.totalPages > 1) Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          IconButton(tooltip: 'Previous page', onPressed: data.page > 1 ? () => ref.read(portalModulePageProvider.notifier).state = data.page - 1 : null, icon: const Icon(Icons.chevron_left)),
          Text('${data.page} / ${data.totalPages}'),
          IconButton(tooltip: 'Next page', onPressed: data.page < data.totalPages ? () => ref.read(portalModulePageProvider.notifier).state = data.page + 1 : null, icon: const Icon(Icons.chevron_right)),
        ]),
      ],
    );
  }

  Widget _count(ThemeData theme, String value, String label) => Column(children: [
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        Text(label, style: theme.textTheme.labelSmall),
      ]);

  Widget _status(ThemeData theme, String status) {
    final color = switch (status) {
      'submitted' => Colors.green,
      'overdue' => theme.colorScheme.error,
      'pending' => Colors.orange,
      _ => theme.colorScheme.onSurfaceVariant,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Text(status, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

class PortalSessionsBody extends StatelessWidget {
  final List<PortalSession> sessions;
  const PortalSessionsBody({super.key, required this.sessions});

  @override
  Widget build(BuildContext context) {
    if (sessions.isEmpty) {
      return const Padding(padding: EdgeInsets.all(16), child: ZEmpty(icon: Icons.event_available_outlined, title: 'No upcoming sessions'));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [_SessionList(sessions: sessions)],
    );
  }
}

class _SessionList extends StatelessWidget {
  final List<PortalSession> sessions;
  const _SessionList({required this.sessions});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(children: [
      for (final s in sessions)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: ZCard(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Icon(s.track == 'ADM' ? Icons.family_restroom : Icons.support_agent, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(s.track == 'ADM' ? 'Parent conference' : s.sessionType.replaceAll('_', ' '),
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  Text('${formatPortalDate(s.scheduledAt)} · ${s.venue.isEmpty ? 'Venue TBA' : s.venue}',
                      style: theme.textTheme.labelSmall),
                ]),
              ),
            ]),
          ),
        ),
    ]);
  }
}

Future<void> _open(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

class PortalNotificationsPage extends ConsumerWidget {
  const PortalNotificationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final inbox = ref.watch(notificationsProvider);
    final portal = ref.watch(authProvider).portal ?? 'student';
    return PortalAsync(
      value: inbox,
      builder: (list) {
        if (list.isEmpty) {
          return const Center(child: ZEmpty(icon: Icons.notifications_none, title: 'No notifications yet'));
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: list.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final n = list[i];
            return ZCard(
              padding: const EdgeInsets.all(12),
              onTap: () async {
                if (!n.isRead) await markNotificationRead(ref, n.id);
                if (context.mounted) context.go(portalNotificationTarget(n, portal));
              },
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(portalNotificationTitle(n), style: TextStyle(fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700, fontSize: 13)),
                if (n.message.isNotEmpty) ...[const SizedBox(height: 2), Text(n.message, style: theme.textTheme.bodySmall)],
                const SizedBox(height: 2),
                Text(DateFormat('MMM d, y · HH:mm').format(DateTime.tryParse(n.createdAt)?.toLocal() ?? DateTime.now()), style: theme.textTheme.labelSmall),
              ]),
            );
          },
        );
      },
    );
  }
}
