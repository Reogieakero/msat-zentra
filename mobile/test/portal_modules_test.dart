import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zentra_mobile/features/portal/portal_views.dart';
import 'package:zentra_mobile/features/student/module_submission.dart';
import 'package:zentra_mobile/shared/models.dart';

PortalModules fixture() => PortalModules.fromJson({
  'counts': {'all': 16, 'pending': 16},
  'page': 1, 'totalPages': 2,
  'data': [{
    'id': 'module', 'kind': 'adm',
    'moduleName': 'A long module title that should wrap on a narrow phone',
    'moduleUrl': 'https://example.com/module',
    'status': 'pending',
  }],
});

void main() {
  testWidgets('parent module view is read-only and fits a narrow phone', (tester) async {
    await tester.view.setPhysicalSize(const Size(320, 800));
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(ProviderScope(child: MaterialApp(home: Scaffold(
      body: PortalModulesBody(data: fixture()),
    ))));
    expect(find.text('Open module'), findsOneWidget);
    expect(find.text('Submit answer'), findsNothing);
    expect(find.text('1 / 2'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('student can open submission and must enter a valid answer link', (tester) async {
    await tester.pumpWidget(ProviderScope(child: MaterialApp(home: Scaffold(
      body: PortalModulesBody(data: fixture(), canSubmit: true),
    ))));
    await tester.tap(find.text('Submit answer'));
    await tester.pumpAndSettle();
    expect(find.byType(ModuleSubmissionSheet), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'invalid link');
    await tester.tap(find.widgetWithText(FilledButton, 'Submit answer'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a valid http or https link.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
