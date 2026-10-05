// Shared small widgets: loading / error / risk badge / pending-sync chip.

import 'package:flutter/material.dart';

class LoadingView extends StatelessWidget {
  final String label;
  const LoadingView({super.key, this.label = 'Loading…'});
  @override
  Widget build(BuildContext context) => Center(child: Text(label));
}

class ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const ErrorView({super.key, required this.message, this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null) ...[
            const SizedBox(height: 8),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ]),
      );
}

class RiskBadge extends StatelessWidget {
  final String level;
  const RiskBadge({super.key, required this.level});
  @override
  Widget build(BuildContext context) {
    final color = switch (level) {
      'High' => Colors.red,
      'Moderate' => Colors.orange,
      _ => Colors.green,
    };
    return Chip(label: Text(level), backgroundColor: color.withValues(alpha: 0.15), side: BorderSide(color: color));
  }
}

class PendingChip extends StatelessWidget {
  final int count;
  const PendingChip({super.key, required this.count});
  @override
  Widget build(BuildContext context) {
    if (count == 0) return const SizedBox.shrink();
    return Chip(label: Text('$count pending sync'), avatar: const Icon(Icons.cloud_upload_outlined, size: 16));
  }
}
