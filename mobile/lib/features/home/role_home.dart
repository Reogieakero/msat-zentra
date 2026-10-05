// Role home — ZentraShell with bottom nav (bespoke mobile, not TabBar).
// Adviser: Advisory, Attendance, Bama (FAB center), Schedule, More.
// Teacher: Classes, Attendance, More.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/session.dart';
import '../../core/sync_outbox.dart';
import '../../design/shell.dart';
import '../adviser/advisory_list_page.dart';
import '../adviser/adviser_schedule_page.dart';
import '../adviser/adviser_attendance_page.dart';
import '../bama/bama_chat_page.dart';
import '../referral/referral_page.dart';
import '../teacher/classes_page.dart';
import '../teacher/teacher_attendance_page.dart';

class AdviserHome extends ConsumerStatefulWidget {
  const AdviserHome({super.key});
  @override
  ConsumerState<AdviserHome> createState() => _AdviserState();
}

class _AdviserState extends ConsumerState<AdviserHome> {
  int _i = 0;

  @override
  Widget build(BuildContext context) {
    final term = ref.watch(termProvider);
    final pending = ref.watch(outboxProvider).pendingCount;
    final termLabel = term == null ? null : '${term.schoolYearName} · Term ${term.termNumber}${pending > 0 ? ' · $pending queued' : ''}';
    const dests = [
      ZNavDest(label: 'Advisory', icon: Icons.group_outlined, selectedIcon: Icons.group),
      ZNavDest(label: 'Attend', icon: Icons.fact_check_outlined, selectedIcon: Icons.fact_check),
      ZNavDest(label: 'Bama', icon: Icons.chat_bubble_outline, selectedIcon: Icons.chat_bubble),
      ZNavDest(label: 'Schedule', icon: Icons.calendar_month_outlined, selectedIcon: Icons.calendar_month),
      ZNavDest(label: 'More', icon: Icons.more_horiz, selectedIcon: Icons.more_horiz),
    ];
    final pages = [
      const AdvisoryListPage(),
      const AdviserAttendancePage(),
      const BamaChatPage(),
      const AdviserSchedulePage(),
      const ReferralPage(),
    ];
    return ZentraShell(
      title: 'Adviser',
      termLabel: termLabel,
      currentIndex: _i,
      onTap: (v) => setState(() => _i = v),
      destinations: dests,
      fab: _i == 2
          ? null
          : FloatingActionButton.extended(
              icon: const Icon(Icons.chat_bubble_outline, size: 18),
              label: const Text('Bama', style: TextStyle(fontSize: 13)),
              onPressed: () => setState(() => _i = 2),
            ),
      child: IndexedStack(index: _i, children: pages),
    );
  }
}

class TeacherHome extends ConsumerStatefulWidget {
  const TeacherHome({super.key});
  @override
  ConsumerState<TeacherHome> createState() => _TeacherState();
}

class _TeacherState extends ConsumerState<TeacherHome> {
  int _i = 0;
  @override
  Widget build(BuildContext context) {
    final term = ref.watch(termProvider);
    final termLabel = term == null ? null : '${term.schoolYearName} · Term ${term.termNumber}';
    const dests = [
      ZNavDest(label: 'Classes', icon: Icons.class_outlined, selectedIcon: Icons.class_),
      ZNavDest(label: 'Attend', icon: Icons.fact_check_outlined, selectedIcon: Icons.fact_check),
      ZNavDest(label: 'More', icon: Icons.more_horiz, selectedIcon: Icons.more_horiz),
    ];
    return ZentraShell(
      title: 'Subject Teacher',
      termLabel: termLabel,
      currentIndex: _i,
      onTap: (v) => setState(() => _i = v),
      destinations: dests,
      child: IndexedStack(index: _i, children: const [
        ClassesPage(),
        TeacherAttendancePage(),
        TeacherMorePage(),
      ]),
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
