import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import 'widgets/custom_card.dart';

class NotificationItem {
  final String id;
  final String title;
  final String message;
  final String timestamp;
  final String category; // 'Attendance', 'Classwork', 'Incidents', 'System'
  final IconData icon;
  final Color iconColor;
  bool isRead;

  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.timestamp,
    required this.category,
    required this.icon,
    required this.iconColor,
    this.isRead = false,
  });
}

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  String _selectedCategory = 'All';

  final List<NotificationItem> _notifications = [
    NotificationItem(
      id: 'notif_1',
      title: 'Attendance Completed',
      message: 'Morning attendance for Grade 10 - Emerald has been marked and synced.',
      timestamp: '5 mins ago',
      category: 'Attendance',
      icon: Icons.event_available,
      iconColor: AppColors.attendancePresent,
      isRead: false,
    ),
    NotificationItem(
      id: 'notif_2',
      title: 'New Classwork Submitted',
      message: 'Juan Dela Cruz submitted "Assignment #2: Quadratic Equations".',
      timestamp: '25 mins ago',
      category: 'Classwork',
      icon: Icons.assignment_turned_in,
      iconColor: AppColors.primaryEmerald,
      isRead: false,
    ),
    NotificationItem(
      id: 'notif_3',
      title: 'Behavioral Incident Logged',
      message: 'Anecdotal record logged for Section G10 - Emerald by Maria Santos.',
      timestamp: '1 hour ago',
      category: 'Incidents',
      icon: Icons.warning_amber_rounded,
      iconColor: AppColors.riskModerate,
      isRead: false,
    ),
    NotificationItem(
      id: 'notif_4',
      title: 'Offline Outbox Synced',
      message: '14 attendance & grade entries successfully synced to server.',
      timestamp: '2 hours ago',
      category: 'System',
      icon: Icons.cloud_done,
      iconColor: Colors.blueAccent,
      isRead: true,
    ),
    NotificationItem(
      id: 'notif_5',
      title: 'Module Upload Successful',
      message: 'Learning Module "Quarter 2 Mathematics Guide.pdf" published to class.',
      timestamp: 'Yesterday',
      category: 'Classwork',
      icon: Icons.upload_file,
      iconColor: AppColors.primaryEmerald,
      isRead: true,
    ),
    NotificationItem(
      id: 'notif_6',
      title: 'Quarter 1 Grades Transmuted',
      message: 'Final DepEd transmutation completed for Math G10 - Emerald.',
      timestamp: '2 days ago',
      category: 'System',
      icon: Icons.grade,
      iconColor: Colors.purpleAccent,
      isRead: true,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final filteredNotifications = _selectedCategory == 'All'
        ? _notifications
        : _notifications.where((n) => n.category == _selectedCategory).toList();

    final unreadCount = _notifications.where((n) => !n.isRead).length;

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
          'Notifications',
          style: GoogleFonts.inter(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        actions: [
          if (unreadCount > 0)
            TextButton.icon(
              onPressed: () {
                setState(() {
                  for (var item in _notifications) {
                    item.isRead = true;
                  }
                });
              },
              icon: const Icon(Icons.done_all, size: 16, color: AppColors.primaryEmerald),
              label: Text(
                'Mark all read',
                style: GoogleFonts.inter(
                  color: AppColors.primaryEmerald,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          // Filter Chips Segmented Control Bar
          Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: ['All', 'Attendance', 'Classwork', 'Incidents', 'System'].map((cat) {
                final isSelected = _selectedCategory == cat;
                return Container(
                  margin: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(cat),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _selectedCategory = cat);
                      }
                    },
                    selectedColor: AppColors.primaryEmerald,
                    backgroundColor: AppColors.surfaceElevated,
                    labelStyle: GoogleFonts.inter(
                      color: isSelected ? const Color(0xFF0C1612) : AppColors.textSecondary,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      fontSize: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                      side: BorderSide(
                        color: isSelected ? AppColors.primaryEmerald : AppColors.borderSubtle,
                      ),
                    ),
                    showCheckmark: false,
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 8),

          // Notifications List
          Expanded(
            child: filteredNotifications.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.notifications_none, size: 48, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        Text(
                          'No notifications found',
                          style: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 14),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: filteredNotifications.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final item = filteredNotifications[index];
                      return CustomCard(
                        onTap: () {
                          setState(() {
                            item.isRead = true;
                          });
                        },
                        backgroundColor: item.isRead
                            ? AppColors.surfaceCard
                            : AppColors.primaryEmerald.withOpacity(0.08),
                        borderColor: item.isRead
                            ? AppColors.borderSubtle
                            : AppColors.primaryEmerald.withOpacity(0.3),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: item.iconColor.withOpacity(0.18),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(item.icon, color: item.iconColor, size: 20),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          item.title,
                                          style: GoogleFonts.inter(
                                            color: AppColors.textPrimary,
                                            fontWeight: item.isRead ? FontWeight.w600 : FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (!item.isRead) ...[
                                        const SizedBox(width: 6),
                                        Container(
                                          width: 8,
                                          height: 8,
                                          decoration: const BoxDecoration(
                                            color: AppColors.primaryEmerald,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    item.message,
                                    style: GoogleFonts.inter(
                                      color: AppColors.textSecondary,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        item.timestamp,
                                        style: GoogleFonts.robotoMono(
                                          color: AppColors.textMuted,
                                          fontSize: 11,
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppColors.surfaceElevated,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          item.category,
                                          style: GoogleFonts.robotoMono(
                                            color: AppColors.textMuted,
                                            fontSize: 10,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
