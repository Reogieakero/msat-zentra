import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../shared/widgets/sync_status_pill.dart';
import '../shared/dev_offline_drawer.dart';
import '../shared/widgets/custom_card.dart';
import 'widgets/attendance_heatmap.dart';
import 'widgets/quarterly_report_card.dart';

class ParentWorkspaceScreen extends ConsumerWidget {
  const ParentWorkspaceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Zentra Parent Portal',
              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              'Guardian Dashboard',
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
            // Child Selector Bar
            CustomCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: AppColors.primaryEmerald.withOpacity(0.2),
                    child: const Icon(Icons.child_care, color: AppColors.primaryEmerald),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Carlos Reyes',
                          style: GoogleFonts.inter(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                        Text(
                          'LRN: 109283746501 | Grade 10 - Emerald',
                          style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
            ),
            const SizedBox(height: 12),
            const AttendanceHeatmap(),
            const SizedBox(height: 12),
            const QuarterlyReportCard(),
          ],
        ),
      ),
    );
  }
}
