// Adviser class schedule — schedule of his/her section.
// GET /api/teacher/schedule/my-slots (committed APPROVED|SUBMITTED).

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
    // my-slots returns flat list; filter happens server-side to linked sections.
    return [for (final s in raw) TimetableSlot.fromJson(s as Map<String, dynamic>)];
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

const _days = {1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri'};

class AdviserSchedulePage extends ConsumerWidget {
  const AdviserSchedulePage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final slots = ref.watch(adviserScheduleProvider);
    return slots.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(adviserScheduleProvider)),
      data: (list) {
        if (list.isEmpty) return const Center(child: Text('No schedule yet.'));
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(adviserScheduleProvider),
          child: ListView.builder(
            itemCount: list.length,
            itemBuilder: (_, i) {
              final s = list[i];
              return ListTile(
                leading: CircleAvatar(child: Text(_days[s.day] ?? '${s.day}')),
                title: Text('${s.subjectName} · ${s.sectionName}'),
                subtitle: Text('Period ${s.period + 1} · ${s.status}'),
              );
            },
          ),
        );
      },
    );
  }
}
