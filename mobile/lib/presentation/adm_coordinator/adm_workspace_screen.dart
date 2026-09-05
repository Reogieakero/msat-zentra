import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../data/mock/mock_data.dart';
import '../../data/models/adm_model.dart';
import '../shared/widgets/custom_card.dart';
import '../shared/zentra_hamburger_drawer.dart';
import 'widgets/adm_kanban_board.dart';
import 'widgets/adm_device_tracker.dart';

class AdmWorkspaceScreen extends ConsumerStatefulWidget {
  const AdmWorkspaceScreen({super.key});

  @override
  ConsumerState<AdmWorkspaceScreen> createState() => _AdmWorkspaceScreenState();
}

class _AdmWorkspaceScreenState extends ConsumerState<AdmWorkspaceScreen> {
  int _currentIndex = 0;
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

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
                'ADM Hub',
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
            icon: const Icon(Icons.search, color: AppColors.textPrimary),
            tooltip: 'Search ADM Records',
            onPressed: () => _showSearchDialog(context),
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
          _buildOverviewTab(),
          _buildReferredTab(),
          _buildEnrolledDirectoryTab(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.pie_chart_outline),
            label: 'Overview',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.assignment_ind_outlined),
            label: 'Referred',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.view_kanban_outlined),
            label: 'Enrolled & Directory',
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 1. OVERVIEW TAB
  // ---------------------------------------------------------------------------
  Widget _buildOverviewTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ADM KPI Metrics',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _metricCard('Enrolled', '14', AppColors.primaryEmerald, Icons.check_circle_outline),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _metricCard('Referred', '6', AppColors.riskHigh, Icons.assignment_late_outlined),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _metricCard('Pending Ev', '4', AppColors.riskModerate, Icons.pending_actions),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Alert Feed — Newly Referred Students',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          _alertFeedItem('Mark Tan', 'G10 - Emerald', 'Referred by Maria Santos (4 unexcused absences)', 'Referred'),
          const SizedBox(height: 6),
          _alertFeedItem('Gabriel Aquino', 'G9 - Sapphire', 'Referred by Jose Rizal (Transmuted grade < 75)', 'Pending Approval'),
          const SizedBox(height: 6),
          _alertFeedItem('Carlos Reyes', 'G10 - Emerald', 'Active Module Delivery (Stage 4)', 'Enrolled'),
        ],
      ),
    );
  }

  Widget _metricCard(String title, String count, Color accentColor, IconData icon) {
    return CustomCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: accentColor, size: 20),
          const SizedBox(height: 8),
          Text(
            count,
            style: GoogleFonts.robotoMono(color: AppColors.textPrimary, fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _alertFeedItem(String name, String section, String reason, String status) {
    return CustomCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      name,
                      style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      section,
                      style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  reason,
                  style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 12),
                ),
              ],
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
              status,
              style: GoogleFonts.robotoMono(
                color: AppColors.primaryEmerald,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 2. REFERRED TAB (Triage List for Coordinator Action)
  // ---------------------------------------------------------------------------
  Widget _buildReferredTab() {
    final referredLearners = MockData.admLearners.where((l) => l.status == AdmStatus.referred || l.status == AdmStatus.pendingApproval).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Referred Students Triage List',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 4),
          Text(
            'Review teacher referrals and evaluate for official ADM enrollment.',
            style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 12),
          ...referredLearners.map((learner) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: CustomCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            learner.studentName,
                            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.riskHigh.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: AppColors.riskHigh.withOpacity(0.4)),
                            ),
                            child: Text(
                              learner.status.label.toUpperCase(),
                              style: GoogleFonts.robotoMono(color: AppColors.riskHigh, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${learner.sectionName} | LRN: ${learner.lrn}',
                        style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
                      ),
                      Text(
                        'Referred by: ${learner.referredByTeacher ?? "Subject Teacher"}',
                        style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 12),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Requested parent conference for ${learner.studentName}')),
                                );
                              },
                              child: const Text('Parent Meeting'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Enrolled ${learner.studentName} into ADM intervention!')),
                                );
                              },
                              child: const Text('Approve Enrollment'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              )),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 3. ENROLLED & DIRECTORY TAB (Kanban Pipeline & Devices)
  // ---------------------------------------------------------------------------
  Widget _buildEnrolledDirectoryTab() {
    return const Padding(
      padding: EdgeInsets.all(12.0),
      child: Column(
        children: [
          Expanded(child: AdmKanbanBoard()),
          SizedBox(height: 12),
          Expanded(child: AdmDeviceTracker()),
        ],
      ),
    );
  }

  void _showSearchDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.surfaceDark,
          title: Text(
            'Search ADM Directory',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: TextField(
            controller: _searchController,
            style: GoogleFonts.inter(color: AppColors.textPrimary),
            decoration: const InputDecoration(
              hintText: 'Enter student LRN, name, or section...',
              prefixIcon: Icon(Icons.search, color: AppColors.textMuted),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Close', style: GoogleFonts.inter(color: AppColors.textMuted)),
            ),
          ],
        );
      },
    );
  }
}
