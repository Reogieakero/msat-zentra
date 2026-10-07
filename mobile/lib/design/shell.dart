// Zentra app shell — drawer-routed (no bottom nav).
// Header: [≡] logo + Zentra (left) | [🔔][avatar] (right). No term text.
// Drawer: brand → term switcher dropdown → Advisory → Workspace.
// Avatar popup is the system menu: Settings / Appearance / Logout.
// Branding: left-aligned logo + wordmark (matches web topbar brand left).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/notifications.dart';
import '../core/session.dart';
import '../core/sync_outbox.dart';
import '../features/adviser/adm_cases_page.dart' show admCasesProvider;
import '../features/adviser/advisory_list_page.dart' show advisoryProvider, archivedAdvisoryProvider;
import '../features/home/role_home.dart' show AdviserRoute, WorkspaceRoute;
import '../features/settings/settings_data.dart' show teacherProfileProvider;
import '../shared/models.dart' show Term;
import '../shared/widgets.dart';
import 'brand.dart';

class ZentraShell extends ConsumerWidget {
  final Widget child;
  final String selectedPath;
  const ZentraShell({
    super.key,
    required this.child,
    required this.selectedPath,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: const ZentraAppBar(),
      drawer: ZentraDrawer(selectedPath: selectedPath),
      body: child,
    );
  }
}

class ZentraAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const ZentraAppBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return AppBar(
      leading: Builder(
        builder: (ctx) => IconButton(
          icon: const Icon(Icons.menu),
          tooltip: 'Menu',
          onPressed: () => Scaffold.of(ctx).openDrawer(),
        ),
      ),
      // Left-aligned logo + wordmark only — scope lives in the drawer
      // switcher (never centered, keeps room for back chevrons on detail).
      title: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ZLogo(size: 28),
          SizedBox(width: 10),
          Text('Zentra', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
        ],
      ),
      actions: [
        _BellButton(),
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: InkWell(
            borderRadius: BorderRadius.circular(999),
            onTap: () => showZAccount(context, ref),
            child: TeacherAvatar(
              photoUrl: ref.watch(teacherProfileProvider).maybeWhen(data: (p) => p.photoUrl, orElse: () => null),
              radius: 16,
            ),
          ),
        ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Divider(height: 1, color: theme.colorScheme.outline),
      ),
    );
  }
}

class ZentraDrawer extends ConsumerWidget {
  final String selectedPath;
  const ZentraDrawer({super.key, required this.selectedPath});

  bool _selected(String path) => selectedPath == path || selectedPath.startsWith('$path/');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(overviewProvider);
    final isAdviser = overview.maybeWhen(data: (d) => d['isAdviser'] == true, orElse: () => ref.read(authProvider).role == 'adviser');
    return Drawer(
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.horizontal(right: Radius.circular(6))),
      child: SafeArea(
        child: ListView(padding: const EdgeInsets.all(12), children: [
          const ListTile(
            leading: ZLogo(size: 40, radius: 8),
            title: Text('Zentra', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text('Staff workspace'),
          ),
          const SizedBox(height: 8),
          const ZTermSwitcher(),
          const SizedBox(height: 4),
          if (isAdviser) ...[
            const _DrawerHeader('Advisory'),
            _item(context, Icons.group_outlined, 'Advisory list', '/adviser/advisory', _selected('/adviser/advisory')),
            _item(context, Icons.school_outlined, 'Academic', '/adviser/academic', _selected('/adviser/academic')),
            _item(context, Icons.folder_shared_outlined, 'ADM cases', '/adviser/adm-cases', _selected('/adviser/adm-cases')),
            _item(context, Icons.calendar_month_outlined, 'Section schedule', '/adviser/schedule', _selected('/adviser/schedule')),
            _item(context, Icons.chat_bubble_outline, 'Chat with Bama', '/adviser/bama', _selected('/adviser/bama')),
            _item(context, Icons.send_outlined, 'Referrals', '/adviser/referrals', _selected('/adviser/referrals')),
          ],
          const _DrawerHeader('Workspace'),
          _item(context, Icons.class_outlined, 'Class', '/workspace/classes', _selected('/workspace/classes')),
          _item(context, Icons.grade_outlined, 'Gradebook', '/workspace/gradebook', _selected('/workspace/gradebook')),
          _item(context, Icons.fact_check_outlined, 'Attendance', '/workspace/attendance', _selected('/workspace/attendance')),
        ]),
      ),
    );
  }

  static Widget _item(BuildContext context, IconData icon, String label, String path, bool selected) {
    final theme = Theme.of(context);
    return ListTile(
      dense: true,
      leading: Icon(icon, size: 20),
      title: Text(label, style: const TextStyle(fontSize: 13)),
      selected: selected,
      selectedTileColor: theme.colorScheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      onTap: () {
        Navigator.pop(context);
        context.go(path);
      },
    );
  }
}

