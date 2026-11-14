import 'dart:io';
import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:zentra_mobile/core/api_client.dart';
import 'package:zentra_mobile/core/session.dart';
import 'package:zentra_mobile/core/config.dart';
import 'package:zentra_mobile/design/status_palette.dart';
import 'package:zentra_mobile/design/theme.dart';
import 'package:zentra_mobile/design/theme_mode.dart';
import 'package:zentra_mobile/design/theme_picker.dart';
import 'package:zentra_mobile/design/tokens.dart';
import 'package:zentra_mobile/design/workspace_palette_gate.dart';
import 'package:zentra_mobile/features/auth/auth_flow_ui.dart';
import 'package:zentra_mobile/features/settings/settings_data.dart';
import 'package:zentra_mobile/features/settings/settings_page.dart';
import 'package:zentra_mobile/features/teacher/gradebook_page.dart';
import 'package:zentra_mobile/features/workspace/workspace_attendance_page.dart';
import 'package:zentra_mobile/shared/models.dart';
import 'package:zentra_mobile/shared/spinner.dart';
import 'package:zentra_mobile/shared/widgets.dart';

class TestPaletteSettings extends ThemeSettingsNotifier {
  @override
  Future<void> setMode(ThemeMode mode) async {
    state = ThemeSettings(
      mode: mode,
      primaryHex: state.primaryHex,
      secondaryHex: state.secondaryHex,
    );
  }

  @override
  Future<void> syncPalette(String? primary, String? secondary) async {
    state = ThemeSettings(
      mode: state.mode,
      primaryHex: primary,
      secondaryHex: secondary,
    );
  }
}

class TestProfileApi extends ApiClient {
  TestProfileApi() {
    dio.interceptors.clear();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          requests++;
          if (options.method == 'PATCH') {
            patches++;
            if (pendingPatch != null) await pendingPatch!.future;
            if (failPatch) {
              handler.reject(
                DioException(
                  requestOptions: options,
                  type: DioExceptionType.badResponse,
                  response: Response(
                    requestOptions: options,
                    statusCode: 503,
                    data: {
                      'error': {
                        'code': 'INTERNAL_ERROR',
                        'message': 'private details',
                      },
                    },
                  ),
                ),
              );
              return;
            }
            primary = (options.data as Map)['primaryColor'] as String?;
            secondary = (options.data as Map)['secondaryColor'] as String?;
          }
          final extra = switch (options.path) {
            '/api/teacher/schedule/my-slots' => {
              'slots': [
                {
                  'section': {'id': 'section', 'name': 'Arts'},
                  'subject': {'id': 'subject', 'name': 'Math'},
                },
              ],
            },
            '/api/attendance/section-roster' => {
              'students': [
                {
                  'studentId': 'student',
                  'name': 'A learner with a longer name',
                },
              ],
            },
            '/api/attendance/subjects' => {
              'subjects': [
                {'subjectId': 'subject', 'name': 'Math', 'canMark': true},
              ],
            },
            '/api/teacher/advisory/attendance' => {'marks': []},
            '/api/teacher/grading/classes/class' => {
              'students': [
                {
                  'id': 'student',
                  'name': 'A learner with a longer name',
                  'lrn': '123456789012',
                },
              ],
              'components': [
                {
                  'type': 'WRITTEN_WORK',
                  'label': 'WW',
                  'weight': 30,
                  'assessments': [
                    {
                      'id': 'quiz',
                      'title': 'Quiz 1',
                      'maxScore': 20,
                      'scores': {},
                    },
                  ],
                },
              ],
            },
            _ => <String, dynamic>{},
          };
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'fullName': 'Teacher',
                'primaryColor': primary,
                'secondaryColor': secondary,
                ...extra,
              },
            ),
          );
        },
      ),
    );
  }
  int requests = 0;
  int patches = 0;
  bool failPatch = false;
  Completer<void>? pendingPatch;
  String? primary = '#2563eb';
  String? secondary = '#fef3c7';
  @override
  Future<String?> accessToken() async => null;
}

