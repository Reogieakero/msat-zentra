// Adviser schedule — day-grouped agenda (mobile-native, not web grid).

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';

final adviserScheduleProvider = FutureProvider<List<TimetableSlot>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/teacher/schedule/my-slots');
    final data = res.data;
    final List raw;
    if (data is List) {
      raw = data;
    } else if (data is Map && data['slots'] is List) {
      raw = data['slots'] as List;
    } else {
      raw = [];
    }
    return [for (final s in raw) TimetableSlot.fromJson(s as Map<String, dynamic>)];
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

const _days = {1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday'};

class AdviserSchedulePage extends ConsumerWidget {
  const AdviserSchedulePage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final slots = ref.watch(adviserScheduleProvider);
    return slots.when(
      loading: () => const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList()),
      error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(adviserScheduleProvider)),
      data: (list) {
        if (list.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: ZEmpty(icon: Icons.calendar_month_outlined, title: 'No schedule yet', subtitle: 'Committed timetable slots appear here once approved.'),
          );
        }
        final byDay = <int, List<TimetableSlot>>{};
        for (final s in list) {
          byDay.putIfAbsent(s.day, () => []).add(s);
        }
        for (final v in byDay.values) {
          v.sort((a, b) => a.period.compareTo(b.period));
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(adviserScheduleProvider),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
            children: [
              for (final day in [1, 2, 3, 4, 5])
                if (byDay.containsKey(day)) ...[
                  Text(_days[day]!, style: Theme.of(context).textTheme.labelSmall?.copyWith(letterSpacing: 0.4)),
                  const SizedBox(height: 6),
                  for (final s in byDay[day]!)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ZCard(
                        child: Row(children: [
                          Container(
                            width: 40,
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerLow, borderRadius: BorderRadius.circular(6)),
                            child: Center(
                                child: Text('P${s.period + 1}',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()]))),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(s.subjectName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              Text('${s.sectionName} · ${s.status}', style: Theme.of(context).textTheme.bodySmall),
                            ]),
                          ),
                        ]),
                      ),
                    ),
                  const SizedBox(height: 8),
                ],
            ],
          ),
        );
      },
    );
  }
}
