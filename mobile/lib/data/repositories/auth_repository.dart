import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../models/user_model.dart';
import '../mock/mock_data.dart';

abstract class IAuthRepository {
  Future<UserModel?> getSavedUser();
  Future<UserModel> login({
    required String identifier,
    required String password,
    required String roleCategory, // 'student' | 'staff' | 'parent'
  });
  Future<void> logout();
}

class ApiAuthRepository implements IAuthRepository {
  final Dio _dio;
  UserModel? _currentUser;
  String? _accessToken;
  String? _refreshToken;

  ApiAuthRepository({Dio? dio}) : _dio = dio ?? Dio();

  String get _baseUrl {
    return dotenv.env['API_BASE_URL'] ??
        dotenv.env['NEXT_PUBLIC_API_BASE_URL'] ??
        'http://localhost:4000';
  }

  String? get accessToken => _accessToken;

  @override
  Future<UserModel?> getSavedUser() async {
    return _currentUser;
  }

  @override
  Future<UserModel> login({
    required String identifier,
    required String password,
    required String roleCategory,
  }) async {
    final String cleanIdentifier = identifier.trim();

    try {
      final response = await _dio.post(
        '$_baseUrl/api/auth/login',
        data: {
          'email': cleanIdentifier,
          'password': password,
          'role': roleCategory,
        },
        options: Options(
          headers: {'Content-Type': 'application/json'},
          validateStatus: (status) => status != null && status < 500,
        ),
      );

      if (response.statusCode == 200) {
        final data = response.data;
        _accessToken = data['accessToken'] as String?;
        _refreshToken = data['refreshToken'] as String?;
        final String roleStr = data['role'] as String? ?? roleCategory;
        final UserRole role = _parseRole(roleStr);

        _currentUser = UserModel(
          id: 'usr_${DateTime.now().millisecondsSinceEpoch}',
          email: cleanIdentifier,
          fullName: _formatNameFromEmail(cleanIdentifier, role),
          role: role,
        );

        return _currentUser!;
      } else {
        final message = response.data?['message'] ??
            'Sign in failed (${response.statusCode}). Check your credentials.';
        throw Exception(message);
      }
    } catch (e) {
      // Offline / fallback mock authentication if server is unreachable
      if (e is DioException &&
          (e.type == DioExceptionType.connectionError ||
              e.type == DioExceptionType.connectionTimeout ||
              e.type == DioExceptionType.unknown)) {
        return _fallbackMockLogin(cleanIdentifier, roleCategory);
      }
      rethrow;
    }
  }

  @override
  Future<void> logout() async {
    _currentUser = null;
    _accessToken = null;
    _refreshToken = null;
  }

  UserModel _fallbackMockLogin(String identifier, String roleCategory) {
    UserRole role;
    if (roleCategory == 'student') {
      role = UserRole.student;
      _currentUser = MockData.studentUser;
    } else if (roleCategory == 'parent') {
      role = UserRole.parent;
      _currentUser = MockData.parentUser;
    } else {
      if (identifier.contains('adm')) {
        role = UserRole.adm_coordinator;
        _currentUser = MockData.admCoordinatorUser;
      } else {
        role = UserRole.adviser;
        _currentUser = MockData.teacherUser;
      }
    }
    return _currentUser!;
  }

  UserRole _parseRole(String roleStr) {
    switch (roleStr) {
      case 'student':
        return UserRole.student;
      case 'parent':
        return UserRole.parent;
      case 'subject_teacher':
        return UserRole.subject_teacher;
      case 'adviser':
        return UserRole.adviser;
      case 'nurse':
        return UserRole.nurse;
      case 'adm_coordinator':
        return UserRole.adm_coordinator;
      case 'guidance_counselor':
        return UserRole.guidance_counselor;
      case 'record_keeper':
        return UserRole.record_keeper;
      case 'registrar':
        return UserRole.registrar;
      case 'principal':
        return UserRole.principal;
      default:
        return UserRole.subject_teacher;
    }
  }

  String _formatNameFromEmail(String email, UserRole role) {
    final namePart = email.split('@').first.replaceAll('.', ' ');
    final capitalized = namePart
        .split(' ')
        .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
        .join(' ');
    return '$capitalized (${role.displayName})';
  }
}
