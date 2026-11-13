// Learner portal shell (student + parent). Deliberately separate from
// ZentraShell: no teacher overview/term headers, no adviser menus. The drawer
// carries the learner/child picker and the term-history selector.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../core/notifications.dart';
import '../core/session.dart';
import '../services/portal_service.dart';
import '../shared/models.dart';
import '../shared/widgets.dart';
import '../shared/user_messages.dart';
import 'brand.dart';

class PortalShell extends ConsumerWidget {
  final Widget child;
  final String selectedPath;
  final String portal; // student | parent
  const PortalShell({super.key, required this.child, required this.selectedPath, required this.portal});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(portalTermIdProvider);
    ref.watch(selectedChildProvider);
    return Scaffold(
      appBar: PortalAppBar(portal: portal),
      drawer: PortalDrawer(selectedPath: selectedPath, portal: portal),
      body: child,
    );
  }
}

class PortalAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final String portal;
  const PortalAppBar({super.key, required this.portal});

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
      title: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ZLogo(size: 28),
          SizedBox(width: 10),
          Text('Zentra', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
        ],
      ),
      actions: [
        _PortalBell(portal: portal),
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: PopupMenuButton<String>(
            tooltip: 'Account',
            onSelected: (value) async {
              if (value == 'logout') {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              }
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'logout', child: Text('Log out')),
            ],
            child: CircleAvatar(
              radius: 16,
              backgroundColor: theme.colorScheme.surfaceContainerLow,
              child: Icon(portal == 'parent' ? Icons.family_restroom : Icons.school_outlined, size: 18),
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

class _PortalBell extends ConsumerWidget {
  final String portal;
  const _PortalBell({required this.portal});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(notificationsProvider);
    final unread = inbox.maybeWhen(data: (list) => list.where((n) => !n.isRead).length, orElse: () => 0);
    return IconButton(
      tooltip: 'Notifications',
      icon: Badge(
        isLabelVisible: unread > 0,
        label: Text('$unread'),
        child: const Icon(Icons.notifications_none),
      ),
      onPressed: () => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (ctx) => _PortalInboxSheet(portal: portal),
      ),
    );
  }
}

class _PortalInboxSheet extends ConsumerWidget {
  final String portal;
  const _PortalInboxSheet({required this.portal});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final inbox = ref.watch(notificationsProvider);
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.7),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('Notifications', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const Spacer(),
                  TextButton(
                    onPressed: () async {
                      await markAllNotificationsRead(ref);
                    },
                    child: const Text('Mark all read'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Expanded(
                child: inbox.when(
                  loading: () => const ZSkeletonList(count: 4),
                  error: (e, _) => ErrorView(message: e),
                  data: (list) {
                    if (list.isEmpty) {
                      return const ZEmpty(icon: Icons.notifications_none, title: 'No notifications yet');
                    }
                    return ListView.separated(
                      itemCount: list.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final n = list[i];
                        return ZCard(
                          padding: const EdgeInsets.all(12),
                          onTap: () async {
                            if (!n.isRead) await markNotificationRead(ref, n.id);
                            if (!context.mounted) return;
                            Navigator.of(context).pop();
                            context.go(portalNotificationTarget(n, portal));
                          },
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                n.sourceTable == 'advisory_modules' ? Icons.folder_outlined : Icons.notifications_outlined,
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      portalNotificationTitle(n),
                                      style: TextStyle(fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700, fontSize: 13),
                                    ),
                                    if (n.message.isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Text(n.message, style: theme.textTheme.bodySmall),
                                    ],
                                    const SizedBox(height: 2),
                                    Text(formatBellDate(n.createdAt), style: theme.textTheme.labelSmall),
                                  ],
                                ),
                              ),
                              if (!n.isRead)
                                Container(
                                  width: 8,
                                  height: 8,
                                  margin: const EdgeInsets.only(top: 4),
                                  decoration: BoxDecoration(color: theme.colorScheme.primary, shape: BoxShape.circle),
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
        ),
      ),
    );
  }
}

class PortalDrawer extends ConsumerWidget {
  final String selectedPath;
  final String portal;
  const PortalDrawer({super.key, required this.selectedPath, required this.portal});

