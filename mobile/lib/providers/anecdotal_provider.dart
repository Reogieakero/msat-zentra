import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/anecdotal_model.dart';
import '../data/repositories/anecdotal_repository.dart';
import 'sync_provider.dart';

final anecdotalRepositoryProvider = Provider<IAnecdotalRepository>((ref) {
  return MockAnecdotalRepository();
});

class AnecdotalNotifier extends StateNotifier<AsyncValue<List<AnecdotalRecordModel>>> {
  final IAnecdotalRepository _repository;
  final Ref _ref;

  AnecdotalNotifier(this._repository, this._ref) : super(const AsyncValue.loading()) {
    loadAnecdotalRecords();
  }

  Future<void> loadAnecdotalRecords() async {
    state = const AsyncValue.loading();
    try {
      final records = await _repository.getAnecdotalRecords();
      state = AsyncValue.data(records);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> addRecord(AnecdotalRecordModel record) async {
    final currentList = state.value ?? [];
    state = AsyncValue.data([record, ...currentList]);

    await _repository.addAnecdotalRecord(record);

    _ref.read(syncProvider.notifier).registerMutation(
      'POST',
      '/api/anecdotal',
      {
        'studentId': record.studentId,
        'category': record.category.name,
        'description': record.incidentDescription,
      },
    );
  }
}

final anecdotalProvider = StateNotifierProvider<AnecdotalNotifier, AsyncValue<List<AnecdotalRecordModel>>>((ref) {
  final repository = ref.watch(anecdotalRepositoryProvider);
  return AnecdotalNotifier(repository, ref);
});
