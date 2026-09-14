import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zentra_mobile/main.dart';
import 'package:zentra_mobile/presentation/teacher/widgets/faculty_adm_view.dart';
import 'package:zentra_mobile/presentation/teacher/adm_subject_detail_screen.dart';
import 'package:zentra_mobile/presentation/shared/widgets/floating_oblong_nav_bar.dart';

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

  testWidgets('Faculty ADM View opens subject classroom detail screen with Classwork tab on subject tap', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: FacultyAdmView(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Mathematics 10'), findsOneWidget);
    expect(find.byTooltip('Refer Student'), findsOneWidget);

    // Tap Mathematics 10 Subject Card
    await tester.tap(find.text('Mathematics 10'));
    await tester.pumpAndSettle();

    // Verify navigation to Google Classroom Subject Detail Screen with 3 tabs and FAB
    expect(find.byType(FacultyAdmSubjectDetailScreen), findsOneWidget);
    expect(find.text('Upload Module'), findsOneWidget);
    expect(find.text('Modules'), findsOneWidget);
    expect(find.text('Classwork'), findsOneWidget);
    expect(find.text('ADM Students'), findsOneWidget);

    // Switch to Classwork tab
    await tester.tap(find.text('Classwork'));
    await tester.pumpAndSettle();

    // Verify Classwork content & Floating Action Button
    expect(find.text('Classwork & Activities'), findsOneWidget);
    expect(find.text('Create Classwork'), findsOneWidget);
    expect(find.text('Intervention & Remediation'), findsOneWidget);
  });

  testWidgets('FloatingOblongNavBar renders items and triggers onTap callback on item tap', (WidgetTester tester) async {
    int selectedTab = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: StatefulBuilder(
          builder: (context, setState) {
            return Scaffold(
              extendBody: true,
              bottomNavigationBar: FloatingOblongNavBar(
                currentIndex: selectedTab,
                onTap: (index) {
                  setState(() {
                    selectedTab = index;
                  });
                },
                items: const [
                  FloatingNavItem(
                    icon: Icons.home_outlined,
                    activeIcon: Icons.home_rounded,
                    label: 'Home',
                  ),
                  FloatingNavItem(
                    icon: Icons.calendar_month_outlined,
                    activeIcon: Icons.calendar_month_rounded,
                    label: 'Attendance',
                  ),
                  FloatingNavItem(
                    icon: Icons.star_outline,
                    activeIcon: Icons.star_rounded,
                    label: 'Grades',
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Attendance'), findsOneWidget);
    expect(find.text('Grades'), findsOneWidget);

    // Tap Attendance item
    await tester.tap(find.text('Attendance'));
    await tester.pumpAndSettle();

    expect(selectedTab, 1);
  });
}
