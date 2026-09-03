import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/attendance_model.dart';
import '../data/repositories/attendance_repository.dart';
import 'sync_provider.dart';

final attendanceRepositoryProvider = Provider<IAttendanceRepository>((ref) {
  return MockAttendanceRepository();
});

class AttendanceNotifier extends StateNotifier<AsyncValue<List<AttendanceRecordModel>>> {
  final IAttendanceRepository _repository;
  final Ref _ref;
  DateTime _selectedDate = DateTime.now();
  Session _selectedSession = Session.AM;

  AttendanceNotifier(this._repository, this._ref) : super(const AsyncValue.loading()) {
    loadAttendance('sec_g10_emerald', _selectedDate, _selectedSession);
  }

  DateTime get selectedDate => _selectedDate;
  Session get selectedSession => _selectedSession;

  Future<void> loadAttendance(String sectionId, DateTime date, Session session) async {
    _selectedDate = date;
    _selectedSession = session;
    state = const AsyncValue.loading();
    try {
      final records = await _repository.getRosterAttendance(sectionId, date, session);
      state = AsyncValue.data(records);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> updateStatus(String recordId, AttendanceStatus status) async {
    final currentList = state.value ?? [];
    final updatedList = currentList.map((item) {
      return item.id == recordId ? item.copyWith(status: status) : item;
    }).toList();

    state = AsyncValue.data(updatedList);
    await _repository.updateAttendanceStatus(recordId, status);

    // Track in sync queue if offline
    _ref.read(syncProvider.notifier).registerMutation(
      'POST',
      '/api/attendance',
      {'recordId': recordId, 'status': status.name},
    );
  }

  Future<void> markAllPresent(String sectionId) async {
    final currentList = state.value ?? [];
    final updatedList = currentList.map((item) => item.copyWith(status: AttendanceStatus.present)).toList();

    state = AsyncValue.data(updatedList);
    await _repository.markAllPresent(sectionId, _selectedDate, _selectedSession);

    _ref.read(syncProvider.notifier).registerMutation(
      'POST',
      '/api/attendance/bulk',
      {'sectionId': sectionId, 'status': 'present'},
    );
  }
}

final attendanceProvider = StateNotifierProvider<AttendanceNotifier, AsyncValue<List<AttendanceRecordModel>>>((ref) {
  final repository = ref.watch(attendanceRepositoryProvider);
  return AttendanceNotifier(repository, ref);
});
