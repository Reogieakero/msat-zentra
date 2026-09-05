import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zentra_mobile/main.dart';
import 'package:zentra_mobile/presentation/teacher/widgets/faculty_adm_view.dart';
import 'package:zentra_mobile/presentation/teacher/adm_subject_detail_screen.dart';

void main() {
  testWidgets('Zentra mobile app loads login screen successfully', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: ZentraMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Zentra'), findsWidgets);
  });

  testWidgets('Faculty ADM View opens subject classroom detail screen on subject tap', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: FacultyAdmView(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Mathematics 10'), findsOneWidget);
    expect(find.text('+ Refer Student for ADM Intervention'), findsOneWidget);

    // Tap Mathematics 10 Subject Card
    await tester.tap(find.text('Mathematics 10'));
    await tester.pumpAndSettle();

    // Verify navigation to Google Classroom Subject Detail Screen
    expect(find.byType(FacultyAdmSubjectDetailScreen), findsOneWidget);
    expect(find.text('+ Upload Module'), findsWidgets);
    expect(find.text('Modules & Stream'), findsOneWidget);
    expect(find.text('ADM Students'), findsOneWidget);
  });
}
