import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../app/constants/app_breakpoints.dart';
import '../../app/utils/app_responsive.dart';
import '../../data/mock/mock_data.dart';
import '../../data/models/teacher_class_model.dart';
import '../../providers/sync_provider.dart';
import '../shared/widgets/custom_card.dart';
import '../shared/widgets/sync_status_pill.dart';
import '../shared/zentra_hamburger_drawer.dart';
import '../shared/notifications_screen.dart';
import 'widgets/class_selector_view.dart';
import 'widgets/attendance_roster_view.dart';
import 'widgets/grade_matrix_spreadsheet.dart';
import 'widgets/anecdotal_logger_view.dart';
import 'widgets/faculty_adm_view.dart';
import '../shared/widgets/floating_oblong_nav_bar.dart';

class TeacherWorkspaceScreen extends ConsumerStatefulWidget {
  const TeacherWorkspaceScreen({super.key});

  @override
  ConsumerState<TeacherWorkspaceScreen> createState() => _TeacherWorkspaceScreenState();
}

class _TeacherWorkspaceScreenState extends ConsumerState<TeacherWorkspaceScreen> {
  int _currentIndex = 0; // Default to Home Tab

  // Active selected class context (null = show Class Selector list)
  TeacherClassModel? _selectedClass;

  // Segmented control state inside Class Workspace (0 = Attendance, 1 = Grades, 2 = Anecdotal)
  int _classSubTab = 0;

  @override
  Widget build(BuildContext context) {
    final showDesktopNav = !context.isMobile;

    return Scaffold(
      extendBody: true,
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
                'Faculty',
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
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: AppColors.textPrimary),
                tooltip: 'Notifications',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                  );
                },
              ),
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryEmerald,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
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
      body: showDesktopNav
          ? Row(
              children: [
                NavigationRail(
                  selectedIndex: _currentIndex,
                  onDestinationSelected: (index) => setState(() => _currentIndex = index),
                  backgroundColor: AppColors.surfaceDark,
                  selectedIconTheme: const IconThemeData(color: AppColors.primaryEmerald),
                  unselectedIconTheme: const IconThemeData(color: AppColors.textMuted),
                  selectedLabelTextStyle: GoogleFonts.inter(
                    color: AppColors.primaryEmerald,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                  unselectedLabelTextStyle: GoogleFonts.inter(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                  labelType: NavigationRailLabelType.all,
                  destinations: const [
                    NavigationRailDestination(
                      icon: Icon(Icons.grid_view),
                      label: Text('Home'),
                    ),
                    NavigationRailDestination(
                      icon: Icon(Icons.book_outlined),
                      label: Text('Classes'),
                    ),
                    NavigationRailDestination(
                      icon: Icon(Icons.auto_graph),
                      label: Text('ADM'),
                    ),
                  ],
                ),
                const VerticalDivider(width: 1, color: AppColors.borderSubtle),
                Expanded(
                  child: IndexedStack(
                    index: _currentIndex,
                    children: [
                      _buildHomeTab(),
                      _buildClassesTab(),
                      _buildAdmTab(),
                    ],
                  ),
                ),
              ],
            )
          : IndexedStack(
              index: _currentIndex,
              children: [
                _buildHomeTab(),
                _buildClassesTab(),
                _buildAdmTab(),
              ],
            ),
      bottomNavigationBar: showDesktopNav
          ? null
          : FloatingOblongNavBar(
              currentIndex: _currentIndex,
              onTap: (index) => setState(() => _currentIndex = index),
              items: const [
                FloatingNavItem(
                  icon: Icons.grid_view_outlined,
                  activeIcon: Icons.grid_view_rounded,
                  label: 'Home',
                ),
                FloatingNavItem(
                  icon: Icons.book_outlined,
                  activeIcon: Icons.book_rounded,
                  label: 'Classes',
                ),
                FloatingNavItem(
                  icon: Icons.auto_graph_outlined,
                  activeIcon: Icons.auto_graph_rounded,
                  label: 'ADM',
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
      padding: const EdgeInsets.fromLTRB(12.0, 12.0, 12.0, 96.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Greeting Card
          CustomCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: AppColors.primaryEmerald.withOpacity(0.2),
                            child: const Icon(Icons.waving_hand, color: AppColors.primaryEmerald, size: 18),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Good day, Teacher Maria! 👋',
                                  style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  'Faculty • MSAT Zentra Portal',
                                  style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 10),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    const SyncStatusPill(),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Welcome to your daily workspace. You have ${MockData.teacherClasses.length} active subject classes scheduled for instruction today.',
                  style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 12, height: 1.4),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Today's Teaching Schedule
          Text(
            'Today\'s Teaching Schedule',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          ...MockData.teacherClasses.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: CustomCard(
                  onTap: () {
                    setState(() {
                      _currentIndex = 1;
                      _selectedClass = item;
                    });
                  },
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      Text(
                        item.scheduleTime,
                        style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.subjectName,
                              style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            Text(
                              '${item.sectionName} • ${item.room}',
                              style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: AppColors.primaryEmerald, size: 18),
                    ],
                  ),
                ),
              )),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 2. CLASSES TAB (Class-Context-First: Selector -> Workspace)
  // ---------------------------------------------------------------------------
  Widget _buildClassesTab() {
    // If no class selected yet, show Class Selector List View
    if (_selectedClass == null) {
      return ClassSelectorView(
        onSelectClass: (selected) {
          setState(() {
            _selectedClass = selected;
          });
        },
      );
    }

    // Active Class Workspace View (Segmented Control: Attendance | Grades | Anecdotal)
    return Padding(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        children: [
          // Top Subject Sub-Header Bar (Back Button + Subject Info below Zentra AppBar)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back, size: 20, color: AppColors.primaryEmerald),
                  tooltip: 'Back to Class Selector',
                  onPressed: () {
                    setState(() {
                      _selectedClass = null;
                    });
                  },
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${_selectedClass!.subjectName} — ${_selectedClass!.sectionName}',
                        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        '${_selectedClass!.scheduleTime} | ${_selectedClass!.room}',
                        style: GoogleFonts.robotoMono(fontSize: 10, color: AppColors.textMuted),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Segmented Control Header
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            child: Row(
              children: [
                _segmentTabItem(0, 'Attendance'),
                _segmentTabItem(1, 'Grades Matrix'),
                _segmentTabItem(2, 'Incidents'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _buildSelectedSubTab(),
          ),
        ],
      ),
    );
  }

  Widget _segmentTabItem(int index, String label) {
    final isSelected = _classSubTab == index;

    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _classSubTab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primaryEmerald : Colors.transparent,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            label,
            style: GoogleFonts.inter(
              color: isSelected ? const Color(0xFF0C1612) : AppColors.textSecondary,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSelectedSubTab() {
    switch (_classSubTab) {
      case 0:
        return const AttendanceRosterView();
      case 1:
        return const GradeMatrixSpreadsheet();
      case 2:
      default:
        return const AnecdotalLoggerView();
    }
  }

  // ---------------------------------------------------------------------------
  // 3. ADM TAB
  // ---------------------------------------------------------------------------
  Widget _buildAdmTab() {
    return const Padding(
      padding: EdgeInsets.all(12.0),
      child: FacultyAdmView(),
    );
  }
}
