// Role shells — thin drawer-routed wrappers (no bottom nav, no tabs, no FAB).
// Advisory pages use AdviserShell; Class + Attendance share WorkspaceShell
// for both roles (same web data). Replace semantics via context.go.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/session.dart';
import '../../core/sync_outbox.dart';
import '../../design/shell.dart';

enum AdviserRoute { advisory, academic, admCases, schedule, bama, referrals }

enum WorkspaceRoute { classes, attendance, more }

class AdviserShell extends ConsumerWidget {
  final AdviserRoute selected;
  final Widget child;
  const AdviserShell({super.key, required this.selected, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final term = ref.watch(termProvider);
    final pending = ref.watch(outboxProvider).pendingCount;
    final termLabel = term == null ? null : '${term.schoolYearName} · Term ${term.termNumber}${pending > 0 ? ' · $pending queued' : ''}';
    return ZentraShell(
      termLabel: termLabel,
      selectedPath: selected.path,
      child: child,
    );
  }
}

class WorkspaceShell extends ConsumerWidget {
  final WorkspaceRoute selected;
  final Widget child;
  const WorkspaceShell({super.key, required this.selected, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final term = ref.watch(termProvider);
    final pending = ref.watch(outboxProvider).pendingCount;
    final termLabel = term == null ? null : '${term.schoolYearName} · Term ${term.termNumber}${pending > 0 ? ' · $pending queued' : ''}';
    return ZentraShell(
      termLabel: termLabel,
      selectedPath: selected.path,
      child: child,
    );
  }
}

class TeacherMorePage extends StatelessWidget {
  const TeacherMorePage({super.key});
  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.all(16),
        child: Column(children: [
          TeacherFlagsCard(),
        ]),
      );
}

class TeacherFlagsCard extends StatelessWidget {
  const TeacherFlagsCard({super.key});
  @override
  Widget build(BuildContext context) => const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Grade flags', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            SizedBox(height: 4),
            Text('Raise and resolve flags inside each class workspace. Overdue flags escalate to the Principal.', style: TextStyle(fontSize: 13)),
          ]),
        ),
      );
}

class TeacherFlagsView extends StatelessWidget {
  const TeacherFlagsView({super.key});
  @override
  Widget build(BuildContext context) => const TeacherMorePage();
}