class TestPaletteAuth extends AuthNotifier {
  TestPaletteAuth(super.api) {
    signIn();
  }
  void signIn() =>
      state = const AuthState(loggedIn: true, portal: 'staff', role: 'adviser');
  void signOut() => state = const AuthState();
}

class TestDesignTerm extends TermNotifier {
  TestDesignTerm() {
    state = Term(
      id: 'term',
      schoolYearId: 'year',
      schoolYearName: '2026–2027',
      termNumber: 2,
    );
  }
}

Color neutral(double lightness) {
  final linear = math.pow(lightness, 3).toDouble();
  final srgb = linear <= 0.0031308
      ? linear * 12.92
      : 1.055 * math.pow(linear, 1 / 2.4) - 0.055;
  final channel = (srgb * 255).round();
  return Color.fromARGB(255, channel, channel, channel);
}

Future<void> settleRequests(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 10));
  }
}

Future<void> mountDesignPage(
  WidgetTester tester,
  Widget page, {
  required bool dark,
  TestProfileApi? api,
  TestPaletteSettings? settings,
}) async {
  tester.view.physicalSize = const Size(320, 1000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final client = api ?? TestProfileApi();
  addTearDown(client.dio.close);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(client),
        authProvider.overrideWith((ref) => TestPaletteAuth(client)),
        termProvider.overrideWith((ref) => TestDesignTerm()),
        themeSettingsProvider.overrideWith(
          (ref) => settings ?? TestPaletteSettings(),
        ),
        overviewProvider.overrideWith(
          (ref) => {'isAdviser': false, 'classes': []},
        ),
        adviserSectionsProvider.overrideWith((ref) => []),
      ],
      child: Consumer(
        builder: (context, ref, _) {
          final palette = ref.watch(themeSettingsProvider);
          return MaterialApp(
            theme: dark
                ? zDarkTheme(
                    primaryOverride: hexToColor(palette.primaryHex),
                    secondaryOverride: hexToColor(palette.secondaryHex),
                  )
                : zLightTheme(
                    primaryOverride: hexToColor(palette.primaryHex),
                    secondaryOverride: hexToColor(palette.secondaryHex),
                  ),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                disableAnimations: true,
                textScaler: TextScaler.linear(1.5),
              ),
              child: child!,
            ),
            home: Scaffold(body: page),
          );
        },
      ),
    ),
  );
  await settleRequests(tester);
  await settleRequests(tester);
}