/// Active School Year + Term dropdown (web ActiveTermBadge pattern).
/// Displays scope, opens the picker sheet, and refetches on switch.
class ZTermSwitcher extends ConsumerWidget {
  const ZTermSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final term = ref.watch(termProvider);
    final pending = ref.watch(outboxProvider).pendingCount;
    final label = term == null ? 'Select term' : '${term.schoolYearName} · Term ${term.termNumber}${pending > 0 ? ' · $pending queued' : ''}';
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(6),
        onTap: () => showZTermPicker(context, ref),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(children: [
            Icon(Icons.calendar_month_outlined, size: 20, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label,
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ),
            Icon(Icons.keyboard_arrow_down, size: 20, color: theme.colorScheme.onSurfaceVariant),
          ]),
        ),
      ),
    );
  }
}

void showZTermPicker(BuildContext context, WidgetRef ref) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      builder: (_, scroll) {
        final years = ref.watch(schoolYearsProvider);
        final current = ref.watch(termProvider);
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Select term', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text('Choose which term your workspace will display.', style: Theme.of(ctx).textTheme.bodySmall),
            const SizedBox(height: 12),
            Expanded(
              child: years.when(
                loading: () => const Center(child: Text('Loading…')),
                error: (e, _) => Center(child: Text(e.toString())),
                data: (list) {
                  if (list.isEmpty) return const Center(child: Text('No school years found. Ask the Principal to create one.'));
                  return ListView.builder(
                    controller: scroll,
                    itemCount: list.expand((sy) => sy.terms.map((t) => (sy, t))).length,
                    itemBuilder: (context, i) {
                      final pairs = list.expand((sy) => sy.terms.map((t) => (sy, t))).toList();
                      final (sy, t) = pairs[i];
                      final isCurrent = current?.id == t.id;
                      final isDefault = sy.isActive && t.termNumber == 1;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          dense: true,
                          title: Text('${sy.name} — Term ${t.termNumber}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          subtitle: sy.isActive ? const Text('Active school year', style: TextStyle(fontSize: 12)) : null,
                          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                            if (isDefault) const Icon(Icons.star, size: 16),
                            if (isCurrent) const Icon(Icons.check, size: 18),
                          ]),
                          onTap: () async {
                            await ref.read(termProvider.notifier).select(
                                  Term(id: t.id, schoolYearId: sy.id, schoolYearName: sy.name, termNumber: t.termNumber),
                                );
                            ref.invalidate(overviewProvider);
                            ref.invalidate(advisoryProvider);
                            ref.invalidate(archivedAdvisoryProvider);
                            ref.invalidate(admCasesProvider);
                            if (ctx.mounted) Navigator.pop(ctx);
                          },
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ]),
        );
      },
    ),
  );
}

// Route-location helpers so shells/drawer highlight without prop drilling.
extension AdviserRouteLocation on AdviserRoute {
  String get path => switch (this) {
        AdviserRoute.advisory => '/adviser/advisory',
        AdviserRoute.academic => '/adviser/academic',
        AdviserRoute.admCases => '/adviser/adm-cases',
        AdviserRoute.schedule => '/adviser/schedule',
        AdviserRoute.bama => '/adviser/bama',
        AdviserRoute.referrals => '/adviser/referrals',
      };
}

extension WorkspaceRouteLocation on WorkspaceRoute {
  String get path => switch (this) {
        WorkspaceRoute.classes => '/workspace/classes',
        WorkspaceRoute.gradebook => '/workspace/gradebook',
        WorkspaceRoute.attendance => '/workspace/attendance',
        WorkspaceRoute.more => '/teacher/more',
      };
}

class _DrawerHeader extends StatelessWidget {
  final String label;
  const _DrawerHeader(this.label);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
        child: Text(label.toUpperCase(), style: Theme.of(context).textTheme.labelSmall?.copyWith(letterSpacing: 0.6, color: Theme.of(context).colorScheme.onSurfaceVariant)),
      );
}

