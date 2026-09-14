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
  late DateTime _mapMonth; // Currently displayed month in Attendance Map
  Session _selectedSession = Session.AM;

  // Pagination state for Recent Attendance Logs
  int _currentPage = 1;
  static const int _pageSize = 4;

  // Set of day numbers in September 2026 where attendance was completed
  final Set<int> _completedDays = {1, 2, 3, 4, 5};

  static const List<String> _monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  String _getMonthName(int month) => _monthNames[month - 1];

  @override
  void initState() {
    super.initState();
    _mapMonth = DateTime(_selectedDate.year, _selectedDate.month, 1);
  }

  @override
  Widget build(BuildContext context) {
    final attendanceNotifier = ref.read(attendanceProvider.notifier);

    final now = DateTime.now();
    final todayDay = now.day; // 5

    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 600;

    // Days in current _mapMonth
    final daysInMonth = DateUtils.getDaysInMonth(_mapMonth.year, _mapMonth.month);
    final leadingEmptyDays = DateTime(_mapMonth.year, _mapMonth.month, 1).weekday - 1;
    final totalGridItems = leadingEmptyDays + daysInMonth;

    // Only past school days & today (most recent day first)
    final pastAndTodayDays = List.generate(todayDay, (i) => todayDay - i); // [5, 4, 3, 2, 1]
    final totalPages = (pastAndTodayDays.length / _pageSize).ceil().clamp(1, 99);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 105.0),
        child: FloatingActionButton(
          onPressed: () {
            _openRosterMarkingSheet(context, _selectedDate, attendanceNotifier);
          },
          backgroundColor: AppColors.primaryEmerald,
          foregroundColor: const Color(0xFF0C1612),
          shape: const CircleBorder(),
          elevation: 6,
          tooltip: 'Create / Mark Attendance',
          child: const Icon(Icons.add, size: 26),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Color-Coded Calendar Heatmap & Active Date Context (Unified View)
            CustomCard(
              padding: isMobile
                  ? const EdgeInsets.fromLTRB(10, 10, 10, 6)
                  : const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.chevron_left, color: AppColors.primaryEmerald, size: 20),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
                              tooltip: 'Previous Month',
                              onPressed: () {
                                setState(() {
                                  _mapMonth = DateTime(_mapMonth.year, _mapMonth.month - 1, 1);
                                });
                              },
                            ),
                            Flexible(
                              child: Text(
                                '${_getMonthName(_mapMonth.month)} ${_mapMonth.year}',
                                style: GoogleFonts.inter(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: isMobile ? 13 : 14,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.chevron_right, color: AppColors.primaryEmerald, size: 20),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
                              tooltip: 'Next Month',
                              onPressed: () {
                                setState(() {
                                  _mapMonth = DateTime(_mapMonth.year, _mapMonth.month + 1, 1);
                                });
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primaryEmerald.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${_completedDays.length}/22 Days Done',
                          style: GoogleFonts.robotoMono(
                            color: AppColors.primaryEmerald,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.date_range, color: AppColors.primaryEmerald, size: 20),
                        tooltip: 'Select Date',
                        onPressed: () => _pickDate(context),
                      ),
                    ],
                  ),
                  SizedBox(height: isMobile ? 4 : 6),

                  // Integrated Active Selected Date Context Banner
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: isMobile ? 8 : 10, vertical: isMobile ? 6 : 8),
                    decoration: BoxDecoration(
                      color: AppColors.primaryEmerald.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.primaryEmerald.withOpacity(0.35)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.event_available, size: 16, color: AppColors.primaryEmerald),
                        const SizedBox(width: 8),
                        Text(
                          'Active Context: ',
                          style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
                        ),
                        Expanded(
                          child: Text(
                            '${_selectedDate.month}/${_selectedDate.day}/${_selectedDate.year}${_selectedDate.year == now.year && _selectedDate.month == now.month && _selectedDate.day == todayDay ? " (Today)" : ""}',
                            style: GoogleFonts.robotoMono(
                              color: AppColors.primaryEmerald,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: isMobile ? 8 : 12),

                // Color Coding Legend
                Wrap(
                  spacing: isMobile ? 8 : 10,
                  runSpacing: 4,
                  children: [
                    _legendPill('Completed', AppColors.attendancePresent),
                    _legendPill('Unrecorded (Past)', AppColors.attendanceAbsent),
                    _legendPill('Pending (Future)', AppColors.riskModerate),
                    _legendPill('Today', AppColors.primaryEmerald, isToday: true),
                    _legendPill('Weekend', AppColors.surfaceElevated),
                  ],
                ),
                SizedBox(height: isMobile ? 8 : 14),

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
                SizedBox(height: isMobile ? 4 : 8),

                // Calendar Grid with AspectRatio to eliminate vertical stretching
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: totalGridItems,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    crossAxisSpacing: isMobile ? 4 : 6,
                    mainAxisSpacing: isMobile ? 4 : 6,
                    childAspectRatio: isMobile ? 1.35 : 1.25,
                  ),
                  itemBuilder: (context, index) {
                    if (index < leadingEmptyDays) {
                      return const SizedBox.shrink();
                    }
                    final dayNum = index - leadingEmptyDays + 1;
                    final tileDate = DateTime(_mapMonth.year, _mapMonth.month, dayNum);
                    final isWeekend = (tileDate.weekday == DateTime.saturday || tileDate.weekday == DateTime.sunday);
                    final isDone = (_mapMonth.year == 2026 && _mapMonth.month == 9 && _completedDays.contains(dayNum));
                    final isToday = (tileDate.year == now.year && tileDate.month == now.month && tileDate.day == now.day);
                    final isPastDay = tileDate.isBefore(DateTime(now.year, now.month, now.day));

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
                      // Unrecorded Past Day -> Red alert (#EF4444)
                      bgTileColor = AppColors.attendanceAbsent.withOpacity(0.18);
                      borderTileColor = AppColors.attendanceAbsent.withOpacity(0.6);
                      textTileColor = AppColors.attendanceAbsent;
                    } else {
                      // Future Day -> Amber (#F59E0B)
                      bgTileColor = AppColors.riskModerate.withOpacity(0.15);
                      borderTileColor = AppColors.riskModerate.withOpacity(0.4);
                      textTileColor = AppColors.riskModerate;
                    }

                    final isSelectedDate = (_selectedDate.year == tileDate.year &&
                        _selectedDate.month == tileDate.month &&
                        _selectedDate.day == tileDate.day);

                    return GestureDetector(
                      onTap: () {
                        setState(() {
                          _selectedDate = tileDate;
                        });
                        _openRosterMarkingSheet(context, tileDate, attendanceNotifier);
                      },
                      child: Container(
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: isSelectedDate ? AppColors.primaryEmerald.withOpacity(0.3) : bgTileColor,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isSelectedDate ? AppColors.primaryEmerald : borderTileColor,
                            width: isSelectedDate ? 2.5 : (isToday ? 2.0 : 1.0),
                          ),
                          boxShadow: isSelectedDate
                              ? [
                                  BoxShadow(
                                    color: AppColors.primaryEmerald.withOpacity(0.3),
                                    blurRadius: 8,
                                    spreadRadius: -1,
                                  ),
                                ]
                              : null,
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

          // 3. Paginated Attendance Logs (Past & Today Only, Page 1 = Most Recent First)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Attendance Logs',
                  style: GoogleFonts.inter(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              // Compact Pagination Controls
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Page $_currentPage of $totalPages',
                    style: GoogleFonts.robotoMono(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    icon: const Icon(Icons.chevron_left, size: 18),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
                    color: _currentPage > 1 ? AppColors.primaryEmerald : AppColors.textMuted,
                    onPressed: _currentPage > 1
                        ? () => setState(() => _currentPage--)
                        : null,
                  ),
                  IconButton(
                    icon: const Icon(Icons.chevron_right, size: 18),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
                    color: _currentPage < totalPages ? AppColors.primaryEmerald : AppColors.textMuted,
                    onPressed: _currentPage < totalPages
                        ? () => setState(() => _currentPage++)
                        : null,
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Paginated Logs List for Past & Today Only
          Builder(
            builder: (context) {
              final startIndex = (_currentPage - 1) * _pageSize;
              final endIndex = (startIndex + _pageSize).clamp(0, pastAndTodayDays.length);
              final pageDays = pastAndTodayDays.sublist(startIndex, endIndex);

              return ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: pageDays.length,
                itemBuilder: (context, index) {
                  final dayNum = pageDays[index];
                  final logDate = DateTime(2026, 9, dayNum);
                  final isDone = _completedDays.contains(dayNum);
                  final isToday = (dayNum == todayDay);

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
                          Expanded(
                            child: Row(
                              children: [
                                Text(
                                  'Sept ${dayNum.toString().padLeft(2, '0')}, 2026',
                                  style: GoogleFonts.robotoMono(
                                    color: isToday ? AppColors.primaryEmerald : AppColors.textPrimary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                if (isToday) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryEmerald.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                    child: Text(
                                      'TODAY',
                                      style: GoogleFonts.robotoMono(
                                        color: AppColors.primaryEmerald,
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
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
                              isDone ? 'DONE' : 'UNRECORDED',
                              style: GoogleFonts.robotoMono(
                                color: isDone ? AppColors.attendancePresent : AppColors.attendanceAbsent,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Icon(Icons.chevron_right, size: 18, color: AppColors.textMuted),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ],
      ),
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
        _mapMonth = DateTime(picked.year, picked.month, 1);
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
                          Expanded(
                            child: Column(
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
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
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
                            const SizedBox(width: 8),
                            Flexible(
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    notifier.markAllPresent('sec_g10_emerald');
                                  },
                                  icon: const Icon(Icons.done_all, size: 14),
                                  label: const Text('Mark All Present'),
                                  style: ElevatedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                    textStyle: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600),
                                  ),
                                ),
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
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
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
                                      const SizedBox(width: 8),
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
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 2),
                                            StatusBadge.attendance(record.status),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          _statusChip(record, AttendanceStatus.present, 'P', AppColors.attendancePresent, notifier),
                                          const SizedBox(width: 3),
                                          _statusChip(record, AttendanceStatus.absent, 'A', AppColors.attendanceAbsent, notifier),
                                          const SizedBox(width: 3),
                                          _statusChip(record, AttendanceStatus.late, 'L', AppColors.attendanceLate, notifier),
                                          const SizedBox(width: 3),
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
