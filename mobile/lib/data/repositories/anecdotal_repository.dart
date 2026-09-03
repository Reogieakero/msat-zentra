import '../models/anecdotal_model.dart';
import '../mock/mock_data.dart';

abstract class IAnecdotalRepository {
  Future<List<AnecdotalRecordModel>> getAnecdotalRecords();
  Future<void> addAnecdotalRecord(AnecdotalRecordModel record);
}

class MockAnecdotalRepository implements IAnecdotalRepository {
  final List<AnecdotalRecordModel> _records = List.from(MockData.anecdotalRecords);

  @override
  Future<List<AnecdotalRecordModel>> getAnecdotalRecords() async {
    return List.unmodifiable(_records);
  }

  @override
  Future<void> addAnecdotalRecord(AnecdotalRecordModel record) async {
    _records.insert(0, record);
  }
}
