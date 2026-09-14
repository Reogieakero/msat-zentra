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

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 105.0),
        child: FloatingActionButton(
          onPressed: () => _showAddIncidentModal(context, ref),
          backgroundColor: AppColors.primaryEmerald,
          foregroundColor: const Color(0xFF0C1612),
          shape: const CircleBorder(),
          elevation: 6,
          tooltip: 'Log Incident',
          child: const Icon(Icons.add, size: 26),
        ),
      ),
      body: Column(
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
    ),
  );
}

  void _showAddIncidentModal(BuildContext context, WidgetRef ref) {
    String selectedStudentId = MockData.students.first.id;
    AnecdotalCategory selectedCategory = AnecdotalCategory.behavioral;
    final controller = TextEditingController();

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
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Log Anecdotal Incident',
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

                    // Select Student
                    Text(
                      'Select Student',
                      style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String>(
                      value: selectedStudentId,
                      dropdownColor: AppColors.surfaceElevated,
                      style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 14),
                      decoration: const InputDecoration(
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: MockData.students.map((s) {
                        return DropdownMenuItem(
                          value: s.id,
                          child: Text(s.fullName, style: GoogleFonts.inter(color: AppColors.textPrimary)),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() => selectedStudentId = val);
                        }
                      },
                    ),
                    const SizedBox(height: 12),

                    // Incident Category Radio Options
                    Text(
                      'Incident Category',
                      style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 6),

                    Column(
                      children: AnecdotalCategory.values.map((cat) {
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
                          child: RadioListTile<AnecdotalCategory>(
                            value: cat,
                            groupValue: selectedCategory,
                            activeColor: AppColors.primaryEmerald,
                            dense: true,
                            title: Text(
                              cat.name.toUpperCase(),
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
                                });
                              }
                            },
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 12),

                    // Incident Description Input
                    Text(
                      'Incident Description',
                      style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    TextField(
                      controller: controller,
                      maxLines: 3,
                      style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13),
                      decoration: const InputDecoration(
                        hintText: 'Enter observation notes, location, or intervention details...',
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Full-width Action Button
                    SizedBox(
                      width: double.infinity,
                      height: 44,
                      child: ElevatedButton(
                        onPressed: () {
                          final desc = controller.text.trim();
                          if (desc.isNotEmpty) {
                            final student = MockData.students.firstWhere((s) => s.id == selectedStudentId);
                            final newRecord = AnecdotalRecordModel(
                              id: 'anec_${DateTime.now().millisecondsSinceEpoch}',
                              studentId: student.id,
                              studentName: student.fullName,
                              observerName: 'Maria Santos',
                              sectionName: student.sectionName,
                              category: selectedCategory,
                              incidentDescription: desc,
                              observationDatetime: DateTime.now(),
                            );

                            ref.read(anecdotalProvider.notifier).addRecord(newRecord);
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                backgroundColor: AppColors.surfaceElevated,
                                content: Text(
                                  'Incident logged for ${student.fullName}.',
                                  style: GoogleFonts.inter(color: AppColors.primaryEmerald),
                                ),
                              ),
                            );
                          }
                        },
                        child: Text(
                          'Log Anecdotal Incident',
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
