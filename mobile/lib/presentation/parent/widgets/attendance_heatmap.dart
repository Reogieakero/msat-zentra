import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../shared/widgets/custom_card.dart';

class AttendanceHeatmap extends StatelessWidget {
  const AttendanceHeatmap({super.key});

  @override
  Widget build(BuildContext context) {
    // Generate mock calendar days for current month
    final now = DateTime.now();
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;

    return CustomCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Attendance Heatmap (Current Term)',
                style: GoogleFonts.inter(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primaryEmerald.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '94% Attendance Rate',
                  style: GoogleFonts.robotoMono(
                    color: AppColors.primaryEmerald,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Legend
          Row(
            children: [
              _legendItem('Present', AppColors.attendancePresent),
              const SizedBox(width: 12),
              _legendItem('Absent', AppColors.attendanceAbsent),
              const SizedBox(width: 12),
              _legendItem('Late', AppColors.attendanceLate),
            ],
          ),
          const SizedBox(height: 12),
          // Calendar Grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: daysInMonth,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
            ),
            itemBuilder: (context, index) {
              final dayNum = index + 1;

              // Mock status allocation
              Color color = AppColors.attendancePresent;
              if (dayNum == 4 || dayNum == 18) color = AppColors.attendanceAbsent;
              if (dayNum == 12 || dayNum == 22) color = AppColors.attendanceLate;
              if (dayNum % 7 == 0 || dayNum % 7 == 6) color = AppColors.surfaceElevated; // Weekends

              return Container(
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withOpacity(color == AppColors.surfaceElevated ? 0.3 : 0.2),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(
                    color: color.withOpacity(color == AppColors.surfaceElevated ? 0.3 : 0.6),
                  ),
                ),
                child: Text(
                  '$dayNum',
                  style: GoogleFonts.robotoMono(
                    color: color == AppColors.surfaceElevated ? AppColors.textMuted : color,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _legendItem(String label, Color color) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 11),
        ),
      ],
    );
  }
}
