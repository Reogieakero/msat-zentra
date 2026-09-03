import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/adm_model.dart';
import '../data/repositories/adm_repository.dart';
import 'sync_provider.dart';

final admRepositoryProvider = Provider<IAdmRepository>((ref) {
  return MockAdmRepository();
});

class AdmState {
  final List<AdmLearnerModel> learners;
  final List<AdmDeviceModel> devices;

  const AdmState({
    required this.learners,
    required this.devices,
  });

  AdmState copyWith({
    List<AdmLearnerModel>? learners,
    List<AdmDeviceModel>? devices,
  }) {
    return AdmState(
      learners: learners ?? this.learners,
      devices: devices ?? this.devices,
    );
  }
}

class AdmNotifier extends StateNotifier<AsyncValue<AdmState>> {
  final IAdmRepository _repository;
  final Ref _ref;

  AdmNotifier(this._repository, this._ref) : super(const AsyncValue.loading()) {
    loadAdmData();
  }

  Future<void> loadAdmData() async {
    state = const AsyncValue.loading();
    try {
      final learners = await _repository.getAdmLearners();
      final devices = await _repository.getAdmDevices();
      state = AsyncValue.data(AdmState(learners: learners, devices: devices));
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> advanceStage(String learnerId, AdmStage newStage) async {
    final currentState = state.value;
    if (currentState == null) return;

    final updatedLearners = currentState.learners.map((l) {
      return l.id == learnerId ? l.copyWith(stage: newStage) : l;
    }).toList();

    state = AsyncValue.data(currentState.copyWith(learners: updatedLearners));
    await _repository.advanceAdmStage(learnerId, newStage);

    _ref.read(syncProvider.notifier).registerMutation(
      'PATCH',
      '/api/adm/stage',
      {'admLearnerId': learnerId, 'stage': newStage.name},
    );
  }
}

final admProvider = StateNotifierProvider<AdmNotifier, AsyncValue<AdmState>>((ref) {
  final repository = ref.watch(admRepositoryProvider);
  return AdmNotifier(repository, ref);
});
