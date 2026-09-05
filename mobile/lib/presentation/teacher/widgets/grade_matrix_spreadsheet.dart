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

enum GradeSortOption {
  nameAsc('Name (A – Z)', Icons.sort_by_alpha),
  nameDesc('Name (Z – A)', Icons.sort_by_alpha),
  transmutedDesc('Transmuted (High to Low)', Icons.arrow_downward),
  transmutedAsc('Transmuted (Low to High)', Icons.arrow_upward),
  rawAvgDesc('Raw Avg (High to Low)', Icons.trending_down),
  rawAvgAsc('Raw Avg (Low to High)', Icons.trending_up);

  final String label;
  final IconData icon;
  const GradeSortOption(this.label, this.icon);
}

class StudentRowData {
  final StudentModel student;
  final double rawAvgPercentage;
  final int transmutedGrade;
  final List<double> scoreList;

  StudentRowData({
    required this.student,
    required this.rawAvgPercentage,
    required this.transmutedGrade,
    required this.scoreList,
  });
}

class GradeMatrixSpreadsheet extends ConsumerStatefulWidget {
  const GradeMatrixSpreadsheet({super.key});

  @override
  ConsumerState<GradeMatrixSpreadsheet> createState() => _GradeMatrixSpreadsheetState();
}

class _GradeMatrixSpreadsheetState extends ConsumerState<GradeMatrixSpreadsheet> {
  GradeSortOption _sortOption = GradeSortOption.nameAsc;
  final ScrollController _verticalScrollController = ScrollController();

