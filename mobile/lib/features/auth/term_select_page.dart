// Term selection — GET /api/academics/school-years.
// Login -> pick Year + Term -> persisted to Hive, sent as headers afterwards.
// Mirrors frontend TermContext resolveDefaultTerm.

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
      appBar: AppBar(title: const Text('Select Term')),
      body: years.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(schoolYearsProvider)),
        data: (list) {
          if (list.isEmpty) return const ErrorView(message: 'No school years found. Ask the Principal to create one.');
          final def = _defaultTerm(list);
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (def != null)
                Card(
                  child: ListTile(
                    title: Text('${def.schoolYearName} — Term ${def.termNumber} (default)'),
                    trailing: const Icon(Icons.star_outline),
                    onTap: () async {
                      await ref.read(termProvider.notifier).select(def);
                      if (context.mounted) context.go('/gate');
                    },
                  ),
                ),
              for (final sy in list)
                for (final t in sy.terms)
                  Card(
                    child: ListTile(
                      title: Text('${sy.name} — Term ${t.termNumber}'),
                      subtitle: sy.isActive ? const Text('Active') : null,
                      onTap: () async {
                        await ref.read(termProvider.notifier).select(
                              Term(id: t.id, schoolYearId: sy.id, schoolYearName: sy.name, termNumber: t.termNumber),
                            );
                        if (context.mounted) context.go('/gate');
                      },
                    ),
                  ),
            ],
          );
        },
      ),
    );
  }
}
