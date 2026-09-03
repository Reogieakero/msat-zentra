import '../models/adm_model.dart';
import '../mock/mock_data.dart';

abstract class IAdmRepository {
  Future<List<AdmLearnerModel>> getAdmLearners();
  Future<List<AdmDeviceModel>> getAdmDevices();
  Future<void> advanceAdmStage(String admLearnerId, AdmStage newStage);
}

class MockAdmRepository implements IAdmRepository {
  final List<AdmLearnerModel> _learners = List.from(MockData.admLearners);
  final List<AdmDeviceModel> _devices = List.from(MockData.admDevices);

  @override
  Future<List<AdmLearnerModel>> getAdmLearners() async {
    return List.unmodifiable(_learners);
  }

  @override
  Future<List<AdmDeviceModel>> getAdmDevices() async {
    return List.unmodifiable(_devices);
  }

  @override
  Future<void> advanceAdmStage(String admLearnerId, AdmStage newStage) async {
    final index = _learners.indexWhere((l) => l.id == admLearnerId);
    if (index != -1) {
      _learners[index] = _learners[index].copyWith(stage: newStage);
    }
  }
}
