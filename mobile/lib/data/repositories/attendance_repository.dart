import '../models/attendance_model.dart';
import '../mock/mock_data.dart';

abstract class IAttendanceRepository {
  Future<List<AttendanceRecordModel>> getRosterAttendance(String sectionId, DateTime date, Session session);
  Future<void> updateAttendanceStatus(String recordId, AttendanceStatus newStatus);
  Future<void> markAllPresent(String sectionId, DateTime date, Session session);
}

class MockAttendanceRepository implements IAttendanceRepository {
  final Map<String, List<AttendanceRecordModel>> _cache = {};

  String _key(String sectionId, DateTime date, Session session) {
    final dateStr = "${date.year}-${date.month}-${date.day}";
    return "${sectionId}_${dateStr}_${session.name}";
  }

  @override
  Future<List<AttendanceRecordModel>> getRosterAttendance(String sectionId, DateTime date, Session session) async {
    final key = _key(sectionId, date, session);
    if (!_cache.containsKey(key)) {
      _cache[key] = MockData.students.map((student) {
        // Default initial status
        AttendanceStatus initialStatus = AttendanceStatus.present;
        if (student.id == 'std_03') initialStatus = AttendanceStatus.absent;
        if (student.id == 'std_01') initialStatus = AttendanceStatus.late;

        return AttendanceRecordModel(
          id: 'att_${student.id}_${key}',
          studentId: student.id,
          studentName: student.fullName,
          sectionId: sectionId,
          date: date,
          session: session,
          status: initialStatus,
        );
      }).toList();
    }
    return _cache[key]!;
  }

  @override
  Future<void> updateAttendanceStatus(String recordId, AttendanceStatus newStatus) async {
    for (final list in _cache.values) {
      final index = list.indexWhere((item) => item.id == recordId);
      if (index != -1) {
        list[index] = list[index].copyWith(status: newStatus);
        break;
      }
    }
  }

  @override
  Future<void> markAllPresent(String sectionId, DateTime date, Session session) async {
    final key = _key(sectionId, date, session);
    final currentList = await getRosterAttendance(sectionId, date, session);
    _cache[key] = currentList.map((item) => item.copyWith(status: AttendanceStatus.present)).toList();
  }
}
