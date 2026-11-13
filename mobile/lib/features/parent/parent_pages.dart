// Parent portal screens — every route is scoped to the selected linked child.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/portal_shell.dart';
import '../../services/portal_service.dart';
import '../../shared/widgets.dart';
import '../portal/portal_views.dart';

typedef ChildBuilder = Widget Function(WidgetRef ref, String childId);

class _ParentPage extends ConsumerWidget {
  final String selectedPath;
  final ChildBuilder builder;
  const _ParentPage({required this.selectedPath, required this.builder});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = ref.watch(parentChildrenProvider);
    return PortalShell(
      portal: 'parent',
      selectedPath: selectedPath,
      child: children.when(
        loading: () => const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList(count: 5)),
        error: (e, _) => Padding(padding: const EdgeInsets.all(16), child: ErrorView(message: e)),
        data: (list) {
          if (list.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: ZEmpty(
                  icon: Icons.family_restroom,
                  title: 'No linked learner yet',
                  subtitle: 'Ask the school registrar or adviser to link your child to this account.',
                ),
              ),
            );
          }
          final selected = ref.watch(selectedChildProvider);
          final childId = list.any((c) => c.studentId == selected) ? selected! : list.first.studentId;
          return Consumer(builder: (context, ref, _) => builder(ref, childId));
        },
      ),
    );
  }
}

class ParentHomePage extends StatelessWidget {
  const ParentHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) => _ParentPage(
        selectedPath: '/parent/home',
        builder: (ref, childId) => PortalAsync(
          value: ref.watch(parentHomeProvider(childId)),
          builder: (data) => PortalHomeBody(home: data, portal: 'parent'),
        ),
      ),
    );
  }
}

class ParentGradesPage extends StatelessWidget {
  const ParentGradesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) => _ParentPage(
        selectedPath: '/parent/grades',
        builder: (ref, childId) => PortalAsync(
          value: ref.watch(parentGradesProvider(childId)),
          builder: (data) => PortalGradesBody(data: data),
        ),
      ),
    );
  }
}

class ParentAttendancePage extends StatelessWidget {
  const ParentAttendancePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) => _ParentPage(
        selectedPath: '/parent/attendance',
        builder: (ref, childId) => PortalAsync(
          value: ref.watch(parentAttendanceProvider(childId)),
          builder: (data) => PortalAttendanceBody(data: data),
        ),
      ),
    );
  }
}

class ParentSchedulePage extends StatelessWidget {
  const ParentSchedulePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) => _ParentPage(
        selectedPath: '/parent/schedule',
        builder: (ref, childId) => PortalAsync(
          value: ref.watch(parentScheduleProvider(childId)),
          builder: (data) => PortalScheduleBody(data: data),
        ),
      ),
    );
  }
}

class ParentModulesPage extends StatelessWidget {
  const ParentModulesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) => _ParentPage(
        selectedPath: '/parent/modules',
        builder: (ref, childId) => PortalAsync(
          value: ref.watch(parentModulesProvider(childId)),
          builder: (data) => PortalModulesBody(data: data),
        ),
      ),
    );
  }
}

class ParentSessionsPage extends StatelessWidget {
  const ParentSessionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) => _ParentPage(
        selectedPath: '/parent/sessions',
        builder: (ref, childId) => PortalAsync(
          value: ref.watch(parentSessionsProvider(childId)),
          builder: (data) => PortalSessionsBody(sessions: data),
        ),
      ),
    );
  }
}
