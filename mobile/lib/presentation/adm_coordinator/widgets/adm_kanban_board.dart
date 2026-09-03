import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../../data/models/adm_model.dart';
import '../../../providers/adm_provider.dart';
import '../../shared/widgets/custom_card.dart';

class AdmKanbanBoard extends ConsumerWidget {
  const AdmKanbanBoard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final admAsync = ref.watch(admProvider);
    final admNotifier = ref.read(admProvider.notifier);

    return admAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primaryEmerald)),
      error: (err, stack) => Center(child: Text('Error: $err')),
      data: (admState) {
        return Column(
          children: [
            CustomCard(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Text(
                    'DepEd ADM Pipeline (8 Stages)',
                    style: GoogleFonts.inter(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${admState.learners.length} Active Cases',
                    style: GoogleFonts.robotoMono(
                      color: AppColors.primaryEmerald,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView.separated(
                itemCount: admState.learners.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final learner = admState.learners[index];

                  return CustomCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              learner.studentName,
                              style: GoogleFonts.inter(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                              ),
                            ),
                            Text(
                              learner.sectionName,
                              style: GoogleFonts.robotoMono(
                                color: AppColors.textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'LRN: ${learner.lrn}',
                          style: GoogleFonts.robotoMono(color: AppColors.textSecondary, fontSize: 11),
                        ),
                        const SizedBox(height: 12),
                        // 8-Stage Stepper Progress Line
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: AdmStage.values.map((stage) {
                              final isCurrent = learner.stage == stage;
                              final isPassed = stage.index < learner.stage.index;

                              Color stepColor = AppColors.surfaceElevated;
                              if (isCurrent) stepColor = AppColors.primaryEmerald;
                              if (isPassed) stepColor = AppColors.primaryEmerald.withOpacity(0.5);

                              return GestureDetector(
                                onTap: () => admNotifier.advanceStage(learner.id, stage),
                                child: Container(
                                  margin: const EdgeInsets.only(right: 6),
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: stepColor.withOpacity(isCurrent ? 0.2 : 0.1),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                      color: isCurrent ? AppColors.primaryEmerald : AppColors.borderSubtle,
                                      width: isCurrent ? 1.5 : 1,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Text(
                                        stage.displayName,
                                        style: GoogleFonts.robotoMono(
                                          color: isCurrent
                                              ? AppColors.primaryEmerald
                                              : (isPassed ? AppColors.textPrimary : AppColors.textMuted),
                                          fontSize: 10,
                                          fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            const Icon(Icons.menu_book, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              'Modules: ${learner.completedModulesCount}/${learner.completedModulesCount + learner.pendingModulesCount} Completed',
                              style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 11),
                            ),
                            const Spacer(),
                            if (learner.issuedDevice != null) ...[
                              const Icon(Icons.devices, size: 14, color: AppColors.primaryEmerald),
                              const SizedBox(width: 4),
                              Text(
                                learner.issuedDevice!,
                                style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 11),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
