import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../app/theme/app_theme.dart';
import '../../data/models/grade_model.dart';
import '../../data/repositories/grades_repository.dart';
import '../../providers/grades_provider.dart';
import 'widgets/grade_matrix_spreadsheet.dart';
import '../shared/widgets/custom_card.dart';

class AssessmentScoreEntryScreen extends ConsumerStatefulWidget {
  final AssessmentModel assessment;
  final AssessmentCategoryType category;

  const AssessmentScoreEntryScreen({
    super.key,
    required this.assessment,
    required this.category,
  });

  @override
  ConsumerState<AssessmentScoreEntryScreen> createState() => _AssessmentScoreEntryScreenState();
}

class _AssessmentScoreEntryScreenState extends ConsumerState<AssessmentScoreEntryScreen> {
  final Map<String, TextEditingController> _controllers = {};
  final Map<String, double> _scores = {};
  bool _initialized = false;

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _initScores(GradeMatrixState matrixState) {
    if (_initialized) return;
    _initialized = true;

    for (final student in matrixState.students) {
      final key = '${student.id}_${widget.assessment.id}';
      final initialScore = matrixState.rawScores[key] ?? (widget.assessment.maxScore * 0.8);
      _scores[student.id] = initialScore;
      _controllers[student.id] = TextEditingController(text: initialScore.toStringAsFixed(1));
    }
  }

