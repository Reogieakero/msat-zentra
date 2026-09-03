import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../shared/widgets/sync_status_pill.dart';
import '../shared/dev_offline_drawer.dart';
import '../shared/widgets/custom_card.dart';

class StudentWorkspaceScreen extends ConsumerWidget {
  const StudentWorkspaceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Zentra Student Portal',
              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              'Carlos Reyes | G10 - Emerald',
              style: GoogleFonts.robotoMono(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          const Center(child: SyncStatusPill()),
          const SizedBox(width: 4),
          IconButton(
            icon: const Icon(Icons.logout, size: 20, color: AppColors.textMuted),
            tooltip: 'Sign Out',
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
          Builder(
            builder: (context) => IconButton(
              icon: const Icon(Icons.tune, color: AppColors.primaryEmerald),
              onPressed: () => Scaffold.of(context).openEndDrawer(),
            ),
          ),
        ],
      ),
      endDrawer: const DevOfflineDrawer(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Student Academic Summary Card
            CustomCard(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.primaryEmerald.withOpacity(0.2),
                    child: Text(
                      'CR',
                      style: GoogleFonts.inter(
                        color: AppColors.primaryEmerald,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Carlos Reyes',
                          style: GoogleFonts.inter(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'LRN: 109283746501',
                          style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '85.4 GPA',
                        style: GoogleFonts.robotoMono(
                          color: AppColors.primaryEmerald,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.riskModerate.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppColors.riskModerate.withOpacity(0.4)),
                        ),
                        child: Text(
                          'MODERATE RISK',
                          style: GoogleFonts.robotoMono(
                            color: AppColors.riskModerate,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // ADM Modules Progress Card
            CustomCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Assigned ADM Learning Modules',
                        style: GoogleFonts.inter(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        '2 Pending',
                        style: GoogleFonts.robotoMono(
                          color: AppColors.riskModerate,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _moduleItem('Math Module 3: Polynomial Functions', 'Due: Sept 10', false),
                  const SizedBox(height: 8),
                  _moduleItem('Science Module 2: Plate Tectonics', 'Due: Sept 14', false),
                  const SizedBox(height: 8),
                  _moduleItem('English Module 1: Persuasive Writing', 'Submitted', true),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Subject Grade Cards Overview
            Text(
              'Current Term Subjects',
              style: GoogleFonts.inter(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            _subjectCard('Mathematics 10', 'Maria Santos', 85, 'Passed'),
            const SizedBox(height: 8),
            _subjectCard('Science 10', 'Jose Rizal', 88, 'Passed'),
            const SizedBox(height: 8),
            _subjectCard('English 10', 'Clara Bonifacio', 90, 'Passed'),
          ],
        ),
      ),
    );
  }

  Widget _moduleItem(String title, String statusText, bool isDone) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Row(
        children: [
          Icon(
            isDone ? Icons.check_circle : Icons.pending_actions,
            color: isDone ? AppColors.primaryEmerald : AppColors.riskModerate,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13),
            ),
          ),
          Text(
            statusText,
            style: GoogleFonts.robotoMono(
              color: isDone ? AppColors.primaryEmerald : AppColors.riskModerate,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _subjectCard(String subject, String teacher, int grade, String remarks) {
    return CustomCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                subject,
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 2),
              Text(
                'Teacher: $teacher',
                style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            child: Text(
              '$grade',
              style: GoogleFonts.robotoMono(
                color: grade >= 75 ? AppColors.primaryEmerald : AppColors.riskHigh,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
