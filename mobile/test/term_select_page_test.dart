import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:zentra_mobile/core/config.dart';
import 'package:zentra_mobile/core/api_client.dart';
import 'package:zentra_mobile/core/session.dart';
import 'package:zentra_mobile/features/auth/auth_flow_ui.dart';
import 'package:zentra_mobile/features/auth/first_time_gate.dart';
import 'package:zentra_mobile/features/auth/login_background.dart';
import 'package:zentra_mobile/features/auth/term_select_page.dart';
import 'package:zentra_mobile/shared/models.dart';

List<SchoolYear> fixture() => [
  SchoolYear.fromJson({
    'id': 'active',
    'name': '2026–2027',
    'isActive': true,
    'terms': [
      {
        'id': 't3',
        'termNumber': 3,
        'startDate': '2027-03-01T00:00:00Z',
        'endDate': '2027-06-01T00:00:00Z',
      },
      {
        'id': 't1',
        'termNumber': 1,
        'startDate': '2026-06-01T00:00:00Z',
        'endDate': '2026-09-01T00:00:00Z',
      },
      {
        'id': 't2',
        'termNumber': 2,
        'startDate': '2026-10-01T00:00:00Z',
        'endDate': '2027-02-01T00:00:00Z',
      },
    ],
  }),
  SchoolYear.fromJson({
    'id': 'older',
    'name': '2025–2026',
    'isActive': false,
    'terms': [
      {'id': 'old-t1', 'termNumber': 1},
    ],
  }),
];

class TestTermNotifier extends TermNotifier {
  int calls = 0;
  Term? selected;
  Completer<void>? pending;
  bool fail = false;

  @override
  Future<void> select(Term term) async {
    calls++;
    if (pending != null) await pending!.future;
    if (fail) throw StateError('private storage details');
    selected = term;
    state = term;
  }
}

class _GateApi extends ApiClient {
  bool linked = true;
  _GateApi() {
    dio.interceptors.clear();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'teacherName': linked ? {'name': 'Teacher'} : null,
                'termGrant': {'id': 'grant'},
              },
            ),
          );
        },
      ),
    );
  }
}

