import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../shared/widgets/custom_card.dart';

class AdmSubjectInfo {
  final String title;
  final String section;
  final String modulesCount;
  final String studentsCount;

  const AdmSubjectInfo({
    required this.title,
    required this.section,
    required this.modulesCount,
    required this.studentsCount,
  });
}

class AllAdmSubjectsScreen extends StatelessWidget {
  final List<AdmSubjectInfo> subjects;
  final VoidCallback onBack;
  final ValueChanged<AdmSubjectInfo> onSelectSubject;

  const AllAdmSubjectsScreen({
    super.key,
    required this.subjects,
    required this.onBack,
    required this.onSelectSubject,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.primaryEmerald),
          tooltip: 'Back',
          onPressed: onBack,
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'All ADM Subjects',
              style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            Text(
              '${subjects.length} subjects • ADM Classroom',
              style: GoogleFonts.robotoMono(fontSize: 10, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(0, 8, 0, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'My Responsible ADM Subjects',
              style: GoogleFonts.inter(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: subjects.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
                mainAxisExtent: 152,
              ),
              itemBuilder: (context, index) {
                final subject = subjects[index];
                return _subjectCard(context, subject);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _subjectCard(BuildContext context, AdmSubjectInfo subject) {
    return CustomCard(
      onTap: () => onSelectSubject(subject),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(Icons.school, color: AppColors.primaryEmerald, size: 22),
              Icon(Icons.arrow_forward, color: AppColors.textMuted, size: 14),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            subject.title,
            style: GoogleFonts.inter(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
          ),
          Text(
            subject.section,
            style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
          ),
          const SizedBox(height: 6),
          Text(
            '${subject.modulesCount} • ${subject.studentsCount}',
            style: GoogleFonts.inter(
              color: AppColors.primaryEmerald,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
          ),
          const SizedBox(height: 6),
          const Row(
            children: [
              Expanded(
                child: Text(
                  'Open Classroom',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              ),
              SizedBox(width: 2),
              Icon(Icons.chevron_right, size: 12, color: AppColors.textSecondary),
            ],
          ),
        ],
      ),
    );
  }
}
