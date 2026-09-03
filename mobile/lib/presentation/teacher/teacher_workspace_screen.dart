import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../shared/widgets/sync_status_pill.dart';
import '../shared/dev_offline_drawer.dart';
import 'widgets/attendance_roster_view.dart';
import 'widgets/grade_matrix_spreadsheet.dart';
import 'widgets/anecdotal_logger_view.dart';

class TeacherWorkspaceScreen extends ConsumerStatefulWidget {
  const TeacherWorkspaceScreen({super.key});

  @override
  ConsumerState<TeacherWorkspaceScreen> createState() => _TeacherWorkspaceScreenState();
}

class _TeacherWorkspaceScreenState extends ConsumerState<TeacherWorkspaceScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Zentra Teacher Workspace',
              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              'G10 - Emerald | Section Adviser',
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
              tooltip: 'Dev Offline Drawer',
              onPressed: () => Scaffold.of(context).openEndDrawer(),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primaryEmerald,
          labelColor: AppColors.primaryEmerald,
          unselectedLabelColor: AppColors.textMuted,
          labelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 12),
          unselectedLabelStyle: GoogleFonts.inter(fontSize: 12),
          tabs: const [
            Tab(text: 'Attendance'),
            Tab(text: 'Grade Matrix'),
            Tab(text: 'Anecdotal Logs'),
          ],
        ),
      ),
      endDrawer: const DevOfflineDrawer(),
      body: Padding(
        padding: const EdgeInsets.all(12.0),
        child: TabBarView(
          controller: _tabController,
          children: const [
            AttendanceRosterView(),
            GradeMatrixSpreadsheet(),
            AnecdotalLoggerView(),
          ],
        ),
      ),
    );
  }
}
