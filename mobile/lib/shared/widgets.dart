// Zentra component library — web-matched (monochrome ink, 6px, 1px borders).
// Web visuals, with 48px interactive targets and scalable metadata chips.

import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../design/status_palette.dart';
import 'user_messages.dart';
import 'spinner.dart';

// --- Legacy names kept (restyled to web tokens) ---

class LoadingView extends StatelessWidget {
  final String label;
  const LoadingView({super.key, this.label = 'Loading…'});
  @override
  Widget build(BuildContext context) => Center(
        child: Semantics(liveRegion: true, label: label, child: ExcludeSemantics(child: Row(mainAxisSize: MainAxisSize.min, children: [
          const ZSpinner(),
          const SizedBox(width: 12),
          Flexible(child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
        ]))),
      );
}

class ErrorView extends StatelessWidget {
  final Object? message;
  final VoidCallback? onRetry;
  const ErrorView({super.key, required this.message, this.onRetry});
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(shape: BoxShape.circle, color: theme.colorScheme.surfaceContainerLow),
            child: const Icon(Icons.error_outline, size: 20),
          ),
          const SizedBox(height: 8),
          Semantics(liveRegion: true, child: Text(userMessage(message), textAlign: TextAlign.center, style: theme.textTheme.bodySmall)),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ]),
      ),
    );
  }
}

class RiskBadge extends StatelessWidget {
  final String level;
  const RiskBadge({super.key, required this.level});
  @override
  Widget build(BuildContext context) => ZStatusPill(text: level, tone: riskTone(level), badge: true);
}

class ZStatusPill extends StatelessWidget {
  const ZStatusPill({super.key, required this.text, this.tone = StatusTone.neutral, this.badge = false});
  final String text;
  final StatusTone tone;
  final bool badge;

  @override
  Widget build(BuildContext context) {
    final colors = statusColors(tone, Theme.of(context), badge: badge);
    return Container(
      constraints: const BoxConstraints(minHeight: 20),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(badge ? ZTokens.radiusPill : ZTokens.radiusMd),
      ),
      child: Text(text, style: TextStyle(color: colors.foreground, fontSize: 11, fontWeight: FontWeight.w600, height: 1.2)),
    );
  }
}

class FlagChip extends StatelessWidget {
  final String flag; // academic | attendance | behavioral
  const FlagChip({super.key, required this.flag});
  @override
  Widget build(BuildContext context) => ZStatusPill(text: flag.replaceAll('_', ' '), tone: switch (flag.toLowerCase()) {
    'academic' => StatusTone.amber,
    'attendance' => StatusTone.green,
    'behavioral' => StatusTone.blue,
    _ => statusTone(flag),
  });
}

class PendingChip extends StatelessWidget {
  final int count;
  const PendingChip({super.key, required this.count});
  @override
  Widget build(BuildContext context) {
    if (count == 0) return const SizedBox.shrink();
    return Chip(
      label: Text('$count pending sync', style: const TextStyle(fontSize: 11)),
      avatar: const Icon(Icons.cloud_upload_outlined, size: 14),
      visualDensity: VisualDensity.compact,
    );
  }
}

// --- New web-ports ---

class ZCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  const ZCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap});
  @override
  Widget build(BuildContext context) {
    final content = Padding(padding: padding, child: child);
    return Card(
      margin: EdgeInsets.zero, clipBehavior: Clip.antiAlias,
      child: onTap == null ? content : Semantics(button: true, child: InkWell(
        customBorder: Theme.of(context).cardTheme.shape,
        onTap: onTap,
        child: ConstrainedBox(constraints: const BoxConstraints(minHeight: ZTokens.controlH), child: content),
      )),
    );
  }
}

class ZKpi extends StatelessWidget {
  final String value;
  final String label;
  final String? desc;
  final IconData icon;
  const ZKpi({super.key, required this.value, required this.label, this.desc, required this.icon});
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ZCard(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(ZTokens.radiusMd), color: theme.colorScheme.surfaceContainerLow),
          child: Icon(icon, size: 18),
        ),
        const SizedBox(height: 8),
        Text(value, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()])),
        Text(label.toUpperCase(), style: theme.textTheme.labelSmall?.copyWith(letterSpacing: 0.4, color: theme.colorScheme.onSurfaceVariant)),
        if (desc != null) Text(desc!, style: theme.textTheme.bodySmall),
      ]),
    );
  }
}

class ZSearchField extends StatelessWidget {
  final String hint;
  final ValueChanged<String> onChanged;
  const ZSearchField({super.key, this.hint = 'Search…', required this.onChanged});
  @override
  Widget build(BuildContext context) => TextField(
        decoration: InputDecoration(prefixIcon: const Icon(Icons.search, size: 18), hintText: hint),
        onChanged: onChanged,
      );
}

class ZEmpty extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  const ZEmpty({super.key, required this.icon, required this.title, this.subtitle, this.actionLabel, this.onAction});
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: ZTokens.factorAcademic.withValues(alpha: 0.10),
        borderRadius: const BorderRadius.horizontal(right: Radius.circular(ZTokens.radiusLg)),
        border: const Border(left: BorderSide(color: ZTokens.factorAcademic, width: 3)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.all(12),
            decoration: const BoxDecoration(shape: BoxShape.circle),
            child: Icon(icon, size: 20, color: theme.brightness == Brightness.dark ? ZTokens.factorAcademic : const Color(0xFFB45309)),
        ),
        const SizedBox(height: 8),
        Text(title, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
        if (subtitle != null) ...[const SizedBox(height: 4), Text(subtitle!, textAlign: TextAlign.center, style: theme.textTheme.bodySmall)],
        if (actionLabel != null) ...[const SizedBox(height: 12), FilledButton(onPressed: onAction, child: Text(actionLabel!))],
      ]),
    );
  }
}

class ZSkeletonRow extends StatelessWidget {
  const ZSkeletonRow({super.key});
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme.surfaceContainerLow;
    return Container(
      height: 64,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(ZTokens.radiusLg), color: c),
    );
  }
}

class ZSkeletonList extends StatelessWidget {
  final int count;
  const ZSkeletonList({super.key, this.count = 5});
  @override
  Widget build(BuildContext context) => ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: count,
        separatorBuilder: (context, _) => const SizedBox(height: 8),
        itemBuilder: (context, _) => const ZSkeletonRow(),
      );
}

class SegTabs<T> extends StatelessWidget {
  final List<T> values;
  final List<String> labels;
  final T selected;
  final ValueChanged<T> onChanged;
  const SegTabs({super.key, required this.values, required this.labels, required this.selected, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(ZTokens.radiusLg), color: theme.colorScheme.surfaceContainerLow),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          for (var i = 0; i < values.length; i++)
            Semantics(
              checked: values[i] == selected, inMutuallyExclusiveGroup: true,
              child: TextButton(
                onPressed: () => onChanged(values[i]),
                style: TextButton.styleFrom(
                  minimumSize: const Size(48, ZTokens.controlH),
                  foregroundColor: theme.colorScheme.onSurface,
                  backgroundColor: values[i] == selected ? theme.colorScheme.surface : Colors.transparent,
                  side: values[i] == selected ? BorderSide(color: theme.colorScheme.outline) : BorderSide.none,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ZTokens.radiusMd)),
                ),
                child: Text(labels[i], style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              ),
            ),
        ],
      ),
    );
  }
}
