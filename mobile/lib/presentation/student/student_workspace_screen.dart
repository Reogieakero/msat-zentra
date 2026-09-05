import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../shared/widgets/custom_card.dart';
import '../shared/zentra_hamburger_drawer.dart';

class StudentWorkspaceScreen extends ConsumerStatefulWidget {
  const StudentWorkspaceScreen({super.key});

  @override
  ConsumerState<StudentWorkspaceScreen> createState() => _StudentWorkspaceScreenState();
}

class _StudentWorkspaceScreenState extends ConsumerState<StudentWorkspaceScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      endDrawer: const ZentraHamburgerDrawer(),
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.school, color: AppColors.primaryEmerald, size: 22),
            const SizedBox(width: 8),
            Text(
              'Zentra',
              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.surfaceElevated,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Text(
                'Student',
                style: GoogleFonts.robotoMono(
                  color: AppColors.primaryEmerald,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined, color: AppColors.textPrimary),
            tooltip: 'Notifications',
            onPressed: () => _showNotificationSheet(context),
          ),
          Builder(
            builder: (context) => IconButton(
              icon: const Icon(Icons.menu, color: AppColors.textPrimary),
              tooltip: 'Menu',
              onPressed: () => Scaffold.of(context).openEndDrawer(),
            ),
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _buildHomeTab(),
          _buildAttendanceTab(),
          _buildGradesTab(),
          _buildAdmTab(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.calendar_month_outlined),
            label: 'Attendance',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.star_outline),
            label: 'Grades',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.shield_outlined),
            label: 'ADM',
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 1. HOME TAB (Schedule Block-List & Recent Updates Stream)
  // ---------------------------------------------------------------------------
  Widget _buildHomeTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Student Profile Card
          CustomCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: AppColors.primaryEmerald.withOpacity(0.2),
                  child: Text(
                    'CR',
                    style: GoogleFonts.inter(color: AppColors.primaryEmerald, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Carlos Reyes', style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15)),
                      Text('LRN: 109283746501 | G10 - Emerald', style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          Text(
            'Today\'s Class Schedule',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          _scheduleBlock('07:30 AM - 08:30 AM', 'Mathematics 10', 'Maria Santos', 'Room 204'),
          const SizedBox(height: 6),
          _scheduleBlock('08:30 AM - 09:30 AM', 'Science 10', 'Jose Rizal', 'Science Lab A'),
          const SizedBox(height: 6),
          _scheduleBlock('10:00 AM - 11:00 AM', 'English 10', 'Clara Bonifacio', 'Room 204'),

          const SizedBox(height: 14),
          Text(
            'Recent Updates',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          _updateItem('Mathematics 10 grade posted', 'Quarter 1 transmuted score: 85', '2 hours ago'),
          const SizedBox(height: 6),
          _updateItem('Attendance Recorded', 'Marked Present for Morning Session', 'Today 08:05 AM'),
        ],
      ),
    );
  }

  Widget _scheduleBlock(String time, String subject, String teacher, String room) {
    return CustomCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Text(time, style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 11, fontWeight: FontWeight.bold)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(subject, style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13)),
                Text('$teacher • $room', style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _updateItem(String title, String body, String timeAgo) {
    return CustomCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          const Icon(Icons.notifications_active_outlined, color: AppColors.primaryEmerald, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 12)),
                Text(body, style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 11)),
              ],
            ),
          ),
          Text(timeAgo, style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 10)),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 2. ATTENDANCE TAB (Circular Gauge Metric & Logs)
  // ---------------------------------------------------------------------------
  Widget _buildAttendanceTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Circular Attendance Rate Gauge Card
          CustomCard(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Stack(
                  alignment: Alignment.center,
                  children: [
                    const SizedBox(
                      width: 64,
                      height: 64,
                      child: CircularProgressIndicator(
                        value: 0.94,
                        strokeWidth: 6,
                        color: AppColors.primaryEmerald,
                        backgroundColor: AppColors.surfaceElevated,
                      ),
                    ),
                    Text(
                      '94%',
                      style: GoogleFonts.robotoMono(
                        color: AppColors.primaryEmerald,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Overall Attendance Rate',
                        style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '32 Days Present • 2 Days Late • 1 Day Absent',
                        style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          Text(
            'Raw Chronological Attendance Logs',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          _logRow('Sept 2, 2026', 'Present', AppColors.attendancePresent),
          const SizedBox(height: 6),
          _logRow('Sept 1, 2026', 'Present', AppColors.attendancePresent),
          const SizedBox(height: 6),
          _logRow('Aug 28, 2026', 'Late (08:20 AM)', AppColors.attendanceLate),
          const SizedBox(height: 6),
          _logRow('Aug 20, 2026', 'Absent', AppColors.attendanceAbsent),
        ],
      ),
    );
  }

  Widget _logRow(String date, String status, Color color) {
    return CustomCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Text(date, style: GoogleFonts.robotoMono(color: AppColors.textPrimary, fontSize: 12)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              status.toUpperCase(),
              style: GoogleFonts.robotoMono(color: color, fontSize: 10, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 3. GRADES TAB
  // ---------------------------------------------------------------------------
  Widget _buildGradesTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CustomCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Quarter 1 Final Grades',
                  style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                ),
                Text(
                  'GPA: 85.4',
                  style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _gradeSubjectCard('Mathematics 10', 'Maria Santos', 85),
          const SizedBox(height: 8),
          _gradeSubjectCard('Science 10', 'Jose Rizal', 88),
          const SizedBox(height: 8),
          _gradeSubjectCard('English 10', 'Clara Bonifacio', 90),
        ],
      ),
    );
  }

  Widget _gradeSubjectCard(String subject, String teacher, int grade) {
    return CustomCard(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(subject, style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14)),
              Text('Teacher: $teacher', style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11)),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '$grade',
              style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontWeight: FontWeight.bold, fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 4. ADM TAB (Task Manager View)
  // ---------------------------------------------------------------------------
  Widget _buildAdmTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Active ADM Modules & Submissions',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          _taskItem('Math Module 3: Polynomial Functions', 'Faculty: Ms. Santos', 'Due: Sept 10', false),
          const SizedBox(height: 8),
          _taskItem('Science Module 2: Plate Tectonics', 'Faculty: Mr. Rizal', 'Due: Sept 14', false),
          const SizedBox(height: 8),
          _taskItem('English Module 1: Persuasive Writing', 'Faculty: Ms. Bonifacio', 'Submitted', true),
        ],
      ),
    );
  }

  Widget _taskItem(String title, String teacher, String statusText, bool isDone) {
    return CustomCard(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Icon(
            isDone ? Icons.check_circle : Icons.pending_actions,
            color: isDone ? AppColors.primaryEmerald : AppColors.riskModerate,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13)),
                Text(teacher, style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ),
          Text(
            statusText,
            style: GoogleFonts.robotoMono(
              color: isDone ? AppColors.primaryEmerald : AppColors.riskModerate,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  void _showNotificationSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceDark,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Student Notifications',
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.assignment_turned_in, color: AppColors.primaryEmerald),
                title: Text('Math Module 2 verified by Ms. Santos', style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13)),
                subtitle: Text('Yesterday at 03:30 PM', style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11)),
              ),
            ],
          ),
        );
      },
    );
  }
}
