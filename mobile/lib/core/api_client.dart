// Zentra mobile — Dio API client.
// Direct Dart port of frontend/src/lib/api/client.ts:
// - baseURL from --dart-define API_BASE_URL
// - attaches Bearer + x-school-year-id / x-term-id on every request
// - single-flight refresh on 401 via POST /api/auth/refresh, else logout.

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'config.dart';
import '../shared/models.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

class ApiClient {
  late final Dio dio;
  final _storage = const FlutterSecureStorage();
  Future<String?>? _refreshFlight;

  ApiClient() {
    dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {'Content-Type': 'application/json'},
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
    ));
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (opts, handler) async {
        final token = await _storage.read(key: AppConfig.accessTokenKey);
        if (token != null && token.isNotEmpty) {
          opts.headers['Authorization'] = 'Bearer $token';
        }
        if (Hive.isBoxOpen(AppConfig.termScopeBox)) {
          final box = Hive.box(AppConfig.termScopeBox);
          final sy = box.get('schoolYearId') as String?;
          final term = box.get('termId') as String?;
          if (sy != null) opts.headers['x-school-year-id'] = sy;
          if (term != null) opts.headers['x-term-id'] = term;
        }
        handler.next(opts);
      },
      onError: (err, handler) async {
        final req = err.requestOptions;
        if (err.response?.statusCode == 401 && req.extra['retry'] != true) {
          req.extra['retry'] = true;
          try {
            final token = await (_refreshFlight ??= _refresh());
            _refreshFlight = null;
            if (token != null) {
              req.headers['Authorization'] = 'Bearer $token';
              final res = await dio.fetch(req);
              return handler.resolve(res);
            }
          } catch (_) {
            _refreshFlight = null;
          }
          await logout();
        }
        handler.next(err);
      },
    ));
  }

  Future<String?> _refresh() async {
    final refresh = await _storage.read(key: AppConfig.refreshTokenKey);
    if (refresh == null) return null;
    try {
      final res = await Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl))
          .post('/api/auth/refresh', data: {'refreshToken': refresh});
      final access = res.data['accessToken'] as String?;
      final next = res.data['refreshToken'] as String?;
      if (access != null) await _storage.write(key: AppConfig.accessTokenKey, value: access);
      if (next != null) await _storage.write(key: AppConfig.refreshTokenKey, value: next);
      return access;
    } catch (_) {
      return null;
    }
  }

  Future<void> saveSession({required String access, required String refresh}) async {
    await _storage.write(key: AppConfig.accessTokenKey, value: access);
    await _storage.write(key: AppConfig.refreshTokenKey, value: refresh);
  }

  Future<void> logout() async {
    await _storage.delete(key: AppConfig.accessTokenKey);
    await _storage.delete(key: AppConfig.refreshTokenKey);
  }

  Future<String?> accessToken() => _storage.read(key: AppConfig.accessTokenKey);

  Never throwApi(DioException e) => throw toApiException(e);

  ApiException toApiException(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] is Map) {
      final err = data['error'] as Map;
      throw ApiException(err['code']?.toString() ?? 'UNKNOWN', err['message']?.toString() ?? 'Request failed');
    }
    throw ApiException('NETWORK', e.message ?? 'Network error');
  }
}
