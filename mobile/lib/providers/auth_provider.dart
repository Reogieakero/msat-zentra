import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/user_model.dart';
import '../data/repositories/auth_repository.dart';

final authRepositoryProvider = Provider<IAuthRepository>((ref) {
  return ApiAuthRepository();
});

class AuthNotifier extends StateNotifier<AsyncValue<UserModel?>> {
  final IAuthRepository _repository;

  AuthNotifier(this._repository) : super(const AsyncValue.data(null)) {
    _loadUser();
  }

  Future<void> _loadUser() async {
    try {
      final user = await _repository.getSavedUser();
      state = AsyncValue.data(user);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> login({
    required String identifier,
    required String password,
    required String roleCategory,
  }) async {
    state = const AsyncValue.loading();
    try {
      final user = await _repository.login(
        identifier: identifier,
        password: password,
        roleCategory: roleCategory,
      );
      state = AsyncValue.data(user);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  Future<void> logout() async {
    state = const AsyncValue.loading();
    await _repository.logout();
    state = const AsyncValue.data(null);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AsyncValue<UserModel?>>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  return AuthNotifier(repository);
});
