import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'theme_mode.dart';
import 'tokens.dart';

// Same preview-card interaction as web Appearance, retaining mobile's System
// option instead of removing an existing preference.
class WorkspaceThemePicker extends ConsumerWidget {
  const WorkspaceThemePicker({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(themeSettingsProvider).mode;
    final theme = Theme.of(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = MediaQuery.textScalerOf(context).scale(13) > 18
            ? 1
            : constraints.maxWidth >= 390
            ? 3
            : 2;
        final width = (constraints.maxWidth - (columns - 1) * 10) / columns;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final mode in const [
              ThemeMode.light,
              ThemeMode.dark,
              ThemeMode.system,
            ])
              SizedBox(
                width: width,
                child: Semantics(
                  checked: selected == mode,
                  inMutuallyExclusiveGroup: true,
                  child: Material(
                    color: theme.colorScheme.surface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(ZTokens.radiusLg),
                      side: BorderSide(
                        color: selected == mode
                            ? theme.colorScheme.primary
                            : theme.colorScheme.outline,
                        width: selected == mode ? 2 : 1,
                      ),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => ref
                          .read(themeSettingsProvider.notifier)
                          .setMode(mode),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Container(
                              height: 56,
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: mode == ThemeMode.dark
                                    ? ZDark.background
                                    : ZLight.background,
                                gradient: mode == ThemeMode.system
                                    ? const LinearGradient(
                                        colors: [
                                          ZLight.background,
                                          ZLight.background,
                                          ZDark.background,
                                          ZDark.background,
                                        ],
                                        stops: [0, 0.5, 0.5, 1],
                                      )
                                    : null,
                                border: Border.all(
                                  color: theme.colorScheme.outline,
                                ),
                                borderRadius: BorderRadius.circular(
                                  ZTokens.radiusMd,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  FractionallySizedBox(
                                    widthFactor: 0.7,
                                    child: Container(
                                      height: 5,
                                      color: mode == ThemeMode.dark
                                          ? ZDark.muted
                                          : ZLight.border,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Container(
                                    height: 5,
                                    color: mode == ThemeMode.dark
                                        ? ZDark.muted
                                        : ZLight.border,
                                  ),
                                  const SizedBox(height: 6),
                                  FractionallySizedBox(
                                    widthFactor: 0.35,
                                    child: Container(
                                      height: 6,
                                      color: theme.colorScheme.primary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Icon(switch (mode) {
                                  ThemeMode.light => Icons.light_mode_outlined,
                                  ThemeMode.dark => Icons.dark_mode_outlined,
                                  ThemeMode.system =>
                                    Icons.brightness_auto_outlined,
                                }, size: 16),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    switch (mode) {
                                      ThemeMode.light => 'Light',
                                      ThemeMode.dark => 'Dark',
                                      ThemeMode.system => 'System',
                                    },
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                                if (selected == mode)
                                  Icon(
                                    Icons.check,
                                    color: theme.colorScheme.primary,
                                    size: 16,
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
