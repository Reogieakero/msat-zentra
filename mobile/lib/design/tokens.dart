// Zentra design tokens — direct Dart port of frontend/src/app/globals.css.
// Web is monochrome ink + Inter + rounded-md 6px + 1px borders. Mobile matches
// as-built (not PLAN.md accent proposal).

import 'package:flutter/material.dart';

abstract class ZTokens {
  // Radius
  static const double radiusSm = 3.6; // 0.6 * 6
  static const double radiusMd = 4.8; // 0.8 * 6
  static const double radiusLg = 6.0; // --radius 0.375rem
  static const double radiusPill = 999;

  // Layout
  static const double topBarH = 56; // h-3rem + padding
  static const double controlH = 32; // all buttons h-8
  static const double pagePad = 16; // .main padding 1rem
  static const double cardPad = 16;
  static const double gap = 12;

  // Type sizes (from record-teacher css)
  static const double heroSize = 22;
  static const double sectionSize = 15;
  static const double bodySize = 13;
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
}

abstract class ZLight {
  static const background = Color(0xFFFFFFFF);
  static const foreground = Color(0xFF1C1C1C); // oklch 0.145 near-black
  static const card = Color(0xFFFFFFFF);
  static const primary = Color(0xFF1C1C1C); // monochrome ink
  static const primaryFg = Color(0xFFFAFAFA);
  static const secondary = Color(0xFFF7F7F7); // oklch 0.97
  static const muted = Color(0xFFF7F7F7);
  static const mutedFg = Color(0xFF8A8A8A); // oklch 0.556
  static const border = Color(0xFFE7E5E4); // oklch 0.922
  static const ring = Color(0xFFB5B5B5);
  // Heatmap hm-0..4 derived from primary
  static const hm0 = Color(0xFFF7F7F7);
  static const hm1 = Color(0xFFEDEDED);
  static const hm2 = Color(0xFFD9D9D9);
  static const hm3 = Color(0xFF8A8A8A);
  static const hm4 = Color(0xFF1C1C1C);
}

abstract class ZDark {
  static const background = Color(0xFF1C1C1C);
  static const foreground = Color(0xFFFAFAFA);
  static const card = Color(0xFF2A2A2A);
  static const primary = Color(0xFFEDEDED); // near-white on dark
  static const primaryFg = Color(0xFF1C1C1C);
  static const secondary = Color(0xFF2E2E2E);
  static const muted = Color(0xFF2E2E2E);
  static const mutedFg = Color(0xFFB5B5B5);
  static const border = Color(0x33FFFFFF); // white/10%
  static const ring = Color(0xFF8A8A8A);
  static const hm0 = Color(0xFF2E2E2E);
  static const hm1 = Color(0xFF3A3A3A);
  static const hm2 = Color(0xFF555555);
  static const hm3 = Color(0xFFB5B5B5);
  static const hm4 = Color(0xFFEDEDED);
}
