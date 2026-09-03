import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../../data/mock/mock_data.dart';
import '../../../data/models/anecdotal_model.dart';
import '../../../providers/anecdotal_provider.dart';
import '../../shared/widgets/custom_card.dart';

class AnecdotalLoggerView extends ConsumerWidget {
  const AnecdotalLoggerView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final anecdotalAsync = ref.watch(anecdotalProvider);

    return Column(
      children: [
        CustomCard(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Behavioral & Anecdotal Logs',
                style: GoogleFonts.inter(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              ElevatedButton.icon(
                onPressed: () => _showAddIncidentModal(context, ref),
                icon: const Icon(Icons.add_comment, size: 16),
                label: const Text('Log Incident'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  textStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: anecdotalAsync.when(
            loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primaryEmerald)),
            error: (err, stack) => Center(child: Text('Error: $err')),
            data: (records) {
              return ListView.separated(
                itemCount: records.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final record = records[index];
                  return CustomCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              record.studentName,
                              style: GoogleFonts.inter(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.riskModerate.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: AppColors.riskModerate.withOpacity(0.4)),
                              ),
                              child: Text(
                                record.category.name.toUpperCase(),
                                style: GoogleFonts.robotoMono(
                                  color: AppColors.riskModerate,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          record.incidentDescription,
                          style: GoogleFonts.inter(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Text(
                              'Observer: ${record.observerName}',
                              style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
                            ),
                            const Spacer(),
                            Text(
                              'Section: ${record.sectionName}',
                              style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  void _showAddIncidentModal(BuildContext context, WidgetRef ref) {
    String selectedStudentId = MockData.students.first.id;
    AnecdotalCategory selectedCategory = AnecdotalCategory.behavioral;
    final controller = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              backgroundColor: AppColors.surfaceDark,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(6),
                side: const BorderSide(color: AppColors.borderSubtle),
              ),
              title: Text(
                'Log Anecdotal Incident',
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DropdownButtonFormField<String>(
                    value: selectedStudentId,
                    dropdownColor: AppColors.surfaceElevated,
                    decoration: const InputDecoration(labelText: 'Select Student'),
                    items: MockData.students.map((s) {
                      return DropdownMenuItem(
                        value: s.id,
                        child: Text(s.fullName, style: GoogleFonts.inter(color: AppColors.textPrimary)),
                      );
                    }).toList(),
                    onChanged: (val) => setState(() => selectedStudentId = val!),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<AnecdotalCategory>(
                    value: selectedCategory,
                    dropdownColor: AppColors.surfaceElevated,
                    decoration: const InputDecoration(labelText: 'Category'),
                    items: AnecdotalCategory.values.map((c) {
                      return DropdownMenuItem(
                        value: c,
                        child: Text(c.name.toUpperCase(), style: GoogleFonts.inter(color: AppColors.textPrimary)),
                      );
                    }).toList(),
                    onChanged: (val) => setState(() => selectedCategory = val!),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    maxLines: 3,
                    style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'Incident Description',
                      hintText: 'Enter observation notes, location, or intervention details...',
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
                    if (controller.text.trim().isNotEmpty) {
                      final student = MockData.students.firstWhere((s) => s.id == selectedStudentId);
                      final newRecord = AnecdotalRecordModel(
                        id: 'anec_${DateTime.now().millisecondsSinceEpoch}',
                        studentId: student.id,
                        studentName: student.fullName,
                        observerName: 'Maria Santos',
                        sectionName: student.sectionName,
                        category: selectedCategory,
                        incidentDescription: controller.text.trim(),
                        observationDatetime: DateTime.now(),
                      );

                      ref.read(anecdotalProvider.notifier).addRecord(newRecord);
                      Navigator.of(context).pop();
                    }
                  },
                  child: const Text('Save Record'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