  bool _selected(String path) => selectedPath == path || selectedPath.startsWith('$path/');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Drawer(
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.horizontal(right: Radius.circular(6))),
      child: SafeArea(
        child: ListView(padding: const EdgeInsets.all(12), children: [
          ListTile(
            leading: const ZLogo(size: 40, radius: 8),
            title: const Text('Zentra', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(portal == 'parent' ? 'Parent portal' : 'Student portal'),
          ),
          if (portal == 'parent') ...[
            const SizedBox(height: 4),
            const _PortalChildPicker(),
          ],
          const SizedBox(height: 4),
          _PortalTermPicker(portal: portal),
          const SizedBox(height: 4),
          const _DrawerHeader('My learning'),
          _item(context, Icons.home_outlined, 'Home', '/$portal/home'),
          _item(context, Icons.grade_outlined, 'Grades', '/$portal/grades'),
          _item(context, Icons.fact_check_outlined, 'Attendance', '/$portal/attendance'),
          _item(context, Icons.calendar_month_outlined, 'Schedule', '/$portal/schedule'),
          _item(context, Icons.folder_shared_outlined, 'Modules', '/$portal/modules'),
          _item(context, Icons.event_available_outlined, 'Sessions', '/$portal/sessions'),
          const _DrawerHeader('Account'),
          _item(context, Icons.notifications_none, 'Notifications', '/portal/notifications'),
          ListTile(
            dense: true,
            leading: const Icon(Icons.logout, size: 20),
            title: const Text('Log out', style: TextStyle(fontSize: 13)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            onTap: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          ),
        ]),
      ),
    );
  }

  Widget _item(BuildContext context, IconData icon, String label, String path) {
    final theme = Theme.of(context);
    final selected = _selected(path);
    return ListTile(
      dense: true,
      leading: Icon(icon, size: 20),
      title: Text(label, style: const TextStyle(fontSize: 13)),
      selected: selected,
      selectedTileColor: theme.colorScheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      onTap: () {
        Navigator.of(context).pop();
        context.go(path);
      },
    );
  }
}

class _DrawerHeader extends StatelessWidget {
  final String text;
  const _DrawerHeader(this.text);
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      child: Text(text.toUpperCase(), style: theme.textTheme.labelSmall?.copyWith(letterSpacing: 0.6)),
    );
  }
}

class _PortalChildPicker extends ConsumerWidget {
  const _PortalChildPicker();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = ref.watch(parentChildrenProvider);
    final selected = ref.watch(selectedChildProvider);
    return children.when(
      loading: () => const Padding(padding: EdgeInsets.all(12), child: LinearProgressIndicator()),
      error: (e, _) => Padding(padding: const EdgeInsets.all(12), child: Text(userMessage(e), style: const TextStyle(fontSize: 12))),
      data: (list) {
        if (list.isEmpty) {
          return const Padding(padding: EdgeInsets.all(12), child: Text('No linked learners', style: TextStyle(fontSize: 12)));
        }
        final effective = selected ?? list.first.studentId;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButton<String>(
            isExpanded: true,
            value: list.any((c) => c.studentId == effective) ? effective : list.first.studentId,
            items: [
              for (final c in list)
                DropdownMenuItem(
                  value: c.studentId,
                  child: Text('${c.name} · ${c.gradeLevel}', style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (value) {
              if (value == null) return;
              ref.read(selectedChildProvider.notifier).state = value;
            },
          ),
        );
      },
    );
  }
}

class _PortalTermPicker extends ConsumerWidget {
  final String portal;
  const _PortalTermPicker({required this.portal});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final terms = portal == 'parent'
        ? _parentTerms(ref)
        : ref.watch(studentTermsProvider);
    return terms.when(
      loading: () => const Padding(padding: EdgeInsets.all(12), child: LinearProgressIndicator()),
      error: (e, _) => Padding(padding: const EdgeInsets.all(12), child: Text(userMessage(e), style: const TextStyle(fontSize: 12))),
      data: (list) {
        final selected = ref.watch(portalTermIdProvider);
        final effective = (selected != null && list.any((t) => t.id == selected)) ? selected : null;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButton<String>(
            isExpanded: true,
            value: effective ?? 'active',
            items: [
              const DropdownMenuItem(value: 'active', child: Text('Current term', style: TextStyle(fontSize: 13))),
              for (final t in list) DropdownMenuItem(value: t.id, child: Text(t.label, style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis)),
            ],
            onChanged: (value) {
              ref.read(portalTermIdProvider.notifier).state = value == 'active' ? null : value;
            },
          ),
        );
      },
    );
  }

  AsyncValue<List<PortalTerm>> _parentTerms(WidgetRef ref) {
    final children = ref.watch(parentChildrenProvider);
    final childrenList = children.maybeWhen(data: (c) => c, orElse: () => const <PortalChild>[]);
    if (childrenList.isEmpty) return const AsyncValue.data([]);
    final selected = ref.watch(selectedChildProvider) ?? childrenList.first.studentId;
    return ref.watch(parentTermsProvider(selected));
  }
}

String formatPortalDate(String? iso) {
  if (iso == null || iso.isEmpty) return '—';
  try {
    return DateFormat('MMM d, y').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}
