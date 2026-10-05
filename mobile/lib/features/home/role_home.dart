// Role home — bottom tabs split by Adviser vs Subject Teacher.
// Adviser: Advisory, Attendance, Schedule, Bama, More(referrals).
// Subject Teacher: Classes, Attendance, More.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/session.dart';
import '../adviser/advisory_list_page.dart';
import '../adviser/adviser_schedule_page.dart';
import '../adviser/adviser_attendance_page.dart';
import '../bama/bama_chat_page.dart';
import '../referral/referral_page.dart';
import '../teacher/classes_page.dart';
import '../teacher/teacher_attendance_page.dart';

class AdviserHome extends ConsumerWidget {
  const AdviserHome({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 5,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Zentra — Adviser'),
          actions: [
            IconButton(
              icon: const Icon(Icons.swap_horiz),
              tooltip: 'Switch term',
              onPressed: () async {
                await ref.read(termProvider.notifier).clear();
                if (context.mounted) context.go('/term');
              },
            ),
          ],
          bottom: const TabBar(isScrollable: true, tabs: [
            Tab(text: 'Advisory', icon: Icon(Icons.group)),
            Tab(text: 'Attendance', icon: Icon(Icons.fact_check)),
            Tab(text: 'Schedule', icon: Icon(Icons.calendar_month)),
            Tab(text: 'Bama', icon: Icon(Icons.chat_bubble)),
            Tab(text: 'Referrals', icon: Icon(Icons.send)),
          ]),
        ),
        body: const TabBarView(children: [
          AdvisoryListPage(),
          AdviserAttendancePage(),
          AdviserSchedulePage(),
          BamaChatPage(),
          ReferralPage(),
        ]),
      ),
    );
  }
}

class TeacherHome extends StatelessWidget {
  const TeacherHome({super.key});
  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Zentra — Subject Teacher'),
          bottom: const TabBar(tabs: [
            Tab(text: 'Classes', icon: Icon(Icons.class_)),
            Tab(text: 'Attendance', icon: Icon(Icons.fact_check)),
            Tab(text: 'Flags', icon: Icon(Icons.flag)),
          ]),
        ),
        body: const TabBarView(children: [
          ClassesPage(),
          TeacherAttendancePage(),
          TeacherFlagsView(),
        ]),
      ),
    );
  }
}

class TeacherFlagsView extends StatelessWidget {
  const TeacherFlagsView({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: Text('Grade flags live under each class workspace.'));
}
