import 'package:flutter/material.dart';

// Web Pill/Badge tone families, converted from installed Tailwind v4 OKLCH.
// Risk/factor chart dots keep their separately defined, explicit web hex values.
enum StatusTone { neutral, amber, red, green, blue, violet }

({Color background, Color foreground}) statusColors(
  StatusTone tone,
  ThemeData theme, {
  bool badge = false,
}) {
  if (tone == StatusTone.neutral) {
    return (
      background: theme.colorScheme.surfaceContainerLow,
      foreground: theme.colorScheme.onSurface,
    );
  }
  final dark = theme.brightness == Brightness.dark;
  final (base, lightText, darkText) = switch (tone) {
    StatusTone.amber => (
      const Color(0xFFFE9A00),
      const Color(0xFFBB4D00),
      const Color(0xFFFFB900),
    ),
    StatusTone.red => (
      const Color(0xFFFB2C36),
      const Color(0xFFC10007),
      const Color(0xFFFF6467),
    ),
    StatusTone.green => (
      const Color(0xFF00C950),
      const Color(0xFF008236),
      const Color(0xFF05DF72),
    ),
    StatusTone.blue => (
      const Color(0xFF2B7FFF),
      const Color(0xFF1447E6),
      const Color(0xFF51A2FF),
    ),
    StatusTone.violet => (
      const Color(0xFF8E51FF),
      const Color(0xFF7008E7),
      const Color(0xFFA684FF),
    ),
    StatusTone.neutral => throw StateError('Neutral handled above'),
  };
  return (
    background: base.withValues(alpha: badge && !dark ? 0.15 : 0.20),
    foreground: dark ? darkText : lightText,
  );
}

/// Web `text-red-600 dark:text-red-400` used for failure/remarks copy.
Color zDangerText(ThemeData theme) => theme.brightness == Brightness.dark
    ? const Color(0xFFFF6467)
    : const Color(0xFFE7000B);

/// Web `text-green-600 dark:text-green-500` used for passing/healthy copy.
Color zSuccessText(ThemeData theme) => theme.brightness == Brightness.dark
    ? const Color(0xFF00C950)
    : const Color(0xFF00A63E);

StatusTone riskTone(String level) => switch (level.toLowerCase()) {
  'high' => StatusTone.red,
  'moderate' => StatusTone.amber,
  'low' => StatusTone.green,
  _ => StatusTone.neutral,
};

StatusTone statusTone(String status) => switch (status.toLowerCase()) {
  'pending' || 'follow_up' || 'returned' => StatusTone.amber,
  'in_progress' ||
  'info_requested' ||
  'submitted' ||
  'ongoing' => StatusTone.blue,
  'approved' || 'verified' || 'resolved' => StatusTone.green,
  'escalated' || 'unresolved' || 'draft' => StatusTone.red,
  _ => StatusTone.neutral,
};