Future<TestTermNotifier> mount(
  WidgetTester tester, {
  List<SchoolYear>? years,
  FutureOr<List<SchoolYear>> Function()? load,
  TestTermNotifier? notifier,
  bool reducedMotion = true,
  Size size = const Size(390, 844),
  double textScale = 1,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final store = notifier ?? TestTermNotifier();
  final router = GoRouter(
    initialLocation: '/term',
    routes: [
      GoRoute(path: '/term', builder: (_, _) => const TermSelectPage()),
      GoRoute(
        path: '/gate',
        builder: (_, _) => const Scaffold(body: Text('Workspace gate')),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        schoolYearsProvider.overrideWith(
          (ref) => load != null ? load() : years ?? fixture(),
        ),
        termProvider.overrideWith((ref) => store),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            disableAnimations: reducedMotion,
            textScaler: TextScaler.linear(textScale),
          ),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pump();
  return store;
}

void main() {
  late Directory temp;
  setUpAll(() async {
    temp = await Directory.systemTemp.createTemp('zentra-term-test-');
    Hive.init(temp.path);
    await Hive.openBox(AppConfig.termScopeBox);
  });
  setUp(() async => Hive.box(AppConfig.termScopeBox).clear());
  tearDownAll(() async {
    await Hive.close();
    await temp.delete(recursive: true);
  });

  test(
    'school-year DTO retains names, dates and backwards-compatible caches',
    () {
      final term = fixture().first.terms.first;
      expect(term.schoolYearName, '2026–2027');
      expect(term.startDate, DateTime.utc(2027, 3));
      final cached = Term.fromCache(term.toJson());
      expect(cached.startDate, term.startDate);
      expect(cached.endDate, term.endDate);
      final legacy = Term.fromCache({
        'termId': 'legacy',
        'schoolYearId': 'sy',
        'termNumber': 1,
      });
      expect(legacy.startDate, isNull);
      expect(legacy.endDate, isNull);
    },
  );

  test('term status and default match web date boundaries', () {
    final years = fixture();
    final term = years.first.terms.last;
    expect(termStatus(term, term.startDate!), 'Ongoing');
    expect(termStatus(term, term.endDate!), 'Ongoing');
    expect(termStatus(term, DateTime.utc(2026, 9)), 'Upcoming');
    expect(termStatus(term, DateTime.utc(2027, 3)), 'Ended');
    expect(termStatus(years.last.terms.first, DateTime.now()), isNull);
    expect(defaultTerm(years, DateTime.utc(2026, 11))?.id, 't2');
    expect(defaultTerm(years, DateTime.utc(2030))?.id, 't1');
    expect(defaultTerm([], DateTime.now()), isNull);
    final invalid = Term.fromJson({
      'id': 'bad',
      'startDate': 'invalid',
      'endDate': null,
    }, 'sy');
    expect(termStatus(invalid, DateTime.now()), isNull);
    final reversed = Term(
      id: 'reversed',
      schoolYearId: 'sy',
      schoolYearName: 'SY',
      termNumber: 1,
      startDate: DateTime.utc(2027),
      endDate: DateTime.utc(2026),
    );
    expect(termStatus(reversed, DateTime.now()), isNull);
  });

  test('term store persists selected scope and optional dates', () async {
    final store = TermNotifier();
    final term = fixture().first.terms.first;
    await store.select(term);
    final box = Hive.box(AppConfig.termScopeBox);
    expect(box.get('termId'), term.id);
    expect(box.get('schoolYearId'), term.schoolYearId);
    final cached = Term.fromCache(
      Map<String, dynamic>.from(box.get('scope') as Map),
    );
    expect(cached.schoolYearName, term.schoolYearName);
    expect(cached.startDate, term.startDate);
    store.dispose();
  });

  testWidgets('sorted cards appear once and selecting does not navigate', (
    tester,
  ) async {
    final store = await mount(tester);
    expect(find.text('Term 1'), findsOneWidget);
    expect(find.text('Term 2'), findsOneWidget);
    expect(find.text('Term 3'), findsOneWidget);
    expect(find.text('Selected'), findsOneWidget);
    expect(find.text('Mar 1, 2027 – Jun 1, 2027'), findsOneWidget);
    await tester.ensureVisible(find.byKey(const ValueKey('term-t3')));
    await tester.tap(find.byKey(const ValueKey('term-t3')));
    await tester.pump();
    expect(store.calls, 0);
    expect(Hive.box(AppConfig.termScopeBox).get('termId'), isNull);
    await tester.ensureVisible(find.text('Continue to workspace'));
    await tester.tap(find.text('Continue to workspace'));
    await tester.pumpAndSettle();
    expect(store.calls, 1);
    expect(store.selected?.id, 't3');
    expect(store.selected?.schoolYearId, 'active');
    expect(find.text('Workspace gate'), findsOneWidget);
  });

  testWidgets('saved term is selected and school-year changes reset the pick', (
    tester,
  ) async {
    await tester.runAsync(
      () =>
          Hive.box(AppConfig.termScopeBox)
              .put('scope', fixture().first.terms.first.toJson()),
    );
    await mount(tester);
    final card = find.byKey(const ValueKey('term-t3'));
    expect(
      find.descendant(of: card, matching: find.text('Selected')),
      findsOneWidget,
    );
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('2025–2026').last);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('term-old-t1')), findsOneWidget);
    expect(find.byKey(const ValueKey('term-t3')), findsNothing);
    expect(find.text('Dates not set'), findsOneWidget);
  });

  testWidgets('loading keeps background and reduced motion is static', (
    tester,
  ) async {
    final pending = Completer<List<SchoolYear>>();
    await mount(tester, load: () => pending.future);
    expect(find.text('Loading school years…'), findsOneWidget);
    expect(find.byType(AuthSpinner), findsOneWidget);
    expect(find.byType(LoginBackground), findsOneWidget);
    expect(find.byKey(const ValueKey('auth-flow-center')), findsNothing);
    expect(tester.hasRunningAnimations, isFalse);
    pending.complete(fixture());
    await tester.pumpAndSettle();
    expect(find.text('Loading school years…'), findsNothing);
    expect(find.text('Term 1'), findsOneWidget);
  });

  testWidgets('network errors are friendly and retry reloads years', (
    tester,
  ) async {
    var calls = 0;
    await mount(
      tester,
      load: () {
        calls++;
        if (calls == 1) throw ApiException('NETWORK', 'private details');
        return fixture();
      },
    );
    await tester.pump();
    expect(find.textContaining('internet connection'), findsOneWidget);
    expect(find.textContaining('private details'), findsNothing);
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(find.text('Term 1'), findsOneWidget);
  });

  testWidgets('empty years and empty terms offer guidance without Continue', (
    tester,
  ) async {
    await mount(tester, years: []);
    expect(find.text('No school years yet'), findsOneWidget);
    expect(find.text('Continue to workspace'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    await mount(
      tester,
      years: [
        SchoolYear(id: 'empty', name: 'Empty year', isActive: true, terms: []),
      ],
    );
    expect(find.text('No terms in this school year'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Continue to workspace'),
          )
          .onPressed,
      isNull,
    );
  });

  testWidgets('saving blocks duplicate taps and can recover from failure', (
    tester,
  ) async {
    final store = TestTermNotifier()
      ..pending = Completer<void>()
      ..fail = true;
    await mount(tester, notifier: store);
    await tester.ensureVisible(find.text('Continue to workspace'));
    await tester.tap(find.text('Continue to workspace'));
    await tester.pump();
    expect(store.calls, 1);
    expect(find.text('Opening workspace…'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    store.pending!.complete();
    await tester.pumpAndSettle();
    expect(
      find.text('We couldn’t open this term. Please try again.'),
      findsOneWidget,
    );
    expect(find.textContaining('private storage'), findsNothing);
    store.fail = false;
    await tester.tap(find.text('Continue to workspace'));
    await tester.pumpAndSettle();
    expect(find.text('Workspace gate'), findsOneWidget);
    expect(store.calls, 2);
  });

  testWidgets('animated hand-off does not persist before fade finishes', (
    tester,
  ) async {
    final store = await mount(tester, reducedMotion: false);
    await tester.pump(const Duration(milliseconds: 600));
    await tester.ensureVisible(find.text('Continue to workspace'));
    await tester.tap(find.text('Continue to workspace'));
    await tester.pump(const Duration(milliseconds: 100));
    expect(store.calls, 0);
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump(const Duration(milliseconds: 350));
    expect(store.calls, 1);
    expect(find.text('Workspace gate'), findsOneWidget);
  });

  for (final width in [320.0, 700.0, 1200.0]) {
    testWidgets('term cards fit $width with larger text', (tester) async {
      await mount(tester, size: Size(width, 900), textScale: 1.5);
      await tester.ensureVisible(find.text('Continue to workspace'));
      await tester.pump();
      expect(find.text('Term 1'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('resizing preserves the selected term', (tester) async {
    await mount(tester);
    final card = find.byKey(const ValueKey('term-t3'));
    await tester.ensureVisible(card);
    await tester.tap(card);
    await tester.pump();
    tester.view.physicalSize = const Size(1200, 900);
    await tester.pump();
    expect(
      find.descendant(of: card, matching: find.text('Selected')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  for (final size in [
    const Size(320, 740),
    const Size(1200, 900),
    const Size(740, 320),
  ]) {
    testWidgets('workspace loaders are centered at $size', (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      for (final label in ['Preparing workspace…', 'Opening workspace…']) {
        await tester.pumpWidget(
          MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                disableAnimations: true,
                textScaler: TextScaler.linear(1.3),
              ),
              child: child!,
            ),
            home: AuthFlowScaffold(
              centerContent: true,
              child: AuthLoading(label: label),
            ),
          ),
        );
        await tester.pump();
        final available = tester.getRect(
          find.byKey(const ValueKey('auth-flow-center')),
        );
        final loader = tester.getCenter(find.byType(AuthLoading));
        expect(loader.dx, closeTo(size.width / 2, 1));
        expect(loader.dy, closeTo(available.center.dy, 1));
        expect(loader.dy, greaterThan(size.height * 0.35));
        expect(find.text(label), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    });
  }

  testWidgets('spinner rotates normally and is static with reduced motion', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: AuthLoading(label: 'Preparing workspace…')),
    );
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.hasRunningAnimations, isTrue);
    await tester.pumpWidget(
      const MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: true),
          child: AuthLoading(label: 'Preparing workspace…'),
        ),
      ),
    );
    await tester.pump();
    expect(tester.hasRunningAnimations, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'workspace preparation keeps auth styling and handles overview failure',
    (tester) async {
      final api = _GateApi();
      addTearDown(api.dio.close);
      final overview = Completer<Map<String, dynamic>>();
      var overviewCalls = 0;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(api),
            overviewProvider.overrideWith((ref) {
              overviewCalls++;
              return overviewCalls == 1
                  ? overview.future
                  : Future.value({'isAdviser': false});
            }),
          ],
          child: const MaterialApp(home: FirstTimeGate()),
        ),
      );
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 10));
      }
      expect(find.text('Preparing workspace…'), findsOneWidget);
      expect(find.byKey(const ValueKey('auth-flow-center')), findsOneWidget);
      expect(find.byType(LoginBackground), findsOneWidget);
      expect(find.byType(AuthSpinner), findsOneWidget);
      overview.completeError(ApiException('NETWORK', 'private details'));
      await tester.pump();
      await tester.pump();
      expect(find.textContaining('internet connection'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      api.linked = false;
      await tester.tap(find.text('Try again'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 10));
      }
      expect(overviewCalls, 2);
      expect(find.text('Link your classes'), findsWidgets);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('leaving workspace preparation during a request is safe', (
    tester,
  ) async {
    final api = _GateApi();
    addTearDown(api.dio.close);
    final overview = Completer<Map<String, dynamic>>();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          overviewProvider.overrideWith((ref) => overview.future),
        ],
        child: const MaterialApp(home: FirstTimeGate()),
      ),
    );
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 10));
    }
    await tester.pumpWidget(const SizedBox());
    overview.complete({'isAdviser': false});
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
