import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../data/models/grade_model.dart';
import '../../../data/models/student_model.dart';
import '../../../data/repositories/grades_repository.dart';
import '../../../providers/grades_provider.dart';
import '../../shared/widgets/custom_card.dart';
import '../../shared/widgets/status_badge.dart';

enum AssessmentCategoryType {
  ww('WW', 'Oral / Written Works (WWs)', ComponentType.WRITTEN_WORK),
  pt('PT', 'Product / Performance Task (PTs)', ComponentType.PERFORMANCE_TASK),
  st('ST', 'Summative Test (ST)', ComponentType.WRITTEN_WORK),
  te('TE', 'Term Exam (TE)', ComponentType.QUARTERLY_EXAM);

  final String prefix;
  final String label;
  final ComponentType componentType;

  const AssessmentCategoryType(this.prefix, this.label, this.componentType);
}

class GradeMatrixSpreadsheet extends ConsumerWidget {
  const GradeMatrixSpreadsheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gradesAsync = ref.watch(gradesProvider);
    final gradesNotifier = ref.read(gradesProvider.notifier);

    return gradesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primaryEmerald)),
      error: (err, stack) => Center(child: Text('Error loading grade matrix: $err')),
      data: (matrixState) {
        final isLocked = matrixState.lockStatus != LockStatus.unlocked;

        return Column(
          children: [
            // Header Action Bar: Subject Info + Add Assessment + Lock Status
            CustomCard(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
                              'Mathematics G10 — Term 1',
                              style: GoogleFonts.inter(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Text(
                                  'Status: ',
                                  style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
                                ),
                                StatusBadge.lockStatus(matrixState.lockStatus),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (!isLocked) ...[
                        ElevatedButton.icon(
                          onPressed: () => _showAddAssessmentModal(context, matrixState.assessments, gradesNotifier),
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('+ Add'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primaryEmerald,
                            foregroundColor: const Color(0xFF0C1612),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            textStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const SizedBox(width: 6),
                        ElevatedButton.icon(
                          onPressed: () => _showLockConfirmationModal(context, ref),
                          icon: const Icon(Icons.lock_outline, size: 16),
                          label: const Text('Lock'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.riskHigh,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            textStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ] else
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.riskHigh.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: AppColors.riskHigh.withOpacity(0.4)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.lock, size: 14, color: AppColors.riskHigh),
                              const SizedBox(width: 4),
                              Text(
                                'LOCKED',
                                style: GoogleFonts.robotoMono(
                                  color: AppColors.riskHigh,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Horizontally Scrollable Grade Matrix Data Table
            Expanded(
              child: CustomCard(
                padding: EdgeInsets.zero,
                child: SingleChildScrollView(
                  scrollDirection: Axis.vertical,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      headingRowColor: WidgetStateProperty.all(AppColors.surfaceElevated),
                      dataRowMinHeight: 44,
                      dataRowMaxHeight: 48,
                      columnSpacing: 18,
                      horizontalMargin: 12,
                      border: const TableBorder(
                        horizontalInside: BorderSide(color: AppColors.borderSubtle, width: 1),
                        verticalInside: BorderSide(color: AppColors.borderSubtle, width: 1),
                      ),
                      columns: [
                        DataColumn(
                          label: Text(
                            'STUDENT NAME',
                            style: GoogleFonts.inter(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        ...matrixState.assessments.map((asm) => DataColumn(
                              label: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    asm.title,
                                    style: GoogleFonts.inter(
                                      color: AppColors.textPrimary,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    'Max: ${asm.maxScore.toInt()}',
                                    style: GoogleFonts.robotoMono(
                                      color: AppColors.primaryEmerald,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ),
                            )),
                        DataColumn(
                          label: Text(
                            'RAW AVG %',
                            style: GoogleFonts.inter(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        DataColumn(
                          label: Text(
                            'TRANSMUTED',
                            style: GoogleFonts.inter(
                              color: AppColors.primaryEmerald,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                      rows: matrixState.students.map((student) {
                        double totalPercentSum = 0;
                        int count = 0;

                        final scoreCells = matrixState.assessments.map((asm) {
                          final key = '${student.id}_${asm.id}';
                          final currentScore = matrixState.rawScores[key] ?? 0.0;
                          final scorePercent = (currentScore / asm.maxScore) * 100.0;

                          totalPercentSum += scorePercent;
                          count++;

                          return DataCell(
                            GestureDetector(
                              onTap: isLocked
                                  ? null
                                  : () => _editScoreDialog(context, student, asm, currentScore, gradesNotifier),
                              child: Container(
                                alignment: Alignment.center,
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isLocked ? Colors.transparent : AppColors.surfaceElevated,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  currentScore.toStringAsFixed(1),
                                  style: AppTheme.mono(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList();

                        final avgPercentage = count > 0 ? (totalPercentSum / count) : 0.0;
                        final transmutedGrade = MockGradesRepository.computeDepEdTransmutedGrade(avgPercentage);
                        final isPassing = transmutedGrade >= 75.0;

                        return DataRow(
                          cells: [
                            DataCell(
                              Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    student.fullName,
                                    style: GoogleFonts.inter(
                                      color: AppColors.textPrimary,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                  Text(
                                    student.lrn,
                                    style: GoogleFonts.robotoMono(
                                      color: AppColors.textMuted,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            ...scoreCells,
                            DataCell(
                              Text(
                                '${avgPercentage.toStringAsFixed(1)}%',
                                style: AppTheme.mono(color: AppColors.textSecondary, fontSize: 12),
                              ),
                            ),
                            DataCell(
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: (isPassing ? AppColors.primaryEmerald : AppColors.riskHigh).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(
                                    color: (isPassing ? AppColors.primaryEmerald : AppColors.riskHigh).withOpacity(0.4),
                                  ),
                                ),
                                child: Text(
                                  transmutedGrade.toInt().toString(),
                                  style: AppTheme.mono(
                                    color: isPassing ? AppColors.primaryEmerald : AppColors.riskHigh,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Add Assessment Modal with Auto Increment Logic
  // ---------------------------------------------------------------------------
  void _showAddAssessmentModal(
    BuildContext context,
    List<AssessmentModel> existingAssessments,
    GradesNotifier notifier,
  ) {
    AssessmentCategoryType selectedCategory = AssessmentCategoryType.ww;

    String computeAutoIncrementTitle(AssessmentCategoryType category) {
      int maxNum = 0;
      for (final asm in existingAssessments) {
        final titleUpper = asm.title.toUpperCase();
        if (titleUpper.startsWith(category.prefix)) {
          final match = RegExp('^${category.prefix}\\s*(\\d+)').firstMatch(titleUpper);
          if (match != null) {
            final num = int.tryParse(match.group(1) ?? '0') ?? 0;
            if (num > maxNum) maxNum = num;
          } else {
            if (maxNum == 0) maxNum = 1;
          }
        }
      }
      return '${category.prefix}${maxNum + 1}';
    }

    final titleController = TextEditingController(text: computeAutoIncrementTitle(selectedCategory));
    final maxScoreController = TextEditingController(text: '50');

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
                        'Add New Assessment Column',
                        style: GoogleFonts.inter(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.textMuted),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Category Selector Options
                  Text(
                    'Assessment Category',
                    style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 6),

                  Column(
                    children: AssessmentCategoryType.values.map((cat) {
                      final isSelected = selectedCategory == cat;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primaryEmerald.withOpacity(0.12) : AppColors.surfaceCard,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isSelected ? AppColors.primaryEmerald : AppColors.borderSubtle,
                          ),
                        ),
                        child: RadioListTile<AssessmentCategoryType>(
                          value: cat,
                          groupValue: selectedCategory,
                          activeColor: AppColors.primaryEmerald,
                          dense: true,
                          title: Text(
                            cat.label,
                            style: GoogleFonts.inter(
                              color: isSelected ? AppColors.primaryEmerald : AppColors.textPrimary,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                              fontSize: 13,
                            ),
                          ),
                          onChanged: (val) {
                            if (val != null) {
                              setModalState(() {
                                selectedCategory = val;
                                titleController.text = computeAutoIncrementTitle(val);
                              });
                            }
                          },
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 12),

                  // Auto-Incremented Title Input
                  Text(
                    'Assessment Title (Auto-Incremented)',
                    style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    controller: titleController,
                    style: GoogleFonts.robotoMono(color: AppColors.textPrimary, fontSize: 14),
                    decoration: const InputDecoration(
                      hintText: 'e.g. WW3, PT2, ST1, TE1',
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Max Score Input
                  Text(
                    'Highest Possible / Max Score',
                    style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    controller: maxScoreController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: GoogleFonts.robotoMono(color: AppColors.textPrimary, fontSize: 14),
                    decoration: const InputDecoration(
                      hintText: 'e.g. 50',
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Add Button
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: ElevatedButton(
                      onPressed: () {
                        final title = titleController.text.trim();
                        final maxScore = double.tryParse(maxScoreController.text.trim());

                        if (title.isNotEmpty && maxScore != null && maxScore > 0) {
                          final newAsm = AssessmentModel(
                            id: 'asm_${DateTime.now().millisecondsSinceEpoch}',
                            title: title,
                            componentType: selectedCategory.componentType,
                            maxScore: maxScore,
                            dateGiven: DateTime.now(),
                          );

                          notifier.addAssessment(newAsm);
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              backgroundColor: AppColors.surfaceElevated,
                              content: Text(
                                'Added $title (Max: ${maxScore.toInt()}) to grade matrix.',
                                style: GoogleFonts.inter(color: AppColors.primaryEmerald),
                              ),
                            ),
                          );
                        }
                      },
                      child: Text(
                        'Add Assessment Column',
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

  void _editScoreDialog(
    BuildContext context,
    StudentModel student,
    AssessmentModel assessment,
    double currentScore,
    GradesNotifier notifier,
  ) {
    final controller = TextEditingController(text: currentScore.toStringAsFixed(1));

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.surfaceDark,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(6),
            side: const BorderSide(color: AppColors.borderSubtle),
          ),
          title: Text(
            'Edit Score: ${student.fullName}',
            style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Assessment: ${assessment.title} (Max: ${assessment.maxScore.toInt()})',
                style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                autofocus: true,
                style: GoogleFonts.robotoMono(color: AppColors.textPrimary, fontSize: 16),
                decoration: const InputDecoration(
                  labelText: 'Raw Score',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel', style: GoogleFonts.inter(color: AppColors.textMuted)),
            ),
            ElevatedButton(
              onPressed: () {
                final score = double.tryParse(controller.text);
                if (score != null && score >= 0 && score <= assessment.maxScore) {
                  notifier.updateScore(student.id, assessment.id, score);
                  Navigator.of(context).pop();
                }
              },
              child: const Text('Save Score'),
            ),
          ],
        );
      },
    );
  }

  void _showLockConfirmationModal(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.surfaceDark,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(6),
            side: const BorderSide(color: AppColors.riskHigh),
          ),
          title: Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: AppColors.riskHigh),
              const SizedBox(width: 8),
              Text(
                'Lock Mathematics Grades?',
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: Text(
            'Locking grades prevents further local edits and submits the final transmuted grades to the Registrar & Adviser for approval. An outbox sync notification will be queued.',
            style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel', style: GoogleFonts.inter(color: AppColors.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.riskHigh, foregroundColor: Colors.white),
              onPressed: () {
                ref.read(gradesProvider.notifier).lockGrades('sec_g10_emerald', 'sub_math');
                Navigator.of(context).pop();
              },
              child: const Text('Confirm Lock'),
            ),
          ],
        );
      },
    );
  }
}
