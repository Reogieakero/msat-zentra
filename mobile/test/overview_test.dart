import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:zentra_mobile/core/api_client.dart';
import 'package:zentra_mobile/core/config.dart';
import 'package:zentra_mobile/core/session.dart';
import 'package:zentra_mobile/design/shell.dart';
import 'package:zentra_mobile/design/theme.dart';
import 'package:zentra_mobile/features/adviser/adviser_schedule_page.dart';
import 'package:zentra_mobile/features/auth/first_time_gate.dart';
import 'package:zentra_mobile/features/home/overview_data.dart';
import 'package:zentra_mobile/features/home/overview_page.dart';
import 'package:zentra_mobile/shared/models.dart';

Map<String, dynamic> critical({bool adviser = true}) => {
  'teacherName': 'Maria Santos', 'isAdviser': adviser,
  'advisorySection': adviser ? {'name': 'Grade 8 – Arts'} : null,
  'kpi': {
    'classCount': 4,
    'studentCount': 150,
    'pendingAssessments': 0,
    'openFlags': 99,
  },
  'advisoryTotal': 40, 'atRiskStudents': 3,
  // These intentionally contain just one row: never use list length as a total.
  'classes': [{}],
  'advisory': {
    'students': [{}],
  },
};

Map<String, dynamic> configJson() => {
  'startTime': '07:30',
  'periodMins': 60,
  'lunch': {'afterPeriod': 4, 'mins': 90},
  'morningRecess': {'enabled': true, 'afterPeriod': 2, 'mins': 15},
  'afternoonRecess': {'enabled': false, 'afterPeriod': 6, 'mins': 15},
};

Term term({String id = 'term', DateTime? start, DateTime? end}) => Term(
  id: id,
  schoolYearId: 'year',
  schoolYearName: '2026–2027',
  termNumber: 2,
  startDate: start ?? DateTime.utc(2020),
  endDate: end ?? DateTime.utc(2100),
);

TimetableSlot slot({int day = 1, int period = 0, String status = 'APPROVED'}) =>
    TimetableSlot(
      day: day,
      period: period,
      status: status,
      subjectName: 'Mathematics',
      subjectCode: 'MATH',
      sectionName: 'Arts',
    );

OverviewSchedule schedule({Term? scope, List<TimetableSlot>? slots}) =>
    OverviewSchedule(
      term: scope ?? term(),
      slots: slots ?? [slot()],
      config: SchoolDayConfig.fromJson(configJson()),
    );

class TestTermStore extends TermNotifier {
  TestTermStore(Term selected) {
    state = selected;
  }
  @override
  Future<void> select(Term term) async {
    state = term;
  }
}

class TestApi extends ApiClient {
  TestApi() {
    dio.interceptors.clear();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          paths.add(options.path);
          final Object data = switch (options.path) {
            '/api/teacher/schedule/config' => {'config': configJson()},
            '/api/teacher/schedule/my-slots' => {
              'slots': [
                {
                  'day': 1,
                  'period': 0,
                  'status': 'APPROVED',
                  'subject': {'name': 'Math'},
                  'section': {'name': 'Arts'},
                },
              ],
            },
            '/api/teacher/schedule/teachers/me' => {
              'teacherName': linked ? {'name': 'Teacher'} : null,
              'termGrant': verified ? {'id': 'grant'} : null,
            },
            _ => {},
          };
          handler.resolve(
            Response(requestOptions: options, statusCode: 200, data: data),
          );
        },
      ),
    );
  }
  final paths = <String>[];
  bool linked = true;
  bool verified = true;
  @override
  Future<String?> accessToken() async => null;
}

