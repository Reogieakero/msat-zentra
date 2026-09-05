import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../../data/mock/mock_data.dart';
import '../../../data/models/teacher_class_model.dart';
import '../../shared/widgets/custom_card.dart';

class ClassSelectorView extends StatefulWidget {
  final ValueChanged<TeacherClassModel> onSelectClass;

  const ClassSelectorView({
    super.key,
    required this.onSelectClass,
  });

  @override
  State<ClassSelectorView> createState() => _ClassSelectorViewState();
}

class _ClassSelectorViewState extends State<ClassSelectorView> {
  String _filter = 'today'; // 'today' | 'all' | 'advisory'

  List<TeacherClassModel> get _filteredClasses {
    final list = MockData.teacherClasses;
    if (_filter == 'advisory') {
      return list.where((c) => c.isAdviser).toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final classes = _filteredClasses;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Filter Chips Header
          Row(
            children: [
              Text(
                'Select Class',
                style: GoogleFonts.inter(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Spacer(),
              _filterChip('today', 'Today\'s Schedule'),
              const SizedBox(width: 6),
              _filterChip('all', 'All Sections'),
              const SizedBox(width: 6),
              _filterChip('advisory', 'Advisory'),
            ],
          ),
          const SizedBox(height: 12),

          // Assigned Class Cards List
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: classes.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final item = classes[index];

              return CustomCard(
                onTap: () => widget.onSelectClass(item),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Bar: Schedule Time & Room
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.primaryEmerald.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: AppColors.primaryEmerald.withOpacity(0.4)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.schedule, size: 12, color: AppColors.primaryEmerald),
                              const SizedBox(width: 4),
                              Text(
                                item.scheduleTime,
                                style: GoogleFonts.robotoMono(
                                  color: AppColors.primaryEmerald,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          item.room,
                          style: GoogleFonts.robotoMono(
                            color: AppColors.textMuted,
                            fontSize: 11,
                          ),
                        ),
                        const Spacer(),
                        if (item.isAdviser)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceElevated,
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: AppColors.borderSubtle),
                            ),
                            child: Text(
                              'Adviser',
                              style: GoogleFonts.robotoMono(
                                color: AppColors.textSecondary,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Middle Row: Subject & Section Name
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.subjectName,
                                style: GoogleFonts.inter(
                                  color: AppColors.textPrimary,
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${item.sectionName} • ${item.studentCount} Enrolled Students',
                                style: GoogleFonts.inter(
                                  color: AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right,
                          color: AppColors.primaryEmerald,
                          size: 22,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Bottom Row: Status Badges
                    Row(
                      children: [
                        // Attendance Status
                        _statusPill(
                          label: item.isAttendanceMarkedToday ? 'Attendance Marked' : 'Attendance Pending',
                          color: item.isAttendanceMarkedToday ? AppColors.attendancePresent : AppColors.riskModerate,
                        ),
                        const SizedBox(width: 6),
                        // Grade Lock Status
                        _statusPill(
                          label: item.isGradesLocked ? 'Q1 Locked' : 'Q1 Editable',
                          color: item.isGradesLocked ? AppColors.lockLocked : AppColors.lockUnlocked,
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String category, String label) {
    final isSelected = _filter == category;

    return GestureDetector(
      onTap: () => setState(() => _filter = category),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryEmerald : AppColors.surfaceElevated,
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

  Widget _statusPill({required String label, required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: GoogleFonts.robotoMono(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
