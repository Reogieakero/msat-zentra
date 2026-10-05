// Zentra app shell — bespoke mobile, web-matched.
// Top: [≡] Zentra + term badge (left) | [🔔][avatar] (right).
// Bottom: role-aware nav. ≡ opens left drawer (BranchedMenu port).
// Branding: left-aligned wordmark after ≡ (matches web topbar brand left).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/session.dart';
import '../design/tokens.dart';

class ZentraShell extends ConsumerWidget {
  final String title;
  final String? termLabel;
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<ZNavDest> destinations;
  final Widget child;
  final Widget? fab;
  const ZentraShell({
    super.key,
    required this.title,
    this.termLabel,
    required this.currentIndex,
    required this.onTap,
    required this.destinations,
    required this.child,
    this.fab,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: ZentraAppBar(title: title, termLabel: termLabel),
      drawer: const ZentraDrawer(),
      body: AnimatedSwitcher(
        duration: ZTokens.micro,
        switchInCurve: ZTokens.easeOut,
        switchOutCurve: ZTokens.easeOut,
        child: KeyedSubtree(key: ValueKey(currentIndex), child: child),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: onTap,
        height: 68,
        destinations: [for (final d in destinations) NavigationDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selectedIcon ?? d.icon), label: d.label)],
      ),
      floatingActionButton: fab,
    );
  }
}

class ZNavDest {
  final String label;
  final IconData icon;
  final IconData? selectedIcon;
  const ZNavDest({required this.label, required this.icon, this.selectedIcon});
}

class ZentraAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final String title;
  final String? termLabel;
  const ZentraAppBar({super.key, required this.title, this.termLabel});

  @override
  Size get preferredSize => const Size.fromHeight(ZTokens.topBarH);

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
      // Left-aligned wordmark + term badge (never centered — keeps room for
      // back chevrons on detail pages and matches web topbar brand left).
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Zentra', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
          if (termLabel != null)
            Text(termLabel!, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, fontWeight: FontWeight.w600)),
        ],
      ),
      actions: [
        IconButton(icon: const Badge(label: Text(''), child: Icon(Icons.notifications_outlined)), tooltip: 'Notifications', onPressed: () => showZNotifications(context)),
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: InkWell(
            borderRadius: BorderRadius.circular(999),
            onTap: () => showZAccount(context, ref),
            child: const CircleAvatar(radius: 16, child: Icon(Icons.person_outline, size: 18)),
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
  const ZentraDrawer({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(overviewProvider);
    final isAdviser = overview.maybeWhen(data: (d) => d['isAdviser'] == true, orElse: () => false);
    return Drawer(
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.horizontal(right: Radius.circular(6))),
      child: SafeArea(
        child: ListView(padding: const EdgeInsets.all(12), children: [
          const ListTile(title: Text('Zentra', style: TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('Staff workspace')),
          const Divider(),
          const _DrawerHeader('Overview'),
          _item(context, Icons.dashboard_outlined, 'Dashboard', () => context.go(isAdviser ? '/adviser' : '/teacher')),
          if (isAdviser) ...[
            const _DrawerHeader('Advisory'),
            _item(context, Icons.group_outlined, 'Advisory list', () => context.go('/adviser')),
            _item(context, Icons.fact_check_outlined, 'Advisory attendance', () => context.go('/adviser')),
            _item(context, Icons.calendar_month_outlined, 'Section schedule', () => context.go('/adviser')),
            _item(context, Icons.send_outlined, 'Referrals', () => context.go('/adviser')),
          ],
          const _DrawerHeader('Workspace'),
          _item(context, Icons.class_outlined, 'My classes', () => context.go(isAdviser ? '/adviser' : '/teacher')),
          if (isAdviser) _item(context, Icons.chat_bubble_outline, 'Chat with Bama', () => context.go('/adviser')),
          const _DrawerHeader('System'),
          _item(context, Icons.swap_horiz, 'Switch term', () async {
            await ref.read(termProvider.notifier).clear();
            if (context.mounted) context.go('/term');
          }),
          _item(context, Icons.settings_outlined, 'Settings', () {}),
        ]),
      ),
    );
  }

  static Widget _item(BuildContext context, IconData icon, String label, VoidCallback onTap) =>
      ListTile(dense: true, leading: Icon(icon, size: 20), title: Text(label, style: const TextStyle(fontSize: 13)), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)), onTap: () {
        Navigator.pop(context);
        onTap();
      });
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

void showZNotifications(BuildContext context) {
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
    builder: (_) => const Padding(
      padding: EdgeInsets.all(16),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Notifications', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        SizedBox(height: 8),
        Text('Referral updates, absent alerts, and meeting reminders appear here.', style: TextStyle(fontSize: 13)),
        SizedBox(height: 16),
      ]),
    ),
  );
}

void showZAccount(BuildContext context, WidgetRef ref) {
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
    builder: (ctx) => Padding(
      padding: const EdgeInsets.all(16),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(
          leading: const Icon(Icons.swap_horiz),
          title: const Text('Switch term', style: TextStyle(fontSize: 13)),
          onTap: () async {
            await ref.read(termProvider.notifier).clear();
            if (ctx.mounted) ctx.go('/term');
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
