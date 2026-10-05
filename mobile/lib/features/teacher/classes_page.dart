// My Classes — GET /api/teacher/schedule/my-slots distinct (subject, section).
// Falls back to overview classes for logins without linked code.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/session.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';
import 'gradebook_page.dart';

class ClassesPage extends ConsumerWidget {
  const ClassesPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(overviewProvider);
    return overview.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(overviewProvider)),
      data: (data) {
        final classes = (data['classes'] as List? ?? []);
        if (classes.isEmpty) return const Center(child: Text('No classes assigned this term.'));
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(overviewProvider),
          child: ListView.builder(
            itemCount: classes.length,
            itemBuilder: (_, i) {
              final c = ClassSlot.fromJson(classes[i] as Map<String, dynamic>);
              return Card(
                child: ListTile(
                  title: Text('${c.subject} · ${c.section}'),
                  subtitle: Text('${c.gradeLevel} · ${c.studentCount} students'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => GradebookPage(classId: c.id, title: '${c.subject} · ${c.section}'))),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