  void _updateAllScores(double value) {
    setState(() {
      for (final key in _scores.keys) {
        final clampedValue = value.clamp(0.0, widget.assessment.maxScore);
        _scores[key] = clampedValue;
        _controllers[key]?.text = clampedValue.toStringAsFixed(1);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final gradesAsync = ref.watch(gradesProvider);

    return Scaffold(
      backgroundColor: AppColors.surfaceDark,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Score Entry: ${widget.assessment.title}',
          style: GoogleFonts.inter(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 14),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: widget.category.accentColor.withOpacity(0.18),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: widget.category.accentColor.withOpacity(0.5)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.assignment, size: 14, color: widget.category.accentColor),
                const SizedBox(width: 4),
                Text(
                  '${widget.category.label} (${widget.category.prefix})',
                  style: GoogleFonts.inter(
                    color: widget.category.accentColor,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: gradesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primaryEmerald)),
        error: (err, stack) => Center(child: Text('Error loading student roster: $err')),
        data: (matrixState) {
          _initScores(matrixState);
          final isLocked = matrixState.lockStatus != LockStatus.unlocked;

          return Column(
            children: [
              // Assessment Information Header Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.surfaceCard,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            'Mathematics G10 — Section Emerald',
                            style: GoogleFonts.inter(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
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
                            'Highest Possible Score: ${widget.assessment.maxScore.toInt()}',
                            style: GoogleFonts.robotoMono(
                              color: AppColors.primaryEmerald,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Quick Action Helper Bar
                    if (!isLocked) ...[
                      Row(
                        children: [
                          Text(
                            'Quick Fill:',
                            style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 11),
                          ),
                          const SizedBox(width: 8),
                          ActionChip(
                            label: Text(
                              'Fill Max (${widget.assessment.maxScore.toInt()})',
                              style: GoogleFonts.inter(fontSize: 10.5, fontWeight: FontWeight.w600),
                            ),
                            backgroundColor: AppColors.surfaceElevated,
                            side: const BorderSide(color: AppColors.borderSubtle),
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            onPressed: () => _updateAllScores(widget.assessment.maxScore),
                          ),
                          const SizedBox(width: 6),
                          ActionChip(
                            label: Text(
                              'Fill Passing (${(widget.assessment.maxScore * 0.6).toInt()})',
                              style: GoogleFonts.inter(fontSize: 10.5, fontWeight: FontWeight.w600),
                            ),
                            backgroundColor: AppColors.surfaceElevated,
                            side: const BorderSide(color: AppColors.borderSubtle),
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            onPressed: () => _updateAllScores(widget.assessment.maxScore * 0.6),
                          ),
                          const SizedBox(width: 6),
                          ActionChip(
                            label: Text(
                              'Clear All',
                              style: GoogleFonts.inter(fontSize: 10.5, color: AppColors.riskHigh, fontWeight: FontWeight.w600),
                            ),
                            backgroundColor: AppColors.surfaceElevated,
                            side: BorderSide(color: AppColors.riskHigh.withOpacity(0.5)),
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            onPressed: () => _updateAllScores(0.0),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),

              // Student Roster Score Entry List
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  itemCount: matrixState.students.length,
                  itemBuilder: (context, index) {
                    final student = matrixState.students[index];
                    final currentScore = _scores[student.id] ?? 0.0;
                    final controller = _controllers[student.id];

                    final scorePercent = (currentScore / widget.assessment.maxScore) * 100.0;
                    final transmuted = MockGradesRepository.computeDepEdTransmutedGrade(scorePercent).toInt();
                    final isPassing = transmuted >= 75;

                    final nameParts = student.fullName.split(' ');
                    final initials = nameParts.length >= 2
                        ? '${nameParts[0][0]}${nameParts[1][0]}'
                        : student.fullName.substring(0, 2).toUpperCase();

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: CustomCard(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                        children: [
                          // Avatar Initials
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: widget.category.accentColor.withOpacity(0.2),
                            child: Text(
                              initials,
                              style: GoogleFonts.inter(
                                color: widget.category.accentColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),

                          // Student Information
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  student.fullName,
                                  style: GoogleFonts.inter(
                                    color: AppColors.textPrimary,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13.5,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'LRN: ${student.lrn}',
                                  style: GoogleFonts.robotoMono(
                                    color: AppColors.textMuted,
                                    fontSize: 10,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Live Computed Percentage & Transmuted Grade Pill
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '${scorePercent.toStringAsFixed(1)}%',
                                style: AppTheme.mono(color: AppColors.textSecondary, fontSize: 11),
                              ),
                              const SizedBox(height: 2),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: (isPassing ? AppColors.primaryEmerald : AppColors.riskHigh).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(
                                    color: (isPassing ? AppColors.primaryEmerald : AppColors.riskHigh).withOpacity(0.4),
                                  ),
                                ),
                                child: Text(
                                  'Transmuted: $transmuted',
                                  style: AppTheme.mono(
                                    color: isPassing ? AppColors.primaryEmerald : AppColors.riskHigh,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 12),

                          // Score Input Field
                          SizedBox(
                            width: 80,
                            child: TextField(
                              controller: controller,
                              enabled: !isLocked,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              textAlign: TextAlign.center,
                              style: AppTheme.mono(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                              decoration: InputDecoration(
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                hintText: '0.0',
                                suffixText: '/${widget.assessment.maxScore.toInt()}',
                                suffixStyle: GoogleFonts.robotoMono(fontSize: 9, color: AppColors.textMuted),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(6),
                                  borderSide: const BorderSide(color: AppColors.borderSubtle),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(6),
                                  borderSide: const BorderSide(color: AppColors.primaryEmerald),
                                ),
                              ),
                              onChanged: (text) {
                                final parsed = double.tryParse(text) ?? 0.0;
                                final clamped = parsed.clamp(0.0, widget.assessment.maxScore);
                                setState(() {
                                  _scores[student.id] = clamped;
                                });
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              ),

              // Bottom Sticky Action Bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  color: AppColors.surfaceCard,
                  border: Border(
                    top: BorderSide(color: AppColors.borderSubtle),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textMuted,
                          side: const BorderSide(color: AppColors.borderSubtle),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: Text(
                          'Cancel',
                          style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.check_circle_outline, size: 18),
                        label: Text(
                          'Save All Scores (${_scores.length} Students)',
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primaryEmerald,
                          foregroundColor: const Color(0xFF0C1612),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: isLocked
                            ? null
                            : () async {
                                final notifier = ref.read(gradesProvider.notifier);
                                await notifier.batchUpdateScores(widget.assessment.id, _scores);
                                if (context.mounted) {
                                  Navigator.pop(context);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      backgroundColor: AppColors.surfaceElevated,
                                      content: Text(
                                        'Saved scores for ${widget.assessment.title} across ${_scores.length} students.',
                                        style: GoogleFonts.inter(color: AppColors.primaryEmerald),
                                      ),
                                    ),
                                  );
                                }
                              },
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
