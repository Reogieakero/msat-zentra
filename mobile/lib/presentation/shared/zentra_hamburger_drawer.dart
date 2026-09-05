import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../data/models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/sync_provider.dart';
import 'widgets/sync_status_pill.dart';

class ZentraHamburgerDrawer extends ConsumerWidget {
  const ZentraHamburgerDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userState = ref.watch(authProvider);
    final user = userState.value;
    final syncState = ref.watch(syncProvider);
    final syncNotifier = ref.read(syncProvider.notifier);

    return Drawer(
      backgroundColor: AppColors.surfaceDark,
      child: SafeArea(
        child: Column(
          children: [
            // Drawer User Profile Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: AppColors.surfaceElevated,
                border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 22,
                        backgroundColor: AppColors.primaryEmerald.withOpacity(0.2),
                        child: Text(
                          user?.fullName.isNotEmpty == true ? user!.fullName.substring(0, 1) : 'Z',
                          style: GoogleFonts.inter(
                            color: AppColors.primaryEmerald,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?.fullName ?? 'Zentra User',
                              style: GoogleFonts.inter(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              user?.email ?? '',
                              style: GoogleFonts.robotoMono(
                                color: AppColors.textMuted,
                                fontSize: 11,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // User Role Badge & Sync Status Pill below role
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primaryEmerald.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppColors.primaryEmerald.withOpacity(0.4)),
                        ),
                        child: Text(
                          user != null ? user.role.displayName : 'Account',
                          style: GoogleFonts.robotoMono(
                            color: AppColors.primaryEmerald,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Network / Sync Status Pill directly below user role in hamburger menu
                      const SyncStatusPill(),
                    ],
                  ),
                ],
              ),
            ),

            // Settings & Tools List
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  ListTile(
                    leading: const Icon(Icons.person_outline, color: AppColors.textSecondary, size: 20),
                    title: Text(
                      'Account Settings',
                      style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13),
                    ),
                    onTap: () {
                      Navigator.pop(context);
                      _showSettingsModal(context);
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.sync_alt, color: AppColors.textSecondary, size: 20),
                    title: Text(
                      'Sync & Outbox Terminal',
                      style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13),
                    ),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: (syncState.isOnline ? AppColors.primaryEmerald : AppColors.riskModerate).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        syncState.isOnline ? 'ONLINE' : 'OFFLINE',
                        style: GoogleFonts.robotoMono(
                          color: syncState.isOnline ? AppColors.primaryEmerald : AppColors.riskModerate,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    onTap: () {
                      Navigator.pop(context);
                      _showOutboxTerminalModal(context, ref);
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.dark_mode_outlined, color: AppColors.textSecondary, size: 20),
                    title: Text(
                      'High-Density Aesthetic',
                      style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13),
                    ),
                    subtitle: Text(
                      'Supabase Slate `#1C1C1C` Active',
                      style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 10),
                    ),
                  ),
                  const Divider(color: AppColors.borderSubtle),
                  ListTile(
                    leading: const Icon(Icons.wifi_off, color: AppColors.textSecondary, size: 20),
                    title: Text(
                      'Simulate Connection Drop',
                      style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13),
                    ),
                    trailing: Switch(
                      activeColor: AppColors.primaryEmerald,
                      value: !syncState.isOnline,
                      onChanged: (_) {
                        syncNotifier.toggleOnlineStatus();
                      },
                    ),
                  ),
                ],
              ),
            ),

            // Logout Footer Button
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.borderSubtle)),
              ),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.riskHigh,
                    side: const BorderSide(color: AppColors.riskHigh),
                  ),
                  icon: const Icon(Icons.logout, size: 18),
                  label: const Text('Sign Out'),
                  onPressed: () {
                    Navigator.pop(context);
                    ref.read(authProvider.notifier).logout();
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSettingsModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Profile & Account Settings',
                style: GoogleFonts.inter(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 12),
              Text(
                'Mati School of Arts and Trades — Student Information & Management System',
                style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Close Settings'),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showOutboxTerminalModal(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
      ),
      builder: (context) {
        return Consumer(
          builder: (context, ref, _) {
            final syncState = ref.watch(syncProvider);
            return Container(
              height: MediaQuery.of(context).size.height * 0.6,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Hive Outbox Sync Terminal',
                        style: GoogleFonts.robotoMono(
                          color: AppColors.primaryEmerald,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.textMuted),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                  const Divider(),
                  Expanded(
                    child: syncState.pendingQueue.isEmpty
                        ? Center(
                            child: Text(
                              '[10:42 AM] Outbox clean. 0 pending offline syncs.',
                              style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 12),
                            ),
                          )
                        : ListView.builder(
                            itemCount: syncState.pendingQueue.length,
                            itemBuilder: (context, index) {
                              final item = syncState.pendingQueue[index];
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                child: Text(
                                  '[${item.timestamp.hour}:${item.timestamp.minute}] ${item.method} ${item.endpoint} -> ${item.payload}',
                                  style: GoogleFonts.robotoMono(color: AppColors.primaryEmerald, fontSize: 11),
                                ),
                              );
                            },
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
}
