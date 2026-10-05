// My Classes — web Classes grid port: min-h 96px card, 3px left ink bar, 6px.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/session.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';

class ClassesPage extends ConsumerWidget {
  const ClassesPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(overviewProvider);
    return overview.when(
      loading: () => const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList()),
      error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(overviewProvider)),
      data: (data) {
        final classes = (data['classes'] as List? ?? []);
        if (classes.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: ZEmpty(icon: Icons.class_outlined, title: 'No classes this term', subtitle: 'Link your timetable code or ask the Master Teacher.'),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(overviewProvider),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
            itemCount: classes.length,
            separatorBuilder: (context, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final c = ClassSlot.fromJson(classes[i] as Map<String, dynamic>);
              return ZCard(
                padding: EdgeInsets.zero,
                onTap: () => context.push('/teacher/gradebook/${Uri.encodeComponent(c.id)}?title=${Uri.encodeComponent('${c.subject} · ${c.section}')}'),
                child: IntrinsicHeight(
                  child: Row(children: [
                    Container(width: 3, decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary, borderRadius: const BorderRadius.horizontal(left: Radius.circular(6)))),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${c.subject} · ${c.section}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 2),
                          Text('${c.gradeLevel} · ${c.studentCount} students',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                        ]),
                      ),
                    ),
                    const Padding(padding: EdgeInsets.only(right: 8), child: Icon(Icons.chevron_right, size: 18)),
                  ]),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