  @override
  void dispose() {
    _verticalScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gradesAsync = ref.watch(gradesProvider);
    final gradesNotifier = ref.read(gradesProvider.notifier);

    return gradesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primaryEmerald)),
      error: (err, stack) => Center(child: Text('Error loading grade matrix: $err')),
      data: (matrixState) {
        final isLocked = matrixState.lockStatus != LockStatus.unlocked;

        // Build & Sort Student Row Data
        final studentRows = matrixState.students.map((student) {
          double totalPercentSum = 0;
          int count = 0;
          final List<double> scores = [];

          for (final asm in matrixState.assessments) {
            final key = '${student.id}_${asm.id}';
            final currentScore = matrixState.rawScores[key] ?? 0.0;
            final scorePercent = (currentScore / asm.maxScore) * 100.0;

            totalPercentSum += scorePercent;
            count++;
            scores.add(currentScore);
          }

          final avgPercent = count > 0 ? (totalPercentSum / count) : 0.0;
          final transmuted = MockGradesRepository.computeDepEdTransmutedGrade(avgPercent).toInt();

          return StudentRowData(
            student: student,
            rawAvgPercentage: avgPercent,
            transmutedGrade: transmuted,
            scoreList: scores,
          );
        }).toList();

        // Apply selected sort option
        studentRows.sort((a, b) {
          switch (_sortOption) {
            case GradeSortOption.nameAsc:
              return a.student.fullName.compareTo(b.student.fullName);
            case GradeSortOption.nameDesc:
              return b.student.fullName.compareTo(a.student.fullName);
            case GradeSortOption.transmutedDesc:
              return b.transmutedGrade.compareTo(a.transmutedGrade);
            case GradeSortOption.transmutedAsc:
              return a.transmutedGrade.compareTo(b.transmutedGrade);
            case GradeSortOption.rawAvgDesc:
              return b.rawAvgPercentage.compareTo(a.rawAvgPercentage);
            case GradeSortOption.rawAvgAsc:
              return a.rawAvgPercentage.compareTo(b.rawAvgPercentage);
          }
        });

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
                      const SizedBox(width: 6),
                      if (!isLocked) ...[
                        ElevatedButton.icon(
                          onPressed: () => _showAddAssessmentModal(context, matrixState.assessments, gradesNotifier),
                          icon: const Icon(Icons.add, size: 14),
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
                          icon: const Icon(Icons.lock_outline, size: 14),
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
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.riskHigh.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: AppColors.riskHigh.withOpacity(0.4)),
                          ),
                          child: Text(
                            'LOCKED',
                            style: GoogleFonts.robotoMono(
                              color: AppColors.riskHigh,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Sorting Selector Toolbar Pill
                  Row(
                    children: [
                      const Icon(Icons.sort, size: 16, color: AppColors.primaryEmerald),
                      const SizedBox(width: 6),
                      Text(
                        'Sort Matrix:',
                        style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: AppColors.borderSubtle),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<GradeSortOption>(
                              value: _sortOption,
                              isDense: true,
                              dropdownColor: AppColors.surfaceDark,
                              icon: const Icon(Icons.arrow_drop_down, color: AppColors.primaryEmerald),
                              style: GoogleFonts.robotoMono(
                                color: AppColors.primaryEmerald,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                              items: GradeSortOption.values.map((opt) {
                                return DropdownMenuItem<GradeSortOption>(
                                  value: opt,
                                  child: Row(
                                    children: [
                                      Icon(opt.icon, size: 14, color: AppColors.primaryEmerald),
                                      const SizedBox(width: 6),
                                      Text(opt.label),
                                    ],
                                  ),
                                );
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) setState(() => _sortOption = val);
                              },
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Two-Pane Sticky Column Data Grid Layout
            Expanded(
              child: CustomCard(
                padding: EdgeInsets.zero,
                child: SingleChildScrollView(
                  controller: _verticalScrollController,
                  scrollDirection: Axis.vertical,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 1. LEFT FIXED PANE (Sticky Student Name Column)
                      Container(
                        width: 145,
                        decoration: const BoxDecoration(
                          color: AppColors.surfaceCard,
                          border: Border(
                            right: BorderSide(color: AppColors.primaryEmerald, width: 1.5),
                          ),
                        ),
                        child: DataTable(
                          headingRowColor: WidgetStateProperty.all(AppColors.surfaceElevated),
                          dataRowMinHeight: 44,
                          dataRowMaxHeight: 48,
                          columnSpacing: 8,
                          horizontalMargin: 8,
                          border: const TableBorder(
                            horizontalInside: BorderSide(color: AppColors.borderSubtle, width: 1),
                          ),
                          columns: [
                            DataColumn(
                              onSort: (_, __) {
                                setState(() {
                                  _sortOption = _sortOption == GradeSortOption.nameAsc
                                      ? GradeSortOption.nameDesc
                                      : GradeSortOption.nameAsc;
                                });
                              },
                              label: Row(
                                children: [
                                  Text(
                                    'STUDENT NAME',
                                    style: GoogleFonts.inter(
                                      color: (_sortOption == GradeSortOption.nameAsc || _sortOption == GradeSortOption.nameDesc)
                                          ? AppColors.primaryEmerald
                                          : AppColors.textSecondary,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  if (_sortOption == GradeSortOption.nameAsc)
                                    const Icon(Icons.arrow_drop_up, size: 14, color: AppColors.primaryEmerald),
                                  if (_sortOption == GradeSortOption.nameDesc)
                                    const Icon(Icons.arrow_drop_down, size: 14, color: AppColors.primaryEmerald),
                                ],
                              ),
                            ),
                          ],
                          rows: studentRows.map((rowData) {
                            return DataRow(
                              cells: [
                                DataCell(
                                  Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        rowData.student.fullName,
                                        style: GoogleFonts.inter(
                                          color: AppColors.textPrimary,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 12,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        rowData.student.lrn,
                                        style: GoogleFonts.robotoMono(
                                          color: AppColors.textMuted,
                                          fontSize: 9,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            );
                          }).toList(),
                        ),
                      ),

                      // 2. RIGHT SCROLLABLE PANE (Horizontally Scrollable Assessment Score Columns)
                      Expanded(
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
                              // RAW AVG % Column
                              DataColumn(
                                onSort: (_, __) {
                                  setState(() {
                                    _sortOption = _sortOption == GradeSortOption.rawAvgDesc
                                        ? GradeSortOption.rawAvgAsc
                                        : GradeSortOption.rawAvgDesc;
                                  });
                                },
                                label: Row(
                                  children: [
                                    Text(
                                      'RAW AVG %',
                                      style: GoogleFonts.inter(
                                        color: (_sortOption == GradeSortOption.rawAvgDesc || _sortOption == GradeSortOption.rawAvgAsc)
                                            ? AppColors.primaryEmerald
                                            : AppColors.textSecondary,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    if (_sortOption == GradeSortOption.rawAvgAsc)
                                      const Icon(Icons.arrow_drop_up, size: 16, color: AppColors.primaryEmerald),
                                    if (_sortOption == GradeSortOption.rawAvgDesc)
                                      const Icon(Icons.arrow_drop_down, size: 16, color: AppColors.primaryEmerald),
                                  ],
                                ),
                              ),
                              // TRANSMUTED Column
                              DataColumn(
                                onSort: (_, __) {
                                  setState(() {
                                    _sortOption = _sortOption == GradeSortOption.transmutedDesc
                                        ? GradeSortOption.transmutedAsc
                                        : GradeSortOption.transmutedDesc;
                                  });
                                },
                                label: Row(
                                  children: [
                                    Text(
                                      'TRANSMUTED',
                                      style: GoogleFonts.inter(
                                        color: (_sortOption == GradeSortOption.transmutedDesc || _sortOption == GradeSortOption.transmutedAsc)
                                            ? AppColors.primaryEmerald
                                            : AppColors.textSecondary,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    if (_sortOption == GradeSortOption.transmutedAsc)
                                      const Icon(Icons.arrow_drop_up, size: 16, color: AppColors.primaryEmerald),
                                    if (_sortOption == GradeSortOption.transmutedDesc)
                                      const Icon(Icons.arrow_drop_down, size: 16, color: AppColors.primaryEmerald),
                                  ],
                                ),
                              ),
                            ],
                            rows: studentRows.map((rowData) {
                              final student = rowData.student;
                              final isPassing = rowData.transmutedGrade >= 75;

                              final scoreCells = matrixState.assessments.asMap().entries.map((entry) {
                                final idx = entry.key;
                                final asm = entry.value;
                                final currentScore = idx < rowData.scoreList.length ? rowData.scoreList[idx] : 0.0;

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

                              return DataRow(
                                cells: [
                                  ...scoreCells,
                                  DataCell(
                                    Text(
                                      '${rowData.rawAvgPercentage.toStringAsFixed(1)}%',
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
                                        '${rowData.transmutedGrade}',
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
                    ],
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
