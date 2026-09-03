import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'app/theme/app_theme.dart';
import 'data/models/user_model.dart';
import 'providers/auth_provider.dart';
import 'presentation/auth/login_screen.dart';
import 'presentation/teacher/teacher_workspace_screen.dart';
import 'presentation/adm_coordinator/adm_workspace_screen.dart';
import 'presentation/parent/parent_workspace_screen.dart';
import 'presentation/student/student_workspace_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    // Graceful fallback if .env file is missing or unreadable
  }
  runApp(
    const ProviderScope(
      child: ZentraMobileApp(),
    ),
  );
}

class ZentraMobileApp extends ConsumerWidget {
  const ZentraMobileApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    return MaterialApp(
      title: 'Zentra Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: authState.when(
        loading: () => const Scaffold(
          body: Center(
            child: CircularProgressIndicator(color: Color(0xFF3ECF8E)),
          ),
        ),
        error: (err, _) => const LoginScreen(),
        data: (user) {
          if (user == null) {
            return const LoginScreen();
          }

          // Role-based navigation matching backend & web version
          switch (user.role) {
            case UserRole.adviser:
            case UserRole.subject_teacher:
              return const TeacherWorkspaceScreen();
            case UserRole.adm_coordinator:
              return const AdmWorkspaceScreen();
            case UserRole.parent:
              return const ParentWorkspaceScreen();
            case UserRole.student:
              return const StudentWorkspaceScreen();
            default:
              return const TeacherWorkspaceScreen();
          }
        },
      ),
    );
  }
}
