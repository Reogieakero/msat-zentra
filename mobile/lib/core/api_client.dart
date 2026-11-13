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

  /// Reads the refresh token out of a `Set-Cookie` header.
  ///
  /// The backend sends the refresh token as an httpOnly cookie and never in
  /// the JSON body, so the native client has to capture it here and replay it
  /// manually on `/api/auth/refresh`.
  String? refreshCookieFrom(Response res) {
    final headers = res.headers.map['set-cookie'];
    if (headers == null) return null;
    for (final header in headers) {
      for (final part in header.split(';')) {
        final idx = part.indexOf('=');
        if (idx < 0) continue;
        final name = part.substring(0, idx).trim();
        if (name == AppConfig.refreshCookieName) {
          final value = part.substring(idx + 1).trim();
          return value.isEmpty ? null : value;
        }
      }
    }
    return null;
  }

  Future<String?> _refresh() async {
    final refresh = await _storage.read(key: AppConfig.refreshTokenKey);
    if (refresh == null || refresh.isEmpty) return null;
    try {
      final res = await Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl)).post(
        '/api/auth/refresh',
        options: Options(headers: {
          'Cookie': '${AppConfig.refreshCookieName}=$refresh',
        }),
      );
      final access = res.data['accessToken'] as String?;
      final next = refreshCookieFrom(res) ?? res.data['refreshToken'] as String?;
      if (access != null) await _storage.write(key: AppConfig.accessTokenKey, value: access);
      if (next != null && next.isNotEmpty) {
        await _storage.write(key: AppConfig.refreshTokenKey, value: next);
      }
      return access;
    } catch (_) {
      return null;
    }
  }

  Future<void> saveSession({required String access, String? refresh}) async {
    await _storage.write(key: AppConfig.accessTokenKey, value: access);
    if (refresh != null && refresh.isNotEmpty) {
      await _storage.write(key: AppConfig.refreshTokenKey, value: refresh);
    }
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
      return ApiException(err['code']?.toString() ?? 'UNKNOWN', err['message']?.toString() ?? 'Request failed', statusCode: e.response?.statusCode, cause: e);
    }
    return ApiException(e.response == null ? 'NETWORK' : 'UNKNOWN', e.message ?? 'Request failed', statusCode: e.response?.statusCode, cause: e);
  }
}
