import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../../providers/adm_provider.dart';
import '../../shared/widgets/custom_card.dart';

class AdmDeviceTracker extends ConsumerWidget {
  const AdmDeviceTracker({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final admAsync = ref.watch(admProvider);

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
                    'Issued Learning Devices',
                    style: GoogleFonts.inter(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${admState.devices.length} Devices Active',
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
                itemCount: admState.devices.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final device = admState.devices[index];

                  return CustomCard(
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.primaryEmerald.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Icon(Icons.tablet_mac, color: AppColors.primaryEmerald),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                device.deviceType,
                                style: GoogleFonts.inter(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Issued to: ${device.studentName}',
                                style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 12),
                              ),
                              Text(
                                'Serial: ${device.deviceSerial}',
                                style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: (device.isReturned ? AppColors.riskLow : AppColors.riskModerate).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color: (device.isReturned ? AppColors.riskLow : AppColors.riskModerate).withOpacity(0.4),
                            ),
                          ),
                          child: Text(
                            device.isReturned ? 'RETURNED' : 'IN USE',
                            style: GoogleFonts.robotoMono(
                              color: device.isReturned ? AppColors.riskLow : AppColors.riskModerate,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
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
