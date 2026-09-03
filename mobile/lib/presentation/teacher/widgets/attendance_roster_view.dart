import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../../data/models/attendance_model.dart';
import '../../../providers/attendance_provider.dart';
import '../../shared/widgets/custom_card.dart';
import '../../shared/widgets/status_badge.dart';

class AttendanceRosterView extends ConsumerWidget {
  const AttendanceRosterView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendanceAsync = ref.watch(attendanceProvider);
    final attendanceNotifier = ref.read(attendanceProvider.notifier);

    return Column(
      children: [
        // Controls bar: AM/PM Session toggle + Mark All Present
        CustomCard(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              // AM / PM Toggle
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Row(
                  children: Session.values.map((session) {
                    final isSelected = attendanceNotifier.selectedSession == session;
                    return GestureDetector(
                      onTap: () {
                        attendanceNotifier.loadAttendance(
                          'sec_g10_emerald',
                          attendanceNotifier.selectedDate,
                          session,
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primaryEmerald : Colors.transparent,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          session.name,
                          style: GoogleFonts.robotoMono(
                            color: isSelected ? const Color(0xFF0C1612) : AppColors.textSecondary,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: () {
                  attendanceNotifier.markAllPresent('sec_g10_emerald');
                },
                icon: const Icon(Icons.done_all, size: 16),
                label: const Text('Mark All Present'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  textStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Attendance List
        Expanded(
          child: attendanceAsync.when(
            loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primaryEmerald)),
            error: (err, stack) => Center(child: Text('Error loading attendance: $err')),
            data: (records) {
              return ListView.separated(
                itemCount: records.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final record = records[index];
                  return CustomCard(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: AppColors.surfaceElevated,
                          child: Text(
                            record.studentName.substring(0, 1),
                            style: GoogleFonts.inter(
                              color: AppColors.primaryEmerald,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                record.studentName,
                                style: GoogleFonts.inter(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 2),
                              StatusBadge.attendance(record.status),
                            ],
                          ),
                        ),
                        // Quick status picker buttons
                        Row(
                          children: [
                            _statusChip(context, record, AttendanceStatus.present, 'P', AppColors.attendancePresent, attendanceNotifier),
                            const SizedBox(width: 4),
                            _statusChip(context, record, AttendanceStatus.absent, 'A', AppColors.attendanceAbsent, attendanceNotifier),
                            const SizedBox(width: 4),
                            _statusChip(context, record, AttendanceStatus.late, 'L', AppColors.attendanceLate, attendanceNotifier),
                            const SizedBox(width: 4),
                            _statusChip(context, record, AttendanceStatus.excused, 'E', AppColors.attendanceExcused, attendanceNotifier),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _statusChip(
    BuildContext context,
    AttendanceRecordModel record,
    AttendanceStatus status,
    String label,
    Color color,
    AttendanceNotifier notifier,
  ) {
    final isSelected = record.status == status;
    return GestureDetector(
      onTap: () => notifier.updateStatus(record.id, status),
      child: Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isSelected ? color : AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: isSelected ? color : AppColors.borderSubtle,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.robotoMono(
            color: isSelected ? Colors.black : color,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}
