import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zentra_mobile/main.dart';

void main() {
  testWidgets('Zentra mobile app loads login screen successfully', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: ZentraMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Zentra Mobile'), findsOneWidget);
  });
}
