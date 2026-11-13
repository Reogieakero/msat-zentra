import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zentra_mobile/core/api_client.dart';
import 'package:zentra_mobile/shared/models.dart';
import 'package:zentra_mobile/shared/user_messages.dart';
import 'package:zentra_mobile/shared/widgets.dart';

DioException failure({
  DioExceptionType type = DioExceptionType.badResponse,
  int? status,
  Object? data,
}) {
  final request = RequestOptions(path: '/private/server/path');
  return DioException(
    requestOptions: request,
    type: type,
    message: 'Technical transport details must not be displayed',
    response: status == null
        ? null
        : Response(requestOptions: request, statusCode: status, data: data),
  );
}

void main() {
  for (final type in [
    DioExceptionType.connectionTimeout,
    DioExceptionType.sendTimeout,
    DioExceptionType.receiveTimeout,
    DioExceptionType.transformTimeout,
  ]) {
    test('$type explains the delay', () {
      expect(userMessage(failure(type: type)), contains('taking longer'));
    });
  }

  test('network, certificate and cancellation messages offer a next step', () {
    expect(
      userMessage(failure(type: DioExceptionType.connectionError)),
      contains('internet connection'),
    );
    expect(
      userMessage(failure(type: DioExceptionType.unknown)),
      contains('internet connection'),
    );
    expect(
      userMessage(failure(type: DioExceptionType.badCertificate)),
      contains('connect securely'),
    );
    expect(
      userMessage(failure(type: DioExceptionType.cancel)),
      contains('cancelled'),
    );
    expect(userMessage(TimeoutException('private')), contains('taking longer'));
  });

  final codes = {
    'INVALID_CREDENTIALS': 'email or password',
    'ROLE_MISMATCH': 'different portal',
    'ACCOUNT_PENDING': 'school approval',
    'ACCOUNT_SUSPENDED': 'school office',
    'WRONG_PASSWORD': 'current password',
    'INVALID_REFRESH': 'sign in again',
    'FORBIDDEN': 'doesn’t have access',
    'RATE_LIMITED': 'wait a few minutes',
    'REFERRAL_ALREADY_OPEN': 'existing referral',
    'ADM_EXEMPT_LEARNER': 'does not need classroom attendance',
    'ASSESSMENT_AUDIENCE_MISMATCH': 'different learner group',
    'NO_SIGNATURE': 'Save your signature',
    'NO_TERM': 'school year and term',
  };
  for (final entry in codes.entries) {
    test('${entry.key} is translated without showing its code', () {
      final text = userMessage(ApiException(entry.key, 'Raw server message'));
      expect(text, contains(entry.value));
      expect(text, isNot(contains(entry.key)));
    });
  }

  test('server status always hides backend details, even recognized codes', () {
    for (final status in [500, 502, 503]) {
      expect(
        userMessage(
          failure(
            status: status,
            data: {
              'error': {
                'code': 'INVALID_CREDENTIALS',
                'message': 'Prisma secret SQL',
              },
            },
          ),
        ),
        'Something went wrong on our side. Please try again shortly.',
      );
    }
  });

  test('status fallbacks handle HTML, empty responses and unknown codes', () {
    expect(
      userMessage(failure(status: 401, data: {'message': 'Unauthorized'})),
      contains('sign in again'),
    );
    expect(
      userMessage(failure(status: 403, data: '<html>private</html>')),
      contains('doesn’t have access'),
    );
    expect(userMessage(failure(status: 404)), contains('couldn’t find'));
    expect(userMessage(failure(status: 409)), contains('already on record'));
    expect(userMessage(failure(status: 413)), contains('smaller file'));
    expect(
      userMessage(failure(status: 422)),
      contains('information you entered'),
    );
    expect(
      userMessage(failure(status: 429, data: {'message': 'Too fast'})),
      contains('wait a few minutes'),
    );
  });

  test('safe school rules and upload limits are preserved', () {
    const policy =
        'Complete at least one session before closing this referral.';
    expect(
      userMessage(
        failure(
          status: 409,
          data: {
            'error': {'code': 'SESSION_REQUIRED', 'message': policy},
          },
        ),
      ),
      policy,
    );
    const upload = 'Choose a photo smaller than 10 MB.';
    expect(userMessage(ApiException('FILE_TOO_LARGE', upload)), upload);
    expect(userMessage('Enter your school email.'), 'Enter your school email.');
  });

  test('field errors show friendly labels, not schema keys or raw issues', () {
    expect(
      userMessage({
        'error': {
          'code': 'VALIDATION_ERROR',
          'message': 'Invalid input',
          'fields': {
            'observationDatetime': ['Invalid datetime'],
            'lrn': ['Expected string'],
            'privateInternalId': ['secret'],
          },
        },
      }),
      'Please check: Observation date and time, Learner reference number.',
    );
    expect(
      userMessage({
        'error': {
          'code': 'VALIDATION_ERROR',
          'fields': {
            'unknownField': ['secret'],
          },
        },
      }),
      'Please check the information you entered and try again.',
    );
  });

  test('unknown errors never expose exception text', () {
    for (final error in [
      Exception('secret'),
      StateError('secret'),
      null,
      'PrismaClientKnownRequestError at /srv/app.ts',
      '<html>proxy failure</html>',
      'SELECT password FROM User WHERE id=1',
      'Unique constraint failed on fields: email',
      'Exception: internal',
      'https://private.example/server',
      'INTERNAL_ERROR: secret',
      '[INTERNAL_ERROR] secret',
    ]) {
      final text = userMessage(error);
      expect(
        text,
        anyOf(
          defaultUserError,
          'Something went wrong on our side. Please try again shortly.',
        ),
      );
    }
    expect(
      userMessage(
        StateError('secret'),
        fallback: 'We couldn’t save this score. Please try again.',
      ),
      'We couldn’t save this score. Please try again.',
    );
  });

  test('device permission errors guide users to settings', () {
    expect(
      userMessage(
        PlatformException(
          code: 'photo_access_denied',
          message: 'Native secret',
        ),
      ),
      contains('device settings'),
    );
    expect(
      userMessage(PlatformException(code: 'unknown', message: 'Native secret')),
      defaultUserError,
    );
  });

  test(
    'API conversion retains status and cause for display and diagnostics',
    () {
      final api = ApiClient();
      final original = failure(
        status: 503,
        data: {
          'error': {'code': 'INTERNAL_ERROR', 'message': 'Raw server details'},
        },
      );
      final converted = api.toApiException(original);
      expect(converted.statusCode, 503);
      expect(converted.code, 'INTERNAL_ERROR');
      expect(converted.message, 'Raw server details');
      expect(converted.cause, same(original));
      expect(converted.toString(), 'INTERNAL_ERROR: Raw server details');
      expect(userMessage(converted), contains('on our side'));
      final timeout = api.toApiException(
        failure(type: DioExceptionType.receiveTimeout),
      );
      expect(userMessage(timeout), contains('taking longer'));
      api.dio.close();
    },
  );

  testWidgets('ErrorView sanitizes errors and keeps Try again working', (
    tester,
  ) async {
    var retries = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ErrorView(
            message: failure(
              status: 500,
              data: '<html>Private server details</html>',
            ),
            onRetry: () => retries++,
          ),
        ),
      ),
    );
    expect(
      find.text('Something went wrong on our side. Please try again shortly.'),
      findsOneWidget,
    );
    expect(find.textContaining('Private server details'), findsNothing);
    await tester.tap(find.text('Try again'));
    expect(retries, 1);
    expect(tester.takeException(), isNull);
  });
}