Future<void> mountOverview(
  WidgetTester tester, {
  bool adviser = true,
  FutureOr<Map<String, dynamic>> Function()? loadCritical,
  FutureOr<Map<String, dynamic>> Function()? loadSecondary,
  FutureOr<OverviewSchedule> Function()? loadSchedule,
  Size size = const Size(390, 844),
  double scale = 1,
  bool dark = false,
  Color? primary,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final api = TestApi();
  addTearDown(api.dio.close);
  final store = TestTermStore(term());
  final router = GoRouter(
    initialLocation: '/workspace/overview',
    routes: [
      GoRoute(
        path: '/workspace/overview',
        builder: (_, _) => const Scaffold(body: OverviewPage()),
      ),
      for (final path in [
        '/workspace/gradebook',
        '/workspace/attendance',
        '/workspace/classes',
        '/workspace/schedule',
        '/adviser/advisory',
        '/adviser/schedule',
        '/adviser/bama',
      ])
        GoRoute(
          path: path,
          builder: (_, state) => Scaffold(
            appBar: AppBar(),
            body: Text('Opened ${state.uri.path}'),
          ),
        ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authProvider.overrideWith((ref) => AuthNotifier(api)),
        termProvider.overrideWith((ref) => store),
        overviewProvider.overrideWith((ref) {
          ref.watch(termProvider);
          return loadCritical != null
              ? loadCritical()
              : critical(adviser: adviser);
        }),
        overviewSecondaryProvider.overrideWith((ref) {
          ref.watch(termProvider);
          return loadSecondary != null
              ? loadSecondary()
              : {'pendingAssessments': 2};
        }),
        overviewScheduleProvider.overrideWith((ref) {
          ref.watch(termProvider);
          return loadSchedule != null ? loadSchedule() : schedule();
        }),
      ],
      child: MaterialApp.router(
        theme: dark
            ? zDarkTheme(primaryOverride: primary)
            : zLightTheme(primaryOverride: primary),
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(scale),
            disableAnimations: true,
          ),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  late Directory temp;
  setUpAll(() async {
    temp = await Directory.systemTemp.createTemp('zentra-overview-tests-');
    Hive.init(temp.path);
    await Hive.openBox(AppConfig.termScopeBox);
    await Hive.openBox(AppConfig.outboxBox);
  });
  tearDownAll(() async {
    await Hive.close();
    await temp.delete(recursive: true);
  });

  test(
    'summary uses authoritative counts, not lists or misnamed openFlags',
    () {
      final adviser = OverviewSummary.fromJson(critical());
      expect(adviser.classCount, 4);
      expect(adviser.learnerCount, 40);
      expect(adviser.supportCount, 3);
      final teacher = OverviewSummary.fromJson(critical(adviser: false));
      expect(teacher.learnerCount, 150);
      expect(teacher.supportCount, isNull);
      expect(
        OverviewAttention.fromJson({'pendingAssessments': 2})
            .pendingAssessments,
        2,
      );
      expect(OverviewSummary.fromJson({}).classCount, isNull);
      expect(
        OverviewSummary.fromJson({
          'kpi': {'classCount': -1},
        }).classCount,
        isNull,
      );
      expect(OverviewAttention.fromJson({}).pendingAssessments, isNull);
    },
  );

  test('period times include breaks and web lunch precedence', () {
    final config = SchoolDayConfig.fromJson(configJson());
    expect(config.periods[0], (start: 450, end: 510));
    expect(config.periods[2], (start: 585, end: 645));
    expect(config.periods[4], (start: 795, end: 855));
    final sameBreak = configJson();
    sameBreak['morningRecess'] = {
      'enabled': true,
      'afterPeriod': 4,
      'mins': 15,
    };
    expect(SchoolDayConfig.fromJson(sameBreak).periods[4].start, 780);
    expect(() => SchoolDayConfig.fromJson({}), throwsFormatException);
    expect(
      () => SchoolDayConfig.fromJson({...configJson(), 'startTime': '99:99'}),
      throwsFormatException,
    );
  });

  test(
    'next class uses Philippine date, approved slots and zero-based periods',
    () {
      final now = DateTime.utc(2026, 11, 15, 23); // Monday, 7 AM PH.
      final result = schedule(
        slots: [
          slot(period: 2),
          slot(period: 0, status: 'SUBMITTED'),
          slot(period: 1),
        ],
      ).nextClass(now)!;
      expect(result.startsAt, DateTime.utc(2026, 11, 16, 0, 30));
      expect(result.endsAt, DateTime.utc(2026, 11, 16, 1, 30));
      expect(result.slot.period, 1);
      final nextWeek = schedule().nextClass(DateTime.utc(2026, 11, 20, 12))!;
      expect(philippineTime(nextWeek.startsAt).weekday, DateTime.monday);
      expect(philippineTime(nextWeek.startsAt).day, 23);
    },
  );

  test('historical, future, missing-date and term-end scopes do not invent classes', () {
    final now = DateTime.utc(2026, 11, 16);
    expect(
      schedule(scope: term(end: DateTime.utc(2025))).nextClass(now),
      isNull,
    );
    expect(
      schedule(scope: term(start: DateTime.utc(2027))).scopeNotice(now),
      contains('different term'),
    );
    final undated = Term(
      id: 'u',
      schoolYearId: 'year',
      schoolYearName: '',
      termNumber: 1,
    );
    expect(
      schedule(scope: undated).scopeNotice(now),
      contains('dates aren’t available'),
    );
    expect(
      schedule(
        scope: term(end: now.add(const Duration(hours: 1))),
        slots: [slot(period: 7)],
      ).nextClass(now),
      isNull,
    );
    expect(
      schedule(
        slots: [
          slot(status: 'SUBMITTED'),
          slot(period: 50),
        ],
      ).nextClass(now),
      isNull,
    );
  });

  test(
    'schedule source is shared and reloads when the selected term changes',
    () async {
      final api = TestApi();
      final store = TestTermStore(term());
      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          termProvider.overrideWith((ref) => store),
          schoolYearsProvider.overrideWith(
            (ref) => [
              SchoolYear(
                id: 'year',
                name: 'Year',
                isActive: true,
                terms: [
                  term(),
                  term(id: 'next'),
                ],
              ),
            ],
          ),
        ],
      );
      final sub = container.listen(overviewScheduleProvider, (_, _) {});
      await container.read(overviewScheduleProvider.future);
      await container.read(adviserScheduleProvider.future);
      expect(api.paths.where((p) => p.endsWith('/my-slots')).length, 1);
      await store.select(term(id: 'next'));
      final reloaded = await container.read(overviewScheduleProvider.future);
      expect(reloaded.term.id, 'next');
      expect(api.paths.where((p) => p.endsWith('/my-slots')).length, 2);
      sub.close();
      container.dispose();
      api.dio.close();
    },
  );

  testWidgets(
    'quick actions honor permissions and open existing destinations',
    (tester) async {
      final opened = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OverviewQuickActions(isAdviser: true, onOpen: opened.add),
          ),
        ),
      );
      for (final label in [
        'Chat with Bama',
        'Enter grades',
        'Take attendance',
      ]) {
        await tester.tap(find.text(label));
      }
      expect(opened, [
        '/adviser/bama?new=1',
        '/workspace/gradebook',
        '/workspace/attendance',
      ]);
      opened.clear();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OverviewQuickActions(isAdviser: false, onOpen: opened.add),
          ),
        ),
      );
      await tester.tap(find.text('Chat with Bama'));
      expect(opened, isEmpty);
      expect(find.text('Advisers only'), findsOneWidget);
    },
  );

  testWidgets('overview shows real totals and secondary grading count', (
    tester,
  ) async {
    await mountOverview(tester);
    expect(find.text('Welcome back, Maria Santos.'), findsOneWidget);
    expect(find.textContaining('Grade 8 – Arts'), findsOneWidget);
    expect(find.text('2 assessments with missing scores'), findsOneWidget);
    expect(find.text('3 learners may need support'), findsOneWidget);
    expect(find.textContaining('grade flags'), findsNothing);
    await tester.ensureVisible(find.text('At a glance'));
    expect(find.text('40'), findsOneWidget);
    expect(find.text('150'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'subject teachers see teaching totals without adviser-only content',
    (tester) async {
      await mountOverview(tester, adviser: false);
      expect(find.text('Advisers only'), findsOneWidget);
      expect(find.textContaining('may need support'), findsNothing);
      await tester.ensureVisible(find.text('At a glance'));
      expect(find.text('150'), findsOneWidget);
      expect(find.text('Need support'), findsNothing);
    },
  );

  testWidgets('secondary failure leaves quick actions and schedule usable', (
    tester,
  ) async {
    await mountOverview(
      tester,
      loadSecondary: () => throw ApiException('NETWORK', 'private details'),
    );
    expect(find.text('Enter grades'), findsOneWidget);
    expect(find.text('Mathematics'), findsOneWidget);
    expect(find.textContaining('internet connection'), findsOneWidget);
    expect(find.textContaining('private details'), findsNothing);
    expect(find.textContaining('No missing scores'), findsNothing);
  });

  testWidgets('all-clear is limited to known checks, never missing data', (
    tester,
  ) async {
    await mountOverview(
      tester,
      adviser: false,
      loadSecondary: () => {'pendingAssessments': 0},
    );
    expect(find.text('No missing scores from these checks.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    await mountOverview(tester, loadSecondary: () => {});
    expect(find.textContaining('summary is unavailable'), findsOneWidget);
    expect(find.textContaining('No missing scores'), findsNothing);
  });

  testWidgets(
    'pull refresh waits for every request and returning from grades refreshes',
    (tester) async {
      var calls = 0;
      Completer<Map<String, dynamic>>? pending;
      await mountOverview(
        tester,
        loadSecondary: () {
          calls++;
          return pending?.future ?? {'pendingAssessments': 2};
        },
      );
      await tester.tap(find.text('Enter grades'));
      await tester.pumpAndSettle();
      expect(find.text('Opened /workspace/gradebook'), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(calls, 2);
      pending = Completer<Map<String, dynamic>>();
      final refresh = tester
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh();
      var finished = false;
      unawaited(refresh.then((_) => finished = true));
      await tester.pump();
      expect(finished, isFalse);
      pending.complete({'pendingAssessments': 0});
      await tester.pumpAndSettle();
      expect(finished, isTrue);
    },
  );

  testWidgets('live refresh pauses while another route is open', (
    tester,
  ) async {
    var calls = 0;
    await mountOverview(
      tester,
      loadSecondary: () {
        calls++;
        return {'pendingAssessments': 2};
      },
    );
    await tester.pump(const Duration(seconds: 21));
    await tester.pump();
    expect(calls, 2);
    await tester.tap(find.text('Enter grades'));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 21));
    expect(calls, 2);
  });

  testWidgets(
    'loading does not block quick actions or pretend counts are zero',
    (tester) async {
      final secondary = Completer<Map<String, dynamic>>();
      final upcoming = Completer<OverviewSchedule>();
      await mountOverview(
        tester,
        loadSecondary: () => secondary.future,
        loadSchedule: () => upcoming.future,
      );
      expect(find.text('Enter grades'), findsOneWidget);
      expect(find.textContaining('No missing scores'), findsNothing);
      expect(find.textContaining('No upcoming confirmed'), findsNothing);
      secondary.complete({'pendingAssessments': 0});
      upcoming.complete(schedule(slots: []));
      await tester.pumpAndSettle();
      expect(
        find.text('No upcoming confirmed classes in this term.'),
        findsOneWidget,
      );
    },
  );

  testWidgets('schedule errors are isolated and retry loads the schedule', (
    tester,
  ) async {
    var calls = 0;
    await mountOverview(
      tester,
      loadSchedule: () {
        calls++;
        if (calls == 1) throw ApiException('NETWORK', 'private data');
        return schedule();
      },
    );
    expect(find.text('2 assessments with missing scores'), findsOneWidget);
    await tester.ensureVisible(find.text('Try again'));
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(find.text('Mathematics'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('drawer places Overview before role-specific destinations', (
    tester,
  ) async {
    final api = TestApi();
    addTearDown(api.dio.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          authProvider.overrideWith((ref) => AuthNotifier(api)),
          termProvider.overrideWith((ref) => TestTermStore(term())),
          overviewProvider.overrideWith((ref) => critical()),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: ZentraDrawer(selectedPath: '/workspace/overview'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final tile = find.widgetWithText(ListTile, 'Overview');
    expect(tester.widget<ListTile>(tile).selected, isTrue);
    expect(
      tester.getTopLeft(tile).dy,
      lessThan(tester.getTopLeft(find.text('Advisory list')).dy),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('class linking is still required before Overview', (
    tester,
  ) async {
    final api = TestApi()..linked = false;
    addTearDown(api.dio.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          overviewProvider.overrideWith((ref) => critical()),
        ],
        child: const MaterialApp(home: FirstTimeGate()),
      ),
    );
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('Link your classes'), findsWidgets);
    expect(find.text('Overview landing'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'term changes replace the overview instead of retaining old totals',
    (tester) async {
      var calls = 0;
      await mountOverview(
        tester,
        loadCritical: () {
          calls++;
          return {
            ...critical(),
            'teacherName': calls == 1 ? 'Maria Santos' : 'Updated teacher',
            'advisoryTotal': calls == 1 ? 40 : 22,
          };
        },
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(OverviewPage)),
      );
      await container
          .read(termProvider.notifier)
          .select(
            Term(
              id: 'new-term',
              schoolYearId: 'year',
              schoolYearName: '2027–2028',
              termNumber: 3,
            ),
          );
      await tester.pumpAndSettle();
      expect(find.text('Welcome back, Updated teacher.'), findsOneWidget);
      expect(find.textContaining('2027–2028 · Term 3'), findsOneWidget);
      await tester.ensureVisible(find.text('At a glance'));
      expect(find.text('22'), findsOneWidget);
      expect(find.text('40'), findsNothing);
    },
  );

  testWidgets('refresh pauses when the app is in the background', (
    tester,
  ) async {
    var calls = 0;
    await mountOverview(
      tester,
      loadSecondary: () {
        calls++;
        return {'pendingAssessments': 2};
      },
    );
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    addTearDown(
      () => tester.binding.handleAppLifecycleStateChanged(
        AppLifecycleState.resumed,
      ),
    );
    await tester.pump(const Duration(seconds: 21));
    expect(calls, 1);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(calls, 2);
  });

  for (final dark in [false, true]) {
    for (final width in [320.0, 700.0, 1200.0]) {
      testWidgets('overview fits $width with larger text, dark=$dark', (
        tester,
      ) async {
        await mountOverview(
          tester,
          size: Size(width, 900),
          scale: 1.5,
          dark: dark,
        );
        await tester.ensureVisible(find.text('At a glance'));
        await tester.pump();
        expect(tester.takeException(), isNull);
        expect(find.text('Chat with Bama'), findsOneWidget);
      });
    }
    testWidgets(
      'overview preserves custom palette at narrow width, dark=$dark',
      (tester) async {
        await mountOverview(
          tester,
          size: const Size(320, 900),
          scale: 1.5,
          dark: dark,
          primary: const Color(0xFF16A34A),
        );
        await tester.ensureVisible(find.text('At a glance'));
        await tester.pump();
        expect(
          Theme.of(tester.element(find.byType(OverviewPage)))
              .colorScheme
              .primary,
          const Color(0xFF16A34A),
        );
        expect(tester.takeException(), isNull);
      },
    );
  }

  for (final adviser in [false, true]) {
    testWidgets(
      'verified ${adviser ? 'adviser' : 'teacher'} lands on Overview',
      (tester) async {
        final api = TestApi();
        addTearDown(api.dio.close);
        final router = GoRouter(
          initialLocation: '/gate',
          routes: [
            GoRoute(path: '/gate', builder: (_, _) => const FirstTimeGate()),
            GoRoute(
              path: '/workspace/overview',
              builder: (_, _) => const Scaffold(body: Text('Overview landing')),
            ),
          ],
        );
        addTearDown(router.dispose);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              apiClientProvider.overrideWithValue(api),
              overviewProvider.overrideWith(
                (ref) => critical(adviser: adviser),
              ),
            ],
            child: MaterialApp.router(routerConfig: router),
          ),
        );
        for (var i = 0; i < 12; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(find.text('Overview landing'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('verification is still required before the new landing', (
    tester,
  ) async {
    final api = TestApi()..verified = false;
    addTearDown(api.dio.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          overviewProvider.overrideWith((ref) => critical(adviser: false)),
        ],
        child: const MaterialApp(home: FirstTimeGate()),
      ),
    );
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('Verify for this term'), findsWidgets);
    expect(find.text('Overview landing'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
