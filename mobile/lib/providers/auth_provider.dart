import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/user_model.dart';
import '../data/repositories/auth_repository.dart';

final authRepositoryProvider = Provider<IAuthRepository>((ref) {
  return MockAuthRepository();
});

class AuthNotifier extends StateNotifier<AsyncValue<UserModel>> {
  final IAuthRepository _repository;

  AuthNotifier(this._repository) : super(const AsyncValue.loading()) {
    _loadUser();
  }

  Future<void> _loadUser() async {
    try {
      final user = await _repository.getCurrentUser();
      state = AsyncValue.data(user);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> switchRole(UserRole role) async {
    state = const AsyncValue.loading();
    try {
      final newUser = await _repository.switchRole(role);
      state = AsyncValue.data(newUser);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AsyncValue<UserModel>>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  return AuthNotifier(repository);
});
