import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../providers/sync_provider.dart';

class DevOfflineDrawer extends ConsumerWidget {
  const DevOfflineDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final syncState = ref.watch(syncProvider);
    final syncNotifier = ref.read(syncProvider.notifier);

    return Drawer(
      backgroundColor: AppColors.surfaceDark,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Offline & Sync Debugger',
                    style: GoogleFonts.inter(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textMuted),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeColor: AppColors.primaryEmerald,
                title: Text(
                  'Network Connection',
                  style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 14),
                ),
                subtitle: Text(
                  syncState.isOnline ? 'ONLINE (Direct Dio API Requests)' : 'OFFLINE (Outbox Queue Active)',
                  style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
                ),
                value: syncState.isOnline,
                onChanged: (_) => syncNotifier.toggleOnlineStatus(),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Pending Outbox Queue (${syncState.pendingQueue.length})',
                    style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  if (syncState.pendingQueue.isNotEmpty && syncState.isOnline)
                    TextButton(
                      onPressed: () => syncNotifier.flushOutboxQueue(),
                      child: Text(
                        'Flush Queue',
                        style: GoogleFonts.inter(color: AppColors.primaryEmerald, fontSize: 12),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Expanded(
                child: syncState.pendingQueue.isEmpty
                    ? Center(
                        child: Text(
                          'No pending outbox mutations.',
                          style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 13),
                        ),
                      )
                    : ListView.builder(
                        itemCount: syncState.pendingQueue.length,
                        itemBuilder: (context, index) {
                          final item = syncState.pendingQueue[index];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceElevated,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: AppColors.borderSubtle),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppColors.primaryEmerald.withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        item.method,
                                        style: GoogleFonts.robotoMono(
                                          color: AppColors.primaryEmerald,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        item.endpoint,
                                        style: GoogleFonts.robotoMono(
                                          color: AppColors.textPrimary,
                                          fontSize: 11,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  item.payload.toString(),
                                  style: GoogleFonts.robotoMono(
                                    color: AppColors.textMuted,
                                    fontSize: 10,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              if (syncState.lastSyncMessage != null) ...[
                const Divider(),
                const SizedBox(height: 8),
                Text(
                  syncState.lastSyncMessage!,
                  style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 11),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
