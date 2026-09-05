import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../../data/mock/mock_data.dart';
import '../../../data/models/adm_model.dart';
import '../../../data/models/student_model.dart';
import '../../shared/widgets/custom_card.dart';
import '../adm_subject_detail_screen.dart';

class FacultyAdmView extends StatefulWidget {
  const FacultyAdmView({super.key});

  @override
  State<FacultyAdmView> createState() => _FacultyAdmViewState();
}

class _FacultyAdmViewState extends State<FacultyAdmView> {
  final List<AdmLearnerModel> _referredLearners = List.from(MockData.admLearners);

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Card with Refer Student Button
          CustomCard(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Faculty ADM Workspace',
                            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'Access your ADM subject classrooms & refer at-risk learners.',
                            style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Quick Action Button: Refer Student
                SizedBox(
                  width: double.infinity,
                  height: 40,
                  child: ElevatedButton.icon(
                    onPressed: () => _showReferStudentModal(context),
                    icon: const Icon(Icons.person_add_alt_1, size: 16),
                    label: const Text('+ Refer Student for ADM Intervention'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryEmerald,
                      foregroundColor: const Color(0xFF0C1612),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      textStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Subject-First Cards (Google Classroom Style Entry Points)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'My Responsible ADM Subjects',
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              Text(
                'Google Classroom View',
                style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _subjectCard(
                  context,
                  title: 'Mathematics 10',
                  section: 'G10 Emerald',
                  modulesCount: '2 Modules Active',
                  studentsCount: '2 Students Enrolled',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _subjectCard(
                  context,
                  title: 'General Math 11',
                  section: 'G11 STEM A',
                  modulesCount: '1 Module Active',
                  studentsCount: '1 Student Enrolled',
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _subjectCard(
                  context,
                  title: 'Mathematics 9',
                  section: 'G9 Sapphire',
                  modulesCount: '1 Module Active',
                  studentsCount: '0 Students Enrolled',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(), // Spacer for 2-column grid align
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Referred Students Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Students Referred to ADM by Me',
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
                  '${_referredLearners.length} Referrals',
                  style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          ..._referredLearners.map((learner) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: CustomCard(
                  child: Row(
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
                            Row(
                              children: [
                                Text(
                                  learner.studentName,
                                  style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  learner.sectionName,
                                  style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 10),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Referred: ${learner.createdAt.month}/${learner.createdAt.day}/${learner.createdAt.year}',
                              style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: (learner.status == AdmStatus.enrolled ? AppColors.primaryEmerald : AppColors.riskModerate).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: (learner.status == AdmStatus.enrolled ? AppColors.primaryEmerald : AppColors.riskModerate).withOpacity(0.4),
                          ),
                        ),
                        child: Text(
                          learner.status.label.toUpperCase(),
                          style: GoogleFonts.robotoMono(
                            color: learner.status == AdmStatus.enrolled ? AppColors.primaryEmerald : AppColors.riskModerate,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              )),
        ],
      ),
    );
  }

  Widget _subjectCard(
    BuildContext context, {
    required String title,
    required String section,
    required String modulesCount,
    required String studentsCount,
  }) {
    return CustomCard(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => FacultyAdmSubjectDetailScreen(
              subjectName: title,
              sectionName: section,
            ),
          ),
        );
      },
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Icon(Icons.school, color: AppColors.primaryEmerald, size: 22),
              const Icon(Icons.arrow_forward, color: AppColors.textMuted, size: 14),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            section,
            style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 6),
          Text(
            '$modulesCount • $studentsCount',
            style: GoogleFonts.inter(color: AppColors.primaryEmerald, fontSize: 10, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                'Open Classroom',
                style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 10, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 2),
              const Icon(Icons.chevron_right, size: 12, color: AppColors.textSecondary),
            ],
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Refer Student to ADM Modal
  // ---------------------------------------------------------------------------
  void _showReferStudentModal(BuildContext context) {
    StudentModel selectedStudent = MockData.students.first;
    String selectedReason = 'High Risk: 4 consecutive absences';
    final notesController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
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
                        'Refer Student for ADM Intervention',
                        style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.textMuted),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text('Select Student', style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12)),
                  const SizedBox(height: 4),
                  DropdownButtonFormField<StudentModel>(
                    value: selectedStudent,
                    dropdownColor: AppColors.surfaceElevated,
                    style: GoogleFonts.inter(color: AppColors.textPrimary),
                    items: MockData.students.map((std) {
                      return DropdownMenuItem<StudentModel>(
                        value: std,
                        child: Text('${std.fullName} (${std.sectionName})'),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setModalState(() => selectedStudent = val);
                    },
                  ),
                  const SizedBox(height: 12),
                  Text('Referral Trigger / Reason', style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12)),
                  const SizedBox(height: 4),
                  DropdownButtonFormField<String>(
                    value: selectedReason,
                    dropdownColor: AppColors.surfaceElevated,
                    style: GoogleFonts.inter(color: AppColors.textPrimary),
                    items: const [
                      DropdownMenuItem(value: 'High Risk: 4 consecutive absences', child: Text('High Risk: Consecutive Absences')),
                      DropdownMenuItem(value: 'Academic Risk: Transmuted score < 75', child: Text('Academic Risk: Transmuted Score < 75')),
                      DropdownMenuItem(value: 'Working Student / Socio-Economic', child: Text('Working Student / Socio-Economic')),
                    ],
                    onChanged: (val) {
                      if (val != null) setModalState(() => selectedReason = val);
                    },
                  ),
                  const SizedBox(height: 12),
                  Text('Anecdotal Observations & Notes', style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: notesController,
                    maxLines: 2,
                    style: GoogleFonts.inter(color: AppColors.textPrimary),
                    decoration: const InputDecoration(hintText: 'Enter observation details for ADM Coordinator...'),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: ElevatedButton(
                      onPressed: () {
                        setState(() {
                          _referredLearners.add(AdmLearnerModel(
                            id: 'adm_${DateTime.now().millisecondsSinceEpoch}',
                            studentId: selectedStudent.id,
                            studentName: selectedStudent.fullName,
                            lrn: selectedStudent.lrn,
                            sectionName: selectedStudent.sectionName,
                            stage: AdmStage.anecdotal,
                            status: AdmStatus.referred,
                            referredByTeacher: 'Maria Santos',
                            createdAt: DateTime.now(),
                          ));
                        });
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor: AppColors.surfaceElevated,
                            content: Text(
                              'Referred ${selectedStudent.fullName} to ADM Coordinator. Queued in outbox.',
                              style: GoogleFonts.inter(color: AppColors.primaryEmerald),
                            ),
                          ),
                        );
                      },
                      child: Text(
                        'Submit ADM Referral',
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
  }
}
