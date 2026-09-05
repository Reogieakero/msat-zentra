import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../shared/widgets/custom_card.dart';
import '../shared/zentra_hamburger_drawer.dart';
import 'widgets/attendance_heatmap.dart';
import 'widgets/quarterly_report_card.dart';

class ParentWorkspaceScreen extends ConsumerStatefulWidget {
  const ParentWorkspaceScreen({super.key});

  @override
  ConsumerState<ParentWorkspaceScreen> createState() => _ParentWorkspaceScreenState();
}

class _ParentWorkspaceScreenState extends ConsumerState<ParentWorkspaceScreen> {
  int _currentIndex = 0;
  String _selectedChild = 'Carlos Reyes';

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
                'Parent',
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
          // Notification Bell
          IconButton(
            icon: const Icon(Icons.notifications_outlined, color: AppColors.textPrimary),
            tooltip: 'Alerts',
            onPressed: () => _showAlertsSheet(context),
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

  // Child Selector Dropdown Header Component
  Widget _childSelectorBar() {
    return CustomCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.primaryEmerald.withOpacity(0.2),
            child: const Icon(Icons.child_care, color: AppColors.primaryEmerald, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedChild,
                dropdownColor: AppColors.surfaceElevated,
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                items: const [
                  DropdownMenuItem(
                    value: 'Carlos Reyes',
                    child: Text('Carlos Reyes (G10 - Emerald)'),
                  ),
                  DropdownMenuItem(
                    value: 'Bea Reyes',
                    child: Text('Bea Reyes (G7 - Ruby)'),
                  ),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _selectedChild = val);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 1. HOME TAB
  // ---------------------------------------------------------------------------
  Widget _buildHomeTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _childSelectorBar(),
          const SizedBox(height: 12),

          // Real-Time Alert Banner Mirror
          CustomCard(
            backgroundColor: AppColors.primaryEmerald.withOpacity(0.1),
            borderColor: AppColors.primaryEmerald.withOpacity(0.4),
            child: Row(
              children: [
                const Icon(Icons.check_circle_outline, color: AppColors.primaryEmerald),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Attendance Alert',
                        style: GoogleFonts.inter(color: AppColors.primaryEmerald, fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                      Text(
                        '$_selectedChild arrived at school and marked Present at 08:05 AM',
                        style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          Text(
            'Current Quarter Overview',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: CustomCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Quarter 1 GPA', style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11)),
                      const SizedBox(height: 4),
                      Text('87.7', style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 20, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CustomCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Attendance Rate', style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11)),
                      const SizedBox(height: 4),
                      Text('94.2%', style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 20, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 2. ATTENDANCE TAB
  // ---------------------------------------------------------------------------
  Widget _buildAttendanceTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _childSelectorBar(),
          const SizedBox(height: 12),
          const AttendanceHeatmap(),
          const SizedBox(height: 12),
          Text(
            'Chronological Attendance Logs',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          _logItem('Sept 2, 2026', 'Present', AppColors.attendancePresent, 'Marked present by Ms. Santos'),
          const SizedBox(height: 6),
          _logItem('Sept 1, 2026', 'Present', AppColors.attendancePresent, 'Marked present by Ms. Santos'),
          const SizedBox(height: 6),
          _logItem('Aug 28, 2026', 'Late', AppColors.attendanceLate, 'Arrived at 08:20 AM'),
          const SizedBox(height: 6),
          _logItem('Aug 20, 2026', 'Absent', AppColors.attendanceAbsent, 'Unexcused Absence — Advisory Follow-up'),
        ],
      ),
    );
  }

  Widget _logItem(String date, String status, Color color, String notes) {
    return CustomCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Text(date, style: GoogleFonts.robotoMono(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.bold)),
          const Spacer(),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
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
              const SizedBox(height: 2),
              Text(notes, style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 3. GRADES TAB (Locked Grades Table in Roboto Mono)
  // ---------------------------------------------------------------------------
  Widget _buildGradesTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        children: [
          _childSelectorBar(),
          const SizedBox(height: 12),
          const QuarterlyReportCard(),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 4. ADM TAB (View Only)
  // ---------------------------------------------------------------------------
  Widget _buildAdmTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _childSelectorBar(),
          const SizedBox(height: 12),
          CustomCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'ADM Intervention Timeline (Read-Only)',
                      style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.riskModerate.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'STAGE 3: PARENT MEETING',
                        style: GoogleFonts.robotoMono(color: AppColors.riskModerate, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _timelineStep('1. Anecdotal Incident Logged', 'Aug 15, 2026', true),
                _timelineStep('2. Faculty Consultation Conducted', 'Aug 22, 2026', true),
                _timelineStep('3. Parent-Teacher Meeting', 'Scheduled for Sept 8, 2026', false),
                _timelineStep('4. Home Visitation & Certification', 'Pending', false),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _timelineStep(String title, String subtitle, bool isCompleted) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(
            isCompleted ? Icons.check_circle : Icons.radio_button_unchecked,
            color: isCompleted ? AppColors.primaryEmerald : AppColors.textMuted,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
                Text(subtitle, style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 10)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showAlertsSheet(BuildContext context) {
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
                'FCM Real-Time Alerts Feed',
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.notifications_active, color: AppColors.primaryEmerald),
                title: Text('Carlos Reyes marked Present', style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13)),
                subtitle: Text('Today at 08:05 AM', style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11)),
              ),
            ],
          ),
        );
      },
    );
  }
}