void main() {
  late Directory temp;
  setUpAll(() async {
    temp = await Directory.systemTemp.createTemp('zentra-design-tests-');
    Hive.init(temp.path);
    await openThemeSettingsBox();
    await Hive.openBox(AppConfig.termScopeBox);
  });
  setUp(() async => Hive.box('zentra.settings').clear());
  tearDownAll(() async {
    await Hive.close();
    await temp.delete(recursive: true);
  });

  test('workspace neutral tokens match the current web OKLCH source', () {
    final css = File('../frontend/src/app/globals.css').readAsStringSync();
    final light = css.split(':root {')[1].split('.dark {')[0];
    final dark = css.split('.dark {')[1];
    void compare(String block, String variable, Color actual) {
      final match = RegExp('--$variable: oklch\\(([0-9.]+) 0 0\\)')
          .firstMatch(block)!;
      expect(actual, neutral(double.parse(match[1]!)), reason: variable);
    }

    compare(light, 'background', ZLight.background);
    compare(light, 'foreground', ZLight.foreground);
    compare(light, 'primary', ZLight.primary);
    compare(light, 'muted', ZLight.muted);
    compare(light, 'muted-foreground', ZLight.mutedFg);
    compare(light, 'border', ZLight.border);
    compare(light, 'ring', ZLight.ring);
    compare(dark, 'background', ZDark.background);
    compare(dark, 'card', ZDark.card);
    compare(dark, 'primary', ZDark.primary);
    compare(dark, 'muted', ZDark.muted);
    compare(dark, 'muted-foreground', ZDark.mutedFg);
    expect(ZDark.border.a, closeTo(0.1, 1 / 255));
    expect(ZDark.input.a, closeTo(0.15, 1 / 255));
  });

  test(
    'all Material surfaces and typography use web colors, not seed purple',
    () {
      for (final theme in [zLightTheme(), zDarkTheme()]) {
        final dark = theme.brightness == Brightness.dark;
        expect(
          theme.scaffoldBackgroundColor,
          dark ? ZDark.background : ZLight.background,
        );
        expect(theme.cardTheme.color, dark ? ZDark.card : ZLight.card);
        expect(
          theme.colorScheme.surfaceContainerLow,
          dark ? ZDark.muted : ZLight.muted,
        );
        expect(theme.colorScheme.tertiary, theme.colorScheme.primary);
        expect(theme.colorScheme.surfaceTint, Colors.transparent);
        expect(theme.dialogTheme.backgroundColor, theme.cardTheme.color);
        expect(theme.bottomSheetTheme.backgroundColor, theme.cardTheme.color);
        expect(
          theme.drawerTheme.backgroundColor,
          dark ? ZDark.sidebar : ZLight.sidebar,
        );
        expect(theme.textTheme.bodyMedium!.fontFamily, 'Inter');
        expect(theme.materialTapTargetSize, MaterialTapTargetSize.padded);
        expect(
          theme.filledButtonTheme.style!.minimumSize!.resolve({})!.height,
          48,
        );
        expect(theme.inputDecorationTheme.constraints!.minHeight, 48);
      }
    },
  );

  test('saved palette foreground uses the exact web linear-luminance rule', () {
    expect(
      contrastForeground(const Color(0xFF16A34A)),
      const Color(0xFFFAFAFA),
    );
    expect(
      contrastForeground(const Color(0xFFFFD88A)),
      const Color(0xFF18181B),
    );
    final theme = zDarkTheme(
      primaryOverride: const Color(0xFF2563EB),
      secondaryOverride: const Color(0xFFFEF3C7),
    );
    expect(theme.colorScheme.primary, const Color(0xFF2563EB));
    expect(theme.colorScheme.onPrimary, const Color(0xFFFAFAFA));
    expect(theme.colorScheme.onSecondary, const Color(0xFF18181B));
    expect(
      theme.colorScheme.error,
      ZDark.primary,
    ); // Web destructive is not the custom accent.
    expect(hexToColor('invalid'), isNull);
  });

  test(
    'palette and mode persist and resetting colors preserves mode',
    () async {
      final settings = ThemeSettingsNotifier();
      await settings.setMode(ThemeMode.dark);
      await settings.syncPalette('#2563eb', '#fef3c7');
      final restored = ThemeSettingsNotifier();
      expect(restored.state.mode, ThemeMode.dark);
      expect(restored.state.primaryHex, '#2563eb');
      await restored.syncPalette(null, null);
      expect(restored.state.mode, ThemeMode.dark);
      expect(Hive.box('zentra.settings').get('primaryColor'), isNull);
      await restored.syncPalette('not a color', '#ffffff');
      expect(restored.state.primaryHex, isNull);
      settings.dispose();
      restored.dispose();
    },
  );

  test('semantic colors match light/dark web status families', () {
    final light = statusColors(StatusTone.red, zLightTheme(), badge: true);
    final dark = statusColors(StatusTone.red, zDarkTheme(), badge: true);
    expect(light.foreground, const Color(0xFFC10007));
    expect(dark.foreground, const Color(0xFFFF6467));
    expect(light.background.a, closeTo(0.15, 1 / 255));
    expect(dark.background.a, closeTo(0.20, 1 / 255));
    expect(statusTone('info_requested'), StatusTone.blue);
    expect(statusTone('APPROVED'), StatusTone.green);
    expect(statusTone('dismissed'), StatusTone.neutral);
    expect(riskTone('unknown'), StatusTone.neutral);
    expect(
      ZTokens.riskHigh,
      const Color(0xFFEF4444),
    ); // Explicit web dot, not Tailwind pill shade.
  });

  testWidgets('Inter fonts and license are packaged for offline rendering', (
    tester,
  ) async {
    for (final weight in ['Light', 'Regular', 'Medium', 'SemiBold', 'Bold']) {
      final bytes = await rootBundle.load('assets/fonts/Inter-$weight.ttf');
      expect(bytes.lengthInBytes, greaterThan(300000));
      expect(bytes.getUint32(0), 0x00010000);
    }
    expect(
      await rootBundle.loadString('assets/fonts/OFL.txt'),
      contains('SIL OPEN FONT LICENSE'),
    );
  });

  testWidgets(
    'workspace applies saved colors without opening Settings and refreshes on web changes',
    (tester) async {
      final api = TestProfileApi();
      final auth = TestPaletteAuth(api);
      final settings = TestPaletteSettings();
      addTearDown(api.dio.close);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(api),
            authProvider.overrideWith((ref) => auth),
            themeSettingsProvider.overrideWith((ref) => settings),
          ],
          child: const MaterialApp(
            home: WorkspacePaletteGate(
              child: Scaffold(body: Text('Workspace')),
            ),
          ),
        ),
      );
      await settleRequests(tester);
      expect(settings.state.primaryHex, '#2563eb');
      expect(settings.state.secondaryHex, '#fef3c7');
      expect(api.requests, 1);
      api.primary = '#16a34a';
      await tester.pump(const Duration(seconds: 31));
      await settleRequests(tester);
      expect(settings.state.primaryHex, '#16a34a');
      auth.signOut();
      await settleRequests(tester);
      expect(settings.state.primaryHex, isNull);
      final requests = api.requests;
      api.primary = '#ea580c';
      auth.signIn();
      await settleRequests(tester);
      expect(api.requests, requests + 1);
      expect(settings.state.primaryHex, '#ea580c');
      expect(tester.takeException(), isNull);
    },
  );

  for (final dark in [false, true]) {
    for (final custom in [false, true]) {
      for (final width in [320.0, 1200.0]) {
        testWidgets(
          'shared UI fits $width, dark=$dark, custom=$custom, larger text',
          (tester) async {
            tester.view.physicalSize = Size(width, 1000);
            tester.view.devicePixelRatio = 1;
            addTearDown(tester.view.resetPhysicalSize);
            addTearDown(tester.view.resetDevicePixelRatio);
            final primary = custom ? const Color(0xFF16A34A) : null;
            final secondary = custom ? const Color(0xFFFEF3C7) : null;
            final theme = dark
                ? zDarkTheme(
                    primaryOverride: primary,
                    secondaryOverride: secondary,
                  )
                : zLightTheme(
                    primaryOverride: primary,
                    secondaryOverride: secondary,
                  );
            await tester.pumpWidget(
              ProviderScope(
                overrides: [
                  themeSettingsProvider.overrideWith(
                    (ref) => TestPaletteSettings(),
                  ),
                ],
                child: MaterialApp(
                  theme: theme,
                  builder: (context, child) => MediaQuery(
                    data: MediaQuery.of(context).copyWith(
                      disableAnimations: true,
                      textScaler: TextScaler.linear(1.5),
                    ),
                    child: child!,
                  ),
                  home: Scaffold(
                    body: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Overview',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          ZCard(
                            onTap: () {},
                            child: const Text('Open classroom workspace'),
                          ),
                          const SizedBox(height: 12),
                          SegTabs<String>(
                            values: const [
                              'present',
                              'absent',
                              'late',
                              'excused',
                            ],
                            labels: const ['P', 'A', 'L', 'E'],
                            selected: 'present',
                            onChanged: (_) {},
                          ),
                          const SizedBox(height: 12),
                          const Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              RiskBadge(level: 'High'),
                              RiskBadge(level: 'Moderate'),
                              RiskBadge(level: 'Low'),
                              FlagChip(flag: 'academic'),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const TextField(
                            decoration: InputDecoration(
                              labelText: 'School email',
                            ),
                          ),
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: () {},
                            child: const Text('Save changes'),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () {},
                                  icon: const Icon(Icons.download, size: 16),
                                  label: const Text('Download .xlsx'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: FilledButton.icon(
                                  onPressed: () {},
                                  icon: const Icon(
                                    Icons.picture_as_pdf,
                                    size: 16,
                                  ),
                                  label: const Text('Download .PDF'),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const WorkspaceThemePicker(),
                          const SizedBox(height: 12),
                          const ZEmpty(
                            icon: Icons.class_outlined,
                            title: 'No classes this term',
                            subtitle: 'Ask the school office to confirm your timetable.',
                          ),
                          const SizedBox(height: 12),
                          const LoadingView(label: 'Loading records…'),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
            await tester.pumpAndSettle();
            expect(find.byType(ZSpinner), findsOneWidget);
            expect(tester.hasRunningAnimations, isFalse);
            expect(tester.takeException(), isNull);
            expect(
              tester
                  .getSize(find.widgetWithText(FilledButton, 'Save changes'))
                  .height,
              greaterThanOrEqualTo(48),
            );
            expect(
              tester.getSize(find.widgetWithText(TextButton, 'P')).height,
              greaterThanOrEqualTo(48),
            );
            expect(
              tester.getSize(find.byType(RiskBadge).first).height,
              greaterThan(20),
            );
            await tester.ensureVisible(find.text('Dark'));
            await tester.tap(find.text('Dark'));
            await tester.pump();
            expect(tester.takeException(), isNull);
          },
        );
      }
    }
  }

  for (final dark in [false, true]) {
    testWidgets('attendance touch controls fit a narrow phone, dark=$dark', (
      tester,
    ) async {
      await mountDesignPage(
        tester,
        const WorkspaceAttendancePage(),
        dark: dark,
      );
      expect(find.text('A learner with a longer name'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'P'), findsOneWidget);
      expect(
        tester.getSize(find.widgetWithText(TextButton, 'P')).height,
        greaterThanOrEqualTo(48),
      );
      await tester.tap(find.widgetWithText(TextButton, 'A'));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('grade entry fields fit the web-matched theme, dark=$dark', (
      tester,
    ) async {
      await mountDesignPage(
        tester,
        const GradebookPage(classId: 'class', title: 'Math'),
        dark: dark,
      );
      await tester.tap(find.text('Quiz 1'));
      await tester.pumpAndSettle();
      expect(find.byType(TextFormField), findsOneWidget);
      expect(
        tester.getSize(find.byType(TextFormField)).height,
        greaterThanOrEqualTo(48),
      );
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets(
    'palette edits disable conflicting saves and show friendly failures',
    (tester) async {
      final api = TestProfileApi()..pendingPatch = Completer<void>();
      final settings = TestPaletteSettings();
      await mountDesignPage(
        tester,
        const SettingsPage(),
        dark: true,
        api: api,
        settings: settings,
      );
       await tester.ensureVisible(find.byTooltip('#7c3aed'));
       await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('#7c3aed'));
      await tester.pump();
      await settleRequests(tester);
      expect(api.patches, 1);
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Saving palette…'),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(find.byTooltip('#16a34a'));
      expect(api.patches, 1);
      api.pendingPatch!.complete();
      await settleRequests(tester);
      expect(settings.state.primaryHex, '#7c3aed');
      api.pendingPatch = null;
      api.failPatch = true;
       await tester.ensureVisible(find.byTooltip('#16a34a'));
       await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('#16a34a'));
      await settleRequests(tester);
      expect(
        find.text(
          'Something went wrong on our side. Please try again shortly.',
        ),
        findsOneWidget,
      );
      expect(find.textContaining('private details'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'login hand-off keeps its own palette under custom workspace colors',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: zDarkTheme(primaryOverride: const Color(0xFFEA580C)),
          home: AuthFlowScaffold(
            centerContent: true,
            child: Builder(
              builder: (context) => Text(
                'Login palette: ${Theme.of(context).colorScheme.primary.toARGB32()}',
              ),
            ),
          ),
        ),
      );
      expect(
        find.text('Login palette: ${authMint.toARGB32()}'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
