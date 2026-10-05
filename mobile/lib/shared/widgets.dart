// Zentra component library — web-matched (monochrome ink, 6px, 1px borders).
// Ports: Button h-32px, Badge pill h-20px, KpiCard, tables, skeletons, empties.

import 'package:flutter/material.dart';

import '../design/tokens.dart';

// --- Legacy names kept (restyled to web tokens) ---

class LoadingView extends StatelessWidget {
  final String label;
  const LoadingView({super.key, this.label = 'Loading…'});
  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
          const SizedBox(height: 8),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ]),
      );
}

class ErrorView extends StatelessWidget {
  final String message;
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
          Text(message, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
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
  Widget build(BuildContext context) {
    final color = switch (level) {
      'High' => ZTokens.riskHigh,
      'Moderate' => ZTokens.riskModerate,
      _ => ZTokens.riskLow,
    };
    return Container(
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(ZTokens.radiusPill),
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Center(child: Text(level, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color))),
    );
  }
}

class FlagChip extends StatelessWidget {
  final String flag; // academic | attendance | behavioral
  const FlagChip({super.key, required this.flag});
  @override
  Widget build(BuildContext context) {
    final color = switch (flag) {
      'academic' => ZTokens.factorAcademic,
      'attendance' => ZTokens.factorAttendance,
      _ => ZTokens.factorBehavioral,
    };
    return Container(
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(ZTokens.radiusPill), color: color.withValues(alpha: 0.12)),
      child: Center(child: Text(flag, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color))),
    );
  }
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
    final card = Card(margin: EdgeInsets.zero, child: Padding(padding: padding, child: child));
    if (onTap == null) return card;
    return InkWell(borderRadius: BorderRadius.circular(ZTokens.radiusLg), onTap: onTap, child: card);
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
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(ZTokens.radiusLg),
        border: Border.all(color: theme.colorScheme.outline, style: BorderStyle.solid, width: 1.5),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(shape: BoxShape.circle, color: theme.colorScheme.surfaceContainerLow),
          child: Icon(icon, size: 20, color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 8),
        Text(title, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
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
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < values.length; i++)
            GestureDetector(
              onTap: () => onChanged(values[i]),
              child: AnimatedContainer(
                duration: ZTokens.micro,
                height: 24,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(ZTokens.radiusMd),
                  color: values[i] == selected ? theme.colorScheme.surface : Colors.transparent,
                  border: values[i] == selected ? Border.all(color: theme.colorScheme.outline) : null,
                ),
                child: Center(child: Text(labels[i], style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
              ),
            ),
        ],
      ),
    );
  }
}
