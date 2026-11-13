import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';

import 'models.dart';

const defaultUserError =
    'Something went wrong. Please try again. If it keeps happening, contact the school office.';
const _network =
    'We couldn’t connect. Check your internet connection and try again.';
const _timeout = 'This is taking longer than expected. Please try again.';
const _server = 'Something went wrong on our side. Please try again shortly.';
const _session = 'Your session has ended. Please sign in again.';

// Presentation only: original exceptions, codes and causes remain unchanged for
// diagnostics. Never display arbitrary exception.toString() or a 5xx response.
String userMessage(Object? error, {String fallback = defaultUserError}) {
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return _timeout;
      case DioExceptionType.connectionError:
        return _network;
      case DioExceptionType.badCertificate:
        return 'We couldn’t connect securely. Please try again later.';
      case DioExceptionType.cancel:
        return 'The request was cancelled. You can try again when you’re ready.';
      case DioExceptionType.unknown:
        if (error.response == null) return _network;
      case DioExceptionType.badResponse:
        break;
    }
    return _responseMessage(
      error.response?.data,
      status: error.response?.statusCode,
      fallback: fallback,
    );
  }
  if (error is ApiException) {
    // The cause retains transport details (timeouts, certificates, HTTP status).
    if (error.cause is DioException) {
      return userMessage(error.cause, fallback: fallback);
    }
    return _apiMessage(
      error.code,
      error.message,
      status: error.statusCode,
      fallback: fallback,
    );
  }
  if (error is TimeoutException) return _timeout;
  if (error is PlatformException) {
    if (error.code.toLowerCase().contains('permission') ||
        error.code.toLowerCase().contains('access_denied')) {
      return 'Permission is needed to use this feature. You can allow access in your device settings.';
    }
    return fallback;
  }
  if (error is Map) return _responseMessage(error, fallback: fallback);
  if (error is String) {
    // Also protect older call sites and locally stored error strings.
    final coded = RegExp(
      r'^(?:\[([A-Z][A-Z0-9_]+)\]\s*|([A-Z][A-Z0-9_]+):\s*)(.*)$',
      dotAll: true,
    ).firstMatch(error.trim());
    if (coded != null) {
      return _apiMessage(coded[1] ?? coded[2]!, coded[3], fallback: fallback);
    }
    return _safeText(error, fallback);
  }
  return fallback;
}

String _responseMessage(Object? data, {int? status, required String fallback}) {
  if (data is Map) {
    final envelope = data['error'];
    final detail = envelope is Map ? envelope : data;
    return _apiMessage(
      detail['code']?.toString(),
      detail['message'],
      status: status,
      fields: detail['fields'],
      fallback: fallback,
    );
  }
  return _apiMessage(null, null, status: status, fallback: fallback);
}

