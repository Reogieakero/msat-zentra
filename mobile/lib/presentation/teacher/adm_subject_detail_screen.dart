import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../data/mock/mock_data.dart';
import '../../data/models/adm_model.dart';
import '../shared/widgets/custom_card.dart';

class FacultyAdmSubjectDetailScreen extends StatefulWidget {
  final String subjectName;
  final String sectionName;

  const FacultyAdmSubjectDetailScreen({
    super.key,
    required this.subjectName,
    required this.sectionName,
  });

  @override
  State<FacultyAdmSubjectDetailScreen> createState() => _FacultyAdmSubjectDetailScreenState();
}

class _FacultyAdmSubjectDetailScreenState extends State<FacultyAdmSubjectDetailScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late List<AdmSubjectModuleModel> _subjectModules;
  late List<AdmLearnerModel> _enrolledLearners;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);

    // Filter modules for this subject or supply realistic defaults
    _subjectModules = MockData.admModules
        .where((m) => m.subjectName.toLowerCase().contains(widget.subjectName.toLowerCase()) ||
            widget.subjectName.toLowerCase().contains(m.subjectName.toLowerCase()))
        .toList();

    if (_subjectModules.isEmpty) {
      _subjectModules = [
        AdmSubjectModuleModel(
          id: 'mod_sub_01',
          subjectName: widget.subjectName,
          moduleTitle: 'Module 1: Core Fundamentals & Competencies',
          fileName: '${widget.subjectName.replaceAll(' ', '')}_Mod1.pdf',
          fileSize: '2.1 MB',
          assignedTeacher: 'Maria Santos',
          dueDate: DateTime.now().add(const Duration(days: 6)),
        ),
      ];
    }

    // Filter learners enrolled in ADM
    _enrolledLearners = List.from(MockData.admLearners);
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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.primaryEmerald),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.subjectName,
              style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            Text(
              '${widget.sectionName} • ADM Classroom',
              style: GoogleFonts.robotoMono(fontSize: 10, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.upload_file, color: AppColors.primaryEmerald),
            tooltip: 'Upload Module',
            onPressed: () => _showUploadModuleModal(context),
          ),
        ],
      ),
      body: Column(
        children: [
          // Google Classroom Header Banner Card
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.surfaceElevated,
                    AppColors.primaryEmerald.withOpacity(0.15),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.primaryEmerald.withOpacity(0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primaryEmerald,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'ADM CLASSROOM',
                          style: GoogleFonts.robotoMono(
                            color: const Color(0xFF0C1612),
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: () => _showUploadModuleModal(context),
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('+ Upload Module'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primaryEmerald,
                          foregroundColor: const Color(0xFF0C1612),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          textStyle: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    widget.subjectName,
                    style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    '${widget.sectionName} | Teacher: Maria Santos',
                    style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _metricBadge(Icons.picture_as_pdf, '${_subjectModules.length} Active Modules'),
                      const SizedBox(width: 8),
                      _metricBadge(Icons.people_alt, '${_enrolledLearners.length} Students Enrolled'),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Tab Navigation Bar (Google Classroom style: Modules / Students)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            child: TabBar(
              controller: _tabController,
              indicatorColor: AppColors.primaryEmerald,
              indicatorSize: TabBarIndicatorSize.tab,
              labelColor: AppColors.primaryEmerald,
              unselectedLabelColor: AppColors.textMuted,
              labelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 12),
              tabs: const [
                Tab(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.folder_outlined, size: 16),
                      SizedBox(width: 6),
                      Text('Modules & Stream'),
                    ],
                  ),
                ),
                Tab(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.people_outline, size: 16),
                      SizedBox(width: 6),
                      Text('ADM Students'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Tab Contents
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildModulesTab(),
                _buildStudentsTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricBadge(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark.withOpacity(0.7),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.primaryEmerald),
          const SizedBox(width: 4),
          Text(
            text,
            style: GoogleFonts.robotoMono(color: AppColors.textPrimary, fontSize: 10, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Tab 1: Modules & Stream
  // ---------------------------------------------------------------------------
  Widget _buildModulesTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Uploaded Self-Learning Modules',
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              Text(
                '${_subjectModules.length} Modules',
                style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_subjectModules.isEmpty)
            CustomCard(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Column(
                  children: [
                    const Icon(Icons.cloud_upload_outlined, color: AppColors.textMuted, size: 36),
                    const SizedBox(height: 8),
                    Text(
                      'No Modules Uploaded Yet',
                      style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Tap "+ Upload Module" to publish learning materials for enrolled ADM students.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11),
                    ),
                  ],
                ),
              ),
            )
          else
            ..._subjectModules.map((mod) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: CustomCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.primaryEmerald.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                mod.subjectName,
                                style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                            Text(
                              'Due: ${mod.dueDate.month}/${mod.dueDate.day}/${mod.dueDate.year}',
                              style: GoogleFonts.robotoMono(color: AppColors.riskModerate, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          mod.moduleTitle,
                          style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.picture_as_pdf, color: AppColors.riskHigh, size: 16),
                            const SizedBox(width: 6),
                            Text(
                              '${mod.fileName} (${mod.fileSize})',
                              style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Downloading ${mod.fileName}...')),
                                  );
                                },
                                icon: const Icon(Icons.download, size: 14),
                                label: const Text('Download PDF'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: () => _showAssignedStudentsModal(context, mod),
                                icon: const Icon(Icons.assignment_ind, size: 14),
                                label: const Text('Check Submissions'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.surfaceElevated,
                                  foregroundColor: AppColors.textPrimary,
                                ),
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
  // Tab 2: ADM Students Enrolled
  // ---------------------------------------------------------------------------
  Widget _buildStudentsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Enrolled ADM Students Roster',
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Text(
                  '${_enrolledLearners.length} Active',
                  style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ..._enrolledLearners.map((learner) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: CustomCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: AppColors.primaryEmerald.withOpacity(0.2),
                            child: Text(
                              learner.studentName.substring(0, 1),
                              style: GoogleFonts.inter(color: AppColors.primaryEmerald, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  learner.studentName,
                                  style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                                Text(
                                  'LRN: ${learner.lrn} | ${learner.sectionName}',
                                  style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 10),
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
                              learner.status.label.toUpperCase(),
                              style: GoogleFonts.robotoMono(
                                color: AppColors.primaryEmerald,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.task_alt, size: 13, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Text(
                            'Modules: ${learner.completedModulesCount} Completed, ${learner.pendingModulesCount} Pending',
                            style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                      if (learner.issuedDevice != null) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.devices, size: 13, color: AppColors.primaryEmerald),
                            const SizedBox(width: 4),
                            Text(
                              'Device Issued: ${learner.issuedDevice}',
                              style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 10),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Reminder notification sent to ${learner.studentName} & Parent.')),
                                );
                              },
                              icon: const Icon(Icons.notifications_active, size: 13),
                              label: const Text('Send Reminder'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                textStyle: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Opened grading portal for ${learner.studentName}')),
                                );
                              },
                              icon: const Icon(Icons.grade, size: 13),
                              label: const Text('Grade Module'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primaryEmerald,
                                foregroundColor: const Color(0xFF0C1612),
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                textStyle: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold),
                              ),
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
  // Upload Module Modal (Scoped to this subject)
  // ---------------------------------------------------------------------------
  void _showUploadModuleModal(BuildContext context) {
    final titleController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Upload Module for ${widget.subjectName}',
                    style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textMuted),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text('Target Classroom', style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12)),
              const SizedBox(height: 4),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Text(
                  '${widget.subjectName} — ${widget.sectionName}',
                  style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 12),
              Text('Module Title & Competency', style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12)),
              const SizedBox(height: 4),
              TextField(
                controller: titleController,
                style: GoogleFonts.inter(color: AppColors.textPrimary),
                decoration: const InputDecoration(hintText: 'e.g. Module 4: Quadratic Equations'),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Attached file: Math10_Mod4_Quadratic.pdf (2.8 MB)')),
                  );
                },
                icon: const Icon(Icons.attach_file, size: 16),
                label: const Text('Attach PDF Module File'),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton(
                  onPressed: () {
                    final title = titleController.text.trim();
                    if (title.isNotEmpty) {
                      setState(() {
                        _subjectModules.add(AdmSubjectModuleModel(
                          id: 'mod_${DateTime.now().millisecondsSinceEpoch}',
                          subjectName: widget.subjectName,
                          moduleTitle: title,
                          fileName: '${widget.subjectName.replaceAll(' ', '')}_Module.pdf',
                          fileSize: '2.8 MB',
                          assignedTeacher: 'Maria Santos',
                          dueDate: DateTime.now().add(const Duration(days: 7)),
                        ));
                      });
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Module "$title" published in ${widget.subjectName}!')),
                      );
                    }
                  },
                  child: const Text('Publish & Distribute Module'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showAssignedStudentsModal(BuildContext context, AdmSubjectModuleModel module) {
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
                'Submissions: ${module.moduleTitle}',
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
              ),
              Text(
                module.subjectName,
                style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 11),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: AppColors.primaryEmerald.withOpacity(0.2),
                  child: const Text('CR', style: TextStyle(color: AppColors.primaryEmerald)),
                ),
                title: Text('Carlos Reyes (G10 - Emerald)', style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13)),
                subtitle: Text('Status: Submitted • Sept 4', style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 11)),
                trailing: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Grade'),
                ),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: AppColors.primaryEmerald.withOpacity(0.2),
                  child: const Text('MT', style: TextStyle(color: AppColors.primaryEmerald)),
                ),
                title: Text('Mark Tan (G10 - Emerald)', style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13)),
                subtitle: Text('Status: In Progress • Due Sept 10', style: GoogleFonts.robotoMono(color: AppColors.riskModerate, fontSize: 11)),
                trailing: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Remind'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
