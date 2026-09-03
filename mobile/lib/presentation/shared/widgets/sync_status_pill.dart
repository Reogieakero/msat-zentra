import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/constants/app_colors.dart';
import '../../../providers/sync_provider.dart';

class SyncStatusPill extends ConsumerWidget {
  const SyncStatusPill({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final syncState = ref.watch(syncProvider);

    final isOnline = syncState.isOnline;
    final pendingCount = syncState.pendingQueue.length;
    final isSyncing = syncState.isSyncing;

    Color color;
    String text;

    if (isSyncing) {
      color = AppColors.primaryEmerald;
      text = 'Syncing...';
    } else if (!isOnline) {
      color = AppColors.riskModerate;
      text = 'Offline ($pendingCount pending)';
    } else if (pendingCount > 0) {
      color = AppColors.primaryEmerald;
      text = '$pendingCount pending';
    } else {
      color = AppColors.primaryEmerald;
      text = 'Online';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.4), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            text,
            style: GoogleFonts.robotoMono(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
