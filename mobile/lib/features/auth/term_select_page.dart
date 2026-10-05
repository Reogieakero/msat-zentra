// Term selection — web-matched cards with Active pill + default star.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/session.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';

class TermSelectPage extends ConsumerWidget {
  const TermSelectPage({super.key});

  Term? _defaultTerm(List<SchoolYear> years) {
    for (final sy in years) {
      if (sy.isActive && sy.terms.isNotEmpty) {
        final t1 = sy.terms.where((t) => t.termNumber == 1);
        final pick = t1.isNotEmpty ? t1.first : sy.terms.first;
        return Term(id: pick.id, schoolYearId: sy.id, schoolYearName: sy.name, termNumber: pick.termNumber);
      }
    }
    if (years.isNotEmpty && years.first.terms.isNotEmpty) {
      final sy = years.first;
      final pick = sy.terms.first;
      return Term(id: pick.id, schoolYearId: sy.id, schoolYearName: sy.name, termNumber: pick.termNumber);
    }
    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final years = ref.watch(schoolYearsProvider);
    return Scaffold(
      appBar: AppBar(title: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Zentra'), Text('Select Term', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400))])),
      body: years.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(schoolYearsProvider)),
        data: (list) {
          if (list.isEmpty) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: ZEmpty(icon: Icons.calendar_month_outlined, title: 'No school years', subtitle: 'Ask the Principal to create one.'),
            );
          }
          final def = _defaultTerm(list);
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.expand((sy) => sy.terms.map((t) => (sy, t))).length + (def != null ? 1 : 0),
            separatorBuilder: (context, _) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              if (def != null && i == 0) {
                return ZCard(
                  onTap: () async {
                    await ref.read(termProvider.notifier).select(def);
                    if (context.mounted) context.go('/gate');
                  },
                  child: Row(children: [
                    Expanded(child: Text('${def.schoolYearName} — Term ${def.termNumber}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                    const Icon(Icons.star, size: 16),
                  ]),
                );
              }
              final idx = def != null ? i - 1 : i;
              final pairs = list.expand((sy) => sy.terms.map((t) => (sy, t))).toList();
              final (sy, t) = pairs[idx];
              return ZCard(
                onTap: () async {
                  await ref.read(termProvider.notifier).select(Term(id: t.id, schoolYearId: sy.id, schoolYearName: sy.name, termNumber: t.termNumber));
                  if (context.mounted) context.go('/gate');
                },
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${sy.name} — Term ${t.termNumber}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    Text(sy.isActive ? 'Active school year' : sy.name, style: Theme.of(context).textTheme.bodySmall),
                  ])),
                  if (sy.isActive)
                    Container(
                      height: 20,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), color: Theme.of(context).colorScheme.surfaceContainerLow),
                      child: const Center(child: Text('Active', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600))),
                    ),
                  const Icon(Icons.chevron_right, size: 18),
                ]),
              );
            },
          );
        },
      ),
    );
  }
}
