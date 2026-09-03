import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../data/models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../teacher/teacher_workspace_screen.dart';
import '../adm_coordinator/adm_workspace_screen.dart';
import '../parent/parent_workspace_screen.dart';
import '../student/student_workspace_screen.dart';

class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(authProvider);
    final authNotifier = ref.read(authProvider.notifier);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Top Quick Role Switcher Bar for Instant UI Demo
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: AppColors.surfaceElevated,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.flash_on, color: AppColors.primaryEmerald, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        'DEMO MODE — Active Role Switcher:',
                        style: GoogleFonts.robotoMono(
                          color: AppColors.primaryEmerald,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _roleChip(ref, userAsync, UserRole.adviser, 'Teacher / Adviser', authNotifier),
                        const SizedBox(width: 6),
                        _roleChip(ref, userAsync, UserRole.adm_coordinator, 'ADM Coordinator', authNotifier),
                        const SizedBox(width: 6),
                        _roleChip(ref, userAsync, UserRole.parent, 'Parent Portal', authNotifier),
                        const SizedBox(width: 6),
                        _roleChip(ref, userAsync, UserRole.student, 'Student Portal', authNotifier),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Active Workspace Content
            Expanded(
              child: userAsync.when(
                loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primaryEmerald)),
                error: (err, stack) => Center(child: Text('Error loading workspace: $err')),
                data: (user) {
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
            ),
          ],
        ),
      ),
    );
  }

  Widget _roleChip(
    WidgetRef ref,
    AsyncValue<UserModel> userAsync,
    UserRole role,
    String label,
    AuthNotifier authNotifier,
  ) {
    final currentRole = userAsync.value?.role;
    final isSelected = currentRole == role;

    return GestureDetector(
      onTap: () => authNotifier.switchRole(role),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryEmerald : AppColors.surfaceDark,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: isSelected ? AppColors.primaryEmerald : AppColors.borderSubtle,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            color: isSelected ? const Color(0xFF0C1612) : AppColors.textSecondary,
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
