import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../shared/widgets/custom_card.dart';

class QuarterlyReportCard extends StatelessWidget {
  const QuarterlyReportCard({super.key});

  @override
  Widget build(BuildContext context) {
    final subjects = [
      {'code': 'MATH10', 'name': 'Mathematics 10', 'grade': 85, 'remarks': 'Passed'},
      {'code': 'SCI10', 'name': 'Science 10', 'grade': 88, 'remarks': 'Passed'},
      {'code': 'ENG10', 'name': 'English 10', 'grade': 90, 'remarks': 'Passed'},
      {'code': 'FIL10', 'name': 'Filipino 10', 'grade': 87, 'remarks': 'Passed'},
      {'code': 'AP10', 'name': 'Araling Panlipunan', 'grade': 84, 'remarks': 'Passed'},
      {'code': 'MAPEH10', 'name': 'MAPEH 10', 'grade': 92, 'remarks': 'Passed'},
    ];

    return CustomCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Quarter 1 Final Report Card',
                style: GoogleFonts.inter(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primaryEmerald.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: AppColors.primaryEmerald.withOpacity(0.4)),
                ),
                child: Text(
                  'GPA: 87.7',
                  style: GoogleFonts.robotoMono(
                    color: AppColors.primaryEmerald,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: subjects.length,
            separatorBuilder: (_, __) => const Divider(height: 12),
            itemBuilder: (context, index) {
              final sub = subjects[index];
              final grade = sub['grade'] as int;

              return Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          sub['name'] as String,
                          style: GoogleFonts.inter(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        Text(
                          sub['code'] as String,
                          style: GoogleFonts.robotoMono(
                            color: AppColors.textMuted,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
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
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