String _apiMessage(
  String? code,
  Object? message, {
  int? status,
  Object? fields,
  required String fallback,
}) {
  if (status != null && status >= 500) return _server;
  final mapped = switch (code) {
    'INVALID_CREDENTIALS' =>
      'The email or password doesn’t match. Check both and try again.',
    'ROLE_MISMATCH' => 'This account belongs to a different portal. Choose the correct account type and sign in again.',
    'ACCOUNT_PENDING' || 'PENDING_APPROVAL' => 'Your account is waiting for school approval. Please check with the school office.',
    'ACCOUNT_SUSPENDED' => 'Your account is currently suspended. Contact the school office for help.',
    'WRONG_PASSWORD' =>
      'Your current password doesn’t match. Please check it and try again.',
    'UNAUTHORIZED' ||
    'INVALID_REFRESH' ||
    'TOKEN_EXPIRED' ||
    'INVALID_TOKEN' ||
    'NO_TOKEN' => _session,
    'FORBIDDEN' || 'ACCESS_DENIED' => 'Your account doesn’t have access to this action. Contact the school office if you need help.',
    'NETWORK' || 'CONNECTION_ERROR' => _network,
    'TIMEOUT' => _timeout,
    'INTERNAL_ERROR' ||
    'INTERNAL_SERVER_ERROR' ||
    'DATABASE_ERROR' ||
    'SERVICE_UNAVAILABLE' => _server,
    'RATE_LIMITED' || 'TOO_MANY_REQUESTS' => 'There have been too many attempts. Please wait a few minutes before trying again.',
    'NOT_FOUND' => 'We couldn’t find this item. It may have been removed. Refresh the page and try again.',
    'DUPLICATE' || 'EMAIL_EXISTS' => 'This information is already on record. Check the existing entry before adding it again.',
    'REFERRAL_ALREADY_OPEN' => 'This learner already has an open referral for this service. Open the existing referral instead.',
    'ADM_EXEMPT_LEARNER' => 'This learner is on an approved ADM program and does not need classroom attendance marks.',
    'ASSESSMENT_AUDIENCE_MISMATCH' => 'This assessment is for a different learner group. Choose the assessment for this learner’s program.',
    'NO_TERM' => 'Choose a school year and term to continue.',
    'NO_SIGNATURE' => 'Save your signature in Settings before continuing.',
    'VALIDATION_ERROR' ||
    'VALIDATION_FAILED' ||
    'VALIDATION' ||
    'INVALID_INPUT' => _validationMessage(fields),
    _ => null,
  };
  if (mapped != null) return mapped;
  if (status == 401) return _session;
  if (status == 429) {
    return 'There have been too many attempts. Please wait a few minutes before trying again.';
  }
  // Keep useful, nontechnical school rules (including conflicts and upload
  // limits), but replace empty/technical messages with a safe status fallback.
  final statusFallback = switch (status) {
    401 => _session,
    403 => 'Your account doesn’t have access to this action. Contact the school office for help.',
    404 => 'We couldn’t find this item. Refresh the page and try again.',
    409 => 'This item has changed or is already on record. Refresh and check it before trying again.',
    413 => 'This file is too large. Choose a smaller file and try again.',
    422 || 400 => 'Please check the information you entered and try again.',
    429 => 'There have been too many attempts. Please wait a few minutes before trying again.',
    _ => fallback,
  };
  return _safeText(message, statusFallback);
}

String _validationMessage(Object? fields) {
  const labels = {
    'email': 'Email',
    'password': 'Password',
    'currentPassword': 'Current password',
    'newPassword': 'New password',
    'fullName': 'Full name',
    'lrn': 'Learner reference number',
    'observationDatetime': 'Observation date and time',
    'descriptionOfIncident': 'Incident description',
    'descriptionOfLocation': 'Location',
    'category': 'Category',
    'confidentialityLevel': 'Privacy level',
    'notesRecommendationsActions': 'Notes and recommendations',
    'rawScore': 'Score',
    'maxScore': 'Maximum score',
    'title': 'Title',
    'submissionUrl': 'Answer link',
    'code': 'Verification code',
    'contactNumber': 'Contact number',
  };
  if (fields is Map) {
    final names = fields.keys
        .map((key) => labels[key])
        .whereType<String>()
        .toSet();
    if (names.isNotEmpty) return 'Please check: ${names.join(', ')}.';
  }
  return 'Please check the information you entered and try again.';
}

String _safeText(Object? value, String fallback) {
  if (value is! String || value.trim().isEmpty) return fallback;
  final text = value.trim();
  final lower = text.toLowerCase();
  if (lower.contains('socketexception') ||
      lower.contains('failed host lookup')) {
    return _network;
  }
  if (lower.contains('timeoutexception')) return _timeout;
  // Never show SQL, HTML, URLs, stack traces, paths or framework exceptions.
  if (text.length > 400 ||
      RegExp(
        r'exception|stack\s*trace|prisma|postgres|sqlstate|typeerror|formaterror|nosuchmethod|instance of|constraint|invalid invocation|syntax error|\buuid\b|\bjwt\b|econn\w+|<[^>]+>|https?://|/[\w.-]+/|[A-Z]{2,}_[A-Z_]+|\bat\s+\S+\s*\(|\b(select|insert into|delete from|update)\b.+\b(from|where|values|set)\b',
        caseSensitive: false,
      ).hasMatch(text)) {
    return fallback;
  }
  if ([
    'request failed',
    'network error',
    'unknown',
    'failed',
    'invalid input',
    'internal server error',
    'unexpected error',
    'unauthorized',
    'forbidden',
    'not found',
    'bad request',
    'null',
  ].contains(lower)) {
    return fallback;
  }
  return text;
}
