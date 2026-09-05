import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../../data/models/attendance_model.dart';
import '../../../providers/attendance_provider.dart';
import '../../shared/widgets/custom_card.dart';
import '../../shared/widgets/status_badge.dart';

class AttendanceRosterView extends ConsumerStatefulWidget {
  const AttendanceRosterView({super.key});

  @override
  ConsumerState<AttendanceRosterView> createState() => _AttendanceRosterViewState();
}

class _AttendanceRosterViewState extends ConsumerState<AttendanceRosterView> {
  DateTime _selectedDate = DateTime.now(); // Defaults to Today's date
  Session _selectedSession = Session.AM;

  // Set of day numbers in September 2026 where attendance was completed
  final Set<int> _completedDays = {1, 2, 3, 4, 5};

  @override
  Widget build(BuildContext context) {
    final attendanceNotifier = ref.read(attendanceProvider.notifier);

    final now = DateTime.now();
    final todayDay = now.day; // 5

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Top Create Attendance & Date Selector Bar
          CustomCard(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Selected Date Context',
                          style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            const Icon(Icons.calendar_today, size: 14, color: AppColors.primaryEmerald),
                            const SizedBox(width: 6),
                            Text(
                              '${_selectedDate.month}/${_selectedDate.day}/${_selectedDate.year}${_selectedDate.day == todayDay ? " (Today)" : ""}',
                              style: GoogleFonts.robotoMono(
                                color: AppColors.primaryEmerald,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.date_range, color: AppColors.textPrimary),
                      tooltip: 'Change Date',
                      onPressed: () => _pickDate(context),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Prominent Create Attendance Button (Default to Today)
                SizedBox(
                  width: double.infinity,
                  height: 42,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      _openRosterMarkingSheet(context, _selectedDate, attendanceNotifier);
                    },
                    icon: const Icon(Icons.add_task, size: 18),
                    label: Text(
                      'Create / Mark Attendance (${_selectedDate.month}/${_selectedDate.day})',
                      style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 2. Color-Coded Calendar Heatmap (Date-First View matching Parents)
          CustomCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'September 2026 Attendance Map',
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
                        '${_completedDays.length}/22 School Days Done',
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

                // Color Coding Legend
                Wrap(
                  spacing: 10,
                  runSpacing: 6,
                  children: [
                    _legendPill('Completed', AppColors.attendancePresent),
                    _legendPill('Unrecorded (Past)', AppColors.attendanceAbsent),
                    _legendPill('Pending (Future)', AppColors.riskModerate),
                    _legendPill('Today', AppColors.primaryEmerald, isToday: true),
                    _legendPill('Weekend', AppColors.surfaceElevated),
                  ],
                ),
                const SizedBox(height: 14),

                // Days of week header
                Row(
                  children: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) {
                    return Expanded(
                      child: Center(
                        child: Text(
                          day,
                          style: GoogleFonts.robotoMono(
                            color: AppColors.textMuted,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 8),

                // Calendar Grid (30 Days of September 2026)
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: 30,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    crossAxisSpacing: 6,
                    mainAxisSpacing: 6,
                  ),
                  itemBuilder: (context, index) {
                    final dayNum = index + 1;
                    final isWeekend = (dayNum % 7 == 6) || (dayNum % 7 == 0);
                    final isDone = _completedDays.contains(dayNum);
                    final isToday = (dayNum == todayDay);
                    final isPastDay = dayNum < todayDay;

                    Color bgTileColor;
                    Color borderTileColor;
                    Color textTileColor;

                    if (isToday) {
                      bgTileColor = AppColors.primaryEmerald.withOpacity(0.25);
                      borderTileColor = AppColors.primaryEmerald;
                      textTileColor = AppColors.primaryEmerald;
                    } else if (isWeekend) {
                      bgTileColor = AppColors.surfaceDark;
                      borderTileColor = AppColors.borderSubtle;
                      textTileColor = AppColors.textMuted;
                    } else if (isDone) {
                      bgTileColor = AppColors.attendancePresent.withOpacity(0.2);
                      borderTileColor = AppColors.attendancePresent.withOpacity(0.6);
                      textTileColor = AppColors.attendancePresent;
                    } else if (isPastDay) {
                      // Unrecorded Past School Day -> Red alert (#EF4444)
                      bgTileColor = AppColors.attendanceAbsent.withOpacity(0.18);
                      borderTileColor = AppColors.attendanceAbsent.withOpacity(0.6);
                      textTileColor = AppColors.attendanceAbsent;
                    } else {
                      // Upcoming / Future Pending School Day -> Amber / Yellow (#F59E0B)
                      bgTileColor = AppColors.riskModerate.withOpacity(0.15);
                      borderTileColor = AppColors.riskModerate.withOpacity(0.4);
                      textTileColor = AppColors.riskModerate;
                    }

                    return GestureDetector(
                      onTap: () {
                        final targetDate = DateTime(2026, 9, dayNum);
                        setState(() {
                          _selectedDate = targetDate;
                        });
                        _openRosterMarkingSheet(context, targetDate, attendanceNotifier);
                      },
                      child: Container(
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: bgTileColor,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: borderTileColor,
                            width: isToday ? 2.0 : 1.0,
                          ),
                        ),
                        child: Text(
                          '$dayNum',
                          style: GoogleFonts.robotoMono(
                            color: textTileColor,
                            fontSize: 12,
                            fontWeight: isToday || isDone ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 3. Chronological Attendance Log History
          Text(
            'Recent Daily Attendance Status',
            style: GoogleFonts.inter(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),

          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 5,
            itemBuilder: (context, index) {
              final dayNum = 5 - index;
              final logDate = DateTime(2026, 9, dayNum);
              final isDone = _completedDays.contains(dayNum);

              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: CustomCard(
                  onTap: () {
                    setState(() => _selectedDate = logDate);
                    _openRosterMarkingSheet(context, logDate, attendanceNotifier);
                  },
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      Text(
                        'Sept $dayNum, 2026',
                        style: GoogleFonts.robotoMono(
                          color: AppColors.textPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: (isDone ? AppColors.attendancePresent : AppColors.attendanceAbsent).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: (isDone ? AppColors.attendancePresent : AppColors.attendanceAbsent).withOpacity(0.4),
                          ),
                        ),
                        child: Text(
                          isDone ? 'COMPLETED' : 'NOT DONE',
                          style: GoogleFonts.robotoMono(
                            color: isDone ? AppColors.attendancePresent : AppColors.attendanceAbsent,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right, size: 18, color: AppColors.textMuted),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _legendPill(String label, Color color, {bool isToday = false}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color.withOpacity(0.3),
            borderRadius: BorderRadius.circular(3),
            border: Border.all(color: color, width: isToday ? 2 : 1),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 11),
        ),
      ],
    );
  }

  Future<void> _pickDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2026, 1, 1),
      lastDate: DateTime(2026, 12, 31),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppColors.primaryEmerald,
              surface: AppColors.surfaceDark,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Attendance Roster Marking Sheet / Modal
  // ---------------------------------------------------------------------------
  void _openRosterMarkingSheet(
    BuildContext context,
    DateTime date,
    AttendanceNotifier notifier,
  ) {
    notifier.loadAttendance('sec_g10_emerald', date, _selectedSession);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Consumer(
              builder: (context, ref, _) {
                final attendanceAsync = ref.watch(attendanceProvider);

                return Container(
                  height: MediaQuery.of(context).size.height * 0.85,
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Sheet Header Bar
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Mark Attendance',
                                style: GoogleFonts.inter(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                              Text(
                                'G10 - Emerald | ${date.month}/${date.day}/${date.year}',
                                style: GoogleFonts.robotoMono(
                                  color: AppColors.primaryEmerald,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, color: AppColors.textMuted),
                            onPressed: () => Navigator.pop(context),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Session Selector (AM / PM) & Mark All Present
                      CustomCard(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        child: Row(
                          children: [
                            Container(
                              decoration: BoxDecoration(
                                color: AppColors.surfaceElevated,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: AppColors.borderSubtle),
                              ),
                              child: Row(
                                children: Session.values.map((session) {
                                  final isSelected = _selectedSession == session;
                                  return GestureDetector(
                                    onTap: () {
                                      setSheetState(() => _selectedSession = session);
                                      notifier.loadAttendance('sec_g10_emerald', date, session);
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: isSelected ? AppColors.primaryEmerald : Colors.transparent,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        session.name,
                                        style: GoogleFonts.robotoMono(
                                          color: isSelected ? const Color(0xFF0C1612) : AppColors.textSecondary,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 11,
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
                                notifier.markAllPresent('sec_g10_emerald');
                              },
                              icon: const Icon(Icons.done_all, size: 14),
                              label: const Text('Mark All Present'),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                textStyle: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Roster Student Cards List
                      Expanded(
                        child: attendanceAsync.when(
                          loading: () => const Center(
                            child: CircularProgressIndicator(color: AppColors.primaryEmerald),
                          ),
                          error: (err, _) => Center(child: Text('Error loading roster: $err')),
                          data: (records) {
                            return ListView.separated(
                              itemCount: records.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 6),
                              itemBuilder: (context, index) {
                                final record = records[index];
                                return CustomCard(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  child: Row(
                                    children: [
                                      CircleAvatar(
                                        radius: 16,
                                        backgroundColor: AppColors.surfaceElevated,
                                        child: Text(
                                          record.studentName.substring(0, 1),
                                          style: GoogleFonts.inter(
                                            color: AppColors.primaryEmerald,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              record.studentName,
                                              style: GoogleFonts.inter(
                                                color: AppColors.textPrimary,
                                                fontWeight: FontWeight.w600,
                                                fontSize: 13,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            StatusBadge.attendance(record.status),
                                          ],
                                        ),
                                      ),
                                      Row(
                                        children: [
                                          _statusChip(record, AttendanceStatus.present, 'P', AppColors.attendancePresent, notifier),
                                          const SizedBox(width: 4),
                                          _statusChip(record, AttendanceStatus.absent, 'A', AppColors.attendanceAbsent, notifier),
                                          const SizedBox(width: 4),
                                          _statusChip(record, AttendanceStatus.late, 'L', AppColors.attendanceLate, notifier),
                                          const SizedBox(width: 4),
                                          _statusChip(record, AttendanceStatus.excused, 'E', AppColors.attendanceExcused, notifier),
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
                      const SizedBox(height: 12),

                      // Save Attendance Action Button
                      SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _completedDays.add(date.day);
                            });
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                backgroundColor: AppColors.surfaceElevated,
                                content: Text(
                                  'Attendance saved for ${date.month}/${date.day}/${date.year}. Synced to Hive outbox.',
                                  style: GoogleFonts.inter(color: AppColors.primaryEmerald),
                                ),
                              ),
                            );
                          },
                          child: Text(
                            'Save & Complete Attendance',
                            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _statusChip(
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
        width: 26,
        height: 26,
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
            fontSize: 11,
          ),
        ),
      ),
    );
  }
}
