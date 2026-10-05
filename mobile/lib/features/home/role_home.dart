// Role shells — thin drawer-routed wrappers (no bottom nav, no tabs).
// Each route renders its page as child; replace semantics via context.go.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/session.dart';
import '../../core/sync_outbox.dart';
import '../../design/shell.dart';

enum AdviserRoute { advisory, attendance, schedule, bama, referrals }

enum TeacherRoute { classes, attendance, more }

class AdviserShell extends ConsumerWidget {
  final AdviserRoute selected;
  final Widget child;
  const AdviserShell({super.key, required this.selected, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final term = ref.watch(termProvider);
    final pending = ref.watch(outboxProvider).pendingCount;
    final termLabel = term == null ? null : '${term.schoolYearName} · Term ${term.termNumber}${pending > 0 ? ' · $pending queued' : ''}';
    // Bama quick-filing FAB on field screens (not on Bama itself).
    final showBamaFab = selected == AdviserRoute.advisory ||
        selected == AdviserRoute.attendance ||
        selected == AdviserRoute.schedule;
    return ZentraShell(
      termLabel: termLabel,
      selectedPath: selected.path,
      fab: showBamaFab ? const _BamaFab() : null,
      child: child,
    );
  }
}

class TeacherShell extends ConsumerWidget {
  final TeacherRoute selected;
  final Widget child;
  const TeacherShell({super.key, required this.selected, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final term = ref.watch(termProvider);
    final termLabel = term == null ? null : '${term.schoolYearName} · Term ${term.termNumber}';
    return ZentraShell(
      termLabel: termLabel,
      selectedPath: selected.path,
      child: child,
    );
  }
}

class _BamaFab extends StatelessWidget {
  const _BamaFab();
  @override
  Widget build(BuildContext context) => FloatingActionButton.extended(
        icon: const Icon(Icons.chat_bubble_outline, size: 18),
        label: const Text('Bama', style: TextStyle(fontSize: 13)),
        onPressed: () {
          // Replace semantics: drawer-equivalent destination.
          // ignore: use_build_context_synchronously
          context.go('/adviser/bama');
        },
      );
}

// Keep old names compiling for any lingering imports.
typedef AdviserHome = AdviserShell;
typedef TeacherHome = TeacherShell;

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