void showZNotifications(BuildContext context, WidgetRef ref) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      builder: (_, scroll) {
        final inbox = ref.watch(notificationsProvider);
        final overview = ref.watch(overviewProvider);
        final isAdviser =
            overview.maybeWhen(data: (d) => d['isAdviser'] == true, orElse: () => ref.read(authProvider).role == 'adviser');
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Expanded(child: Text('Notifications', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600))),
              TextButton(
                onPressed: () async {
                  try {
                    await markAllNotificationsRead(ref);
                  } catch (e) {
                    if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(e.toString())));
                  }
                },
                child: const Text('Mark all read', style: TextStyle(fontSize: 13)),
              ),
            ]),
            const SizedBox(height: 8),
            Expanded(
              child: inbox.when(
                loading: () => const ZSkeletonList(),
                error: (e, _) => Center(child: Text(e.toString(), style: Theme.of(ctx).textTheme.bodySmall)),
                data: (items) {
                  if (items.isEmpty) {
                    return const ZEmpty(
                      icon: Icons.notifications_outlined,
                      title: 'No notifications yet',
                      subtitle: 'Referral updates, absent alerts, and meeting reminders appear here.',
                    );
                  }
                  return ListView.separated(
                    controller: scroll,
                    itemCount: items.length,
                    separatorBuilder: (context, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final n = items[i];
                      return ZCard(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        onTap: () async {
                          if (!n.isRead) {
                            try {
                              await markNotificationRead(ref, n.id);
                            } catch (_) {}
                          }
                          final target = teacherNotificationTarget(n, isAdviser: isAdviser);
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (target != null) {
                            if (context.mounted) context.go(target);
                          } else if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No linked page — viewable on web.')));
                          }
                        },
                        child: Row(children: [
                          if (!n.isRead)
                            Container(width: 8, height: 8, margin: const EdgeInsets.only(right: 8), decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF1C1C1C))),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(teacherNotificationTitle(n), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 2),
                              Text(n.message, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(ctx).textTheme.bodySmall),
                              const SizedBox(height: 2),
                              Text(formatBellDate(n.createdAt),
                                  style: Theme.of(ctx).textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                            ]),
                          ),
                        ]),
                      );
                    },
                  );
                },
              ),
            ),
          ]),
        );
      },
    ),
  );
}

/// Bell with live unread badge (99+ cap, hidden when empty).
class _BellButton extends ConsumerWidget {
  const _BellButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(notificationsProvider);
    final unread = inbox.maybeWhen(data: (items) => items.where((n) => !n.isRead).length, orElse: () => 0);
    final icon = unread == 0
        ? const Icon(Icons.notifications_outlined)
        : Badge(label: Text(unread > 99 ? '99+' : '$unread'), child: const Icon(Icons.notifications_outlined));
    return IconButton(icon: icon, tooltip: 'Notifications', onPressed: () => showZNotifications(context, ref));
  }
}

/// System menu: Settings / Appearance / Logout. Scope switching lives in
/// the drawer term dropdown, not here.
void showZAccount(BuildContext context, WidgetRef ref) {
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
    builder: (ctx) => Padding(
      padding: const EdgeInsets.all(16),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          TeacherAvatar(
            photoUrl: ref.watch(teacherProfileProvider).maybeWhen(data: (p) => p.photoUrl, orElse: () => null),
            radius: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                ref.watch(teacherProfileProvider).maybeWhen(data: (p) => p.fullName, orElse: () => 'Account'),
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              ),
              Text(
                ref.watch(authProvider).role == 'adviser' ? 'Adviser' : 'Subject Teacher',
                style: Theme.of(ctx).textTheme.bodySmall,
              ),
            ]),
          ),
        ]),
        const SizedBox(height: 8),
        ListTile(
          leading: const Icon(Icons.settings_outlined),
          title: const Text('Settings', style: TextStyle(fontSize: 13)),
          onTap: () {
            Navigator.pop(ctx);
            ctx.go('/teacher/more');
          },
        ),
        ListTile(
          leading: const Icon(Icons.dark_mode_outlined),
          title: const Text('Appearance follows system (light/dark)', style: TextStyle(fontSize: 13)),
        ),
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('Logout', style: TextStyle(fontSize: 13)),
          onTap: () async {
            await ref.read(authProvider.notifier).logout();
            if (ctx.mounted) ctx.go('/login');
          },
        ),
      ]),
    ),
  );
}
