import '../models/user_model.dart';
import '../mock/mock_data.dart';

abstract class IAuthRepository {
  Future<UserModel> getCurrentUser();
  Future<UserModel> switchRole(UserRole role);
}

class MockAuthRepository implements IAuthRepository {
  UserModel _currentUser = MockData.teacherUser;

  @override
  Future<UserModel> getCurrentUser() async {
    return _currentUser;
  }

  @override
  Future<UserModel> switchRole(UserRole role) async {
    switch (role) {
      case UserRole.adviser:
      case UserRole.subject_teacher:
        _currentUser = MockData.teacherUser;
        break;
      case UserRole.adm_coordinator:
        _currentUser = MockData.admCoordinatorUser;
        break;
      case UserRole.parent:
        _currentUser = MockData.parentUser;
        break;
      case UserRole.student:
        _currentUser = MockData.studentUser;
        break;
      default:
        _currentUser = MockData.teacherUser;
    }
    return _currentUser;
  }
}
