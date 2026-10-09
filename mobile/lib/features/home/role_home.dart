// Role shells — thin drawer-routed wrappers (no bottom nav, no tabs, no FAB).
// Advisory pages use AdviserShell; Class + Attendance share WorkspaceShell
// for both roles (same web data). Replace semantics via context.go.
// Header carries logo + Zentra only; scope lives in the drawer switcher.

import 'package:flutter/material.dart';

import '../../design/shell.dart';
import '../settings/settings_page.dart' show SettingsPage;

enum AdviserRoute { advisory, academic, admCases, anecdotal, schedule, bama, referrals }

enum WorkspaceRoute { classes, gradebook, attendance, more }

class AdviserShell extends StatelessWidget {
  final AdviserRoute selected;
  final Widget child;
  const AdviserShell({super.key, required this.selected, required this.child});

  @override
  Widget build(BuildContext context) => ZentraShell(
        selectedPath: selected.path,
        child: child,
      );
}

class WorkspaceShell extends StatelessWidget {
  final WorkspaceRoute selected;
  final Widget child;
  const WorkspaceShell({super.key, required this.selected, required this.child});

  @override
  Widget build(BuildContext context) => ZentraShell(
        selectedPath: selected.path,
        child: child,
      );
}

class TeacherMorePage extends StatelessWidget {
  const TeacherMorePage({super.key});
  @override
  Widget build(BuildContext context) => const SettingsPage();
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
