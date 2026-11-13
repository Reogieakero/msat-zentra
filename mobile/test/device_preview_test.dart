import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zentra_mobile/dev_preview/device_presets.dart';
import 'package:zentra_mobile/dev_preview/device_preview_host.dart';

void main() {
  test('preview is enabled on Linux only', () {
    addTearDown(() => debugDefaultTargetPlatformOverride = null);
    for (final platform in TargetPlatform.values) {
      debugDefaultTargetPlatformOverride = platform;
      expect(devicePreviewEnabled, platform == TargetPlatform.linux);
    }
  });

  test('presets rotate dimensions and safe areas together', () {
    for (final device in devicePresets) {
      expect(
        device.viewport(landscape: true),
        Size(device.size.height, device.size.width),
      );
      expect(device.padding(landscape: true).left, device.safeArea.top);
      expect(device.padding(landscape: true).right, device.safeArea.bottom);
    }
  });

  Future<void> pumpPreview(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(1600, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => DevicePreviewHost(child: child!),
        home: const _Probe(),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('all devices set real constraints and MediaQuery', (
    tester,
  ) async {
    await pumpPreview(tester);
    for (final device in devicePresets) {
      await tester.tap(find.widgetWithText(ChoiceChip, device.label));
      await tester.pumpAndSettle();
      final context = tester.element(find.byType(_Probe));
      expect(MediaQuery.sizeOf(context), device.size);
      expect(MediaQuery.paddingOf(context), device.safeArea);
      expect(
        tester.getSize(find.byKey(const ValueKey('preview-viewport'))),
        device.size,
      );
      expect(tester.takeException(), isNull);
    }
    await tester.tap(find.text('Rotate device'));
    await tester.pumpAndSettle();
    expect(
      MediaQuery.sizeOf(tester.element(find.byType(_Probe))),
      const Size(1366, 1024),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('form and navigation state survive preview changes', (
    tester,
  ) async {
    await pumpPreview(tester);
    await tester.enterText(find.byType(TextField), 'Keep this text');
    await tester.tap(find.text('Open page'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, 'Standard tablet'));
    await tester.tap(find.text('Rotate device'));
    await tester.tap(find.text('Device frame'));
    await tester.tap(find.text('Fit to window'));
    await tester.pumpAndSettle();
    expect(find.text('Detail page'), findsOneWidget);
    final navigator = tester.state<NavigatorState>(
      find.byType(Navigator).first,
    );
    navigator.pop();
    await tester.pumpAndSettle();
    expect(find.text('Keep this text'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('dialogs stay within the simulated screen', (tester) async {
    await pumpPreview(tester);
    await tester.tap(find.text('Open dialog'));
    await tester.pumpAndSettle();
    final dialog = tester.getRect(find.byType(AlertDialog));
    final viewport = tester.getRect(
      find.byKey(const ValueKey('preview-viewport')),
    );
    expect(dialog.left, greaterThanOrEqualTo(viewport.left));
    expect(dialog.top, greaterThanOrEqualTo(viewport.top));
    expect(dialog.right, lessThanOrEqualTo(viewport.right));
    expect(dialog.bottom, lessThanOrEqualTo(viewport.bottom));
    await tester.tap(find.widgetWithText(ChoiceChip, 'Compact phone'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('small Linux window scales without changing device layout', (
    tester,
  ) async {
    await pumpPreview(tester);
    await tester.binding.setSurfaceSize(const Size(600, 650));
    await tester.tap(find.widgetWithText(ChoiceChip, 'Large tablet'));
    await tester.pumpAndSettle();
    expect(
      MediaQuery.sizeOf(tester.element(find.byType(_Probe))),
      const Size(1024, 1366),
    );
    final viewport = tester.getRect(
      find.byKey(const ValueKey('preview-viewport')),
    );
    expect(viewport.left, greaterThanOrEqualTo(0));
    expect(viewport.right, lessThanOrEqualTo(600));
    expect(viewport.bottom, lessThanOrEqualTo(650));
    expect(tester.takeException(), isNull);
  });
}

class _Probe extends StatelessWidget {
  const _Probe();

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Column(
        children: [
          const TextField(),
          TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const Scaffold(body: Text('Detail page')),
              ),
            ),
            child: const Text('Open page'),
          ),
          TextButton(
            onPressed: () => showDialog<void>(
              context: context,
              builder: (_) => const AlertDialog(title: Text('Preview dialog')),
            ),
            child: const Text('Open dialog'),
          ),
        ],
      ),
    ),
  );
}
