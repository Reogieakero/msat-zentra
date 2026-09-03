import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../shared/widgets/sync_status_pill.dart';
import '../shared/dev_offline_drawer.dart';
import 'widgets/adm_kanban_board.dart';
import 'widgets/adm_device_tracker.dart';

class AdmWorkspaceScreen extends StatefulWidget {
  const AdmWorkspaceScreen({super.key});

  @override
  State<AdmWorkspaceScreen> createState() => _AdmWorkspaceScreenState();
}

class _AdmWorkspaceScreenState extends State<AdmWorkspaceScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
              'ADM Coordinator Workspace',
              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              'Mati School of Arts & Trades',
              style: GoogleFonts.robotoMono(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          const Center(child: SyncStatusPill()),
          const SizedBox(width: 8),
          Builder(
            builder: (context) => IconButton(
              icon: const Icon(Icons.tune, color: AppColors.primaryEmerald),
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
          tabs: const [
            Tab(text: 'ADM Cases Kanban'),
            Tab(text: 'Issued Devices'),
          ],
        ),
      ),
      endDrawer: const DevOfflineDrawer(),
      body: Padding(
        padding: const EdgeInsets.all(12.0),
        child: TabBarView(
          controller: _tabController,
          children: const [
            AdmKanbanBoard(),
            AdmDeviceTracker(),
          ],
        ),
      ),
    );
  }
}
