// Zentra design tokens — direct Dart port of frontend/src/app/globals.css.
// Neutral OKLCH values are converted to 8-bit sRGB, not estimated by eye.
// Sources: globals.css, ui/pill.tsx and the installed Tailwind theme.css.

import 'package:flutter/material.dart';

abstract class ZTokens {
  // Radius
  static const double radiusSm = 3.6; // 0.6 * 6
  static const double radiusMd = 4.8; // 0.8 * 6
  static const double radiusLg = 6.0; // --radius 0.375rem
  static const double radiusXl = 8.4; // web Card: rounded-xl
  static const double radiusPill = 999;

  // Layout
  static const double topBarH = 56; // h-3rem + padding
  static const double controlH = 48; // web styling, mobile-safe touch target
  static const double pagePad = 16; // .main padding 1rem
  static const double cardPad = 16;
  static const double gap = 12;

  // Type sizes (from record-teacher css)
  static const double heroSize = 20; // shared web page header: 1.25rem
  static const double sectionSize = 15;
  static const double bodySize = 14;
  static const double labelSize = 11;
  static const double tableHeadSize = 12;
  static const double tableCellSize = 13;

  // Motion (PLAN 120-180ms micro)
  static const Duration micro = Duration(milliseconds: 150);
  static const Duration sheet = Duration(milliseconds: 300);
  static const Curve easeOut = Curves.easeOut;

  // Risk (frontend/src/lib/risk/status.ts + badge.tsx)
  static const riskHigh = Color(0xFFEF4444);
  static const riskModerate = Color(0xFFF59E0B);
  static const riskLow = Color(0xFF22C55E);

  // Factor dots (teacher-overview-risk-table.tsx)
  static const factorAcademic = Color(0xFFF59E0B); // amber
  static const factorAttendance = Color(0xFF22C55E); // green
  static const factorBehavioral = Color(0xFF3B82F6); // blue

  // Destructive confirm red (bama-chat.module.css)
  static const destructiveRed = Color(0xFFDC2626);

  static Color heatColor(BuildContext context, int level) {
    final scheme = Theme.of(context).colorScheme;
    if (level <= 0) return scheme.surfaceContainerLow;
    return scheme.primary.withValues(
      alpha: switch (level) {
        1 => 0.12,
        2 => 0.30,
        3 => 0.60,
        _ => 1,
      },
    );
  }
}

abstract class ZLight {
  static const background = Color(0xFFFFFFFF);
  static const foreground = Color(0xFF0A0A0A); // oklch 0.145
  static const card = Color(0xFFFFFFFF);
  static const primary = Color(0xFF171717); // oklch 0.205
  static const primaryFg = Color(0xFFFAFAFA);
  static const secondary = Color(0xFFF5F5F5); // oklch 0.97
  static const muted = Color(0xFFF5F5F5);
  static const mutedFg = Color(0xFF737373); // oklch 0.556
  static const border = Color(0xFFE5E5E5); // oklch 0.922
  static const input = border;
  static const ring = Color(0xFFA1A1A1); // oklch 0.708
  static const sidebar = Color(0xFFFAFAFA);
  // Heatmap hm-0..4 derived from primary
  static const hm0 = muted;
  static const hm1 = Color(0x1F171717);
  static const hm2 = Color(0x4D171717);
  static const hm3 = Color(0x99171717);
  static const hm4 = primary;
}

abstract class ZDark {
  static const background = Color(0xFF0A0A0A);
  static const foreground = Color(0xFFFAFAFA);
  static const card = Color(0xFF171717);
  static const primary = Color(0xFFE5E5E5);
  static const primaryFg = Color(0xFF171717);
  static const secondary = Color(0xFF262626);
  static const muted = Color(0xFF262626);
  static const mutedFg = Color(0xFFA1A1A1);
  static const border = Color(0x1AFFFFFF); // white/10%
  static const input = Color(0x26FFFFFF); // white/15%
  static const ring = Color(0xFF737373);
  static const sidebar = card;
  static const hm0 = muted;
  static const hm1 = Color(0x1FE5E5E5);
  static const hm2 = Color(0x4DE5E5E5);
  static const hm3 = Color(0x99E5E5E5);
  static const hm4 = primary;
}
