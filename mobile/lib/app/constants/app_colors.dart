import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Dark Canvas & Surfaces
  static const Color bgDark = Color(0xFF1C1C1C);
  static const Color surfaceDark = Color(0xFF141414);
  static const Color surfaceElevated = Color(0xFF222222);
  static const Color surfaceCard = Color(0xFF181818);

  // Borders & Dividers
  static const Color borderSubtle = Color(0xFF2E2E2E);
  static const Color borderFocused = Color(0xFF3ECF8E);

  // Primary Accent (Supabase Neon Emerald)
  static const Color primaryEmerald = Color(0xFF3ECF8E);
  static const Color primaryEmeraldDark = Color(0xFF2FA871);
  static const Color primaryEmeraldSplash = Color(0x1A3ECF8E);

  // Text Colors
  static const Color textPrimary = Color(0xFFF3F4F6);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textMuted = Color(0xFF6B7280);

  // Status & Risk Colors
  static const Color riskHigh = Color(0xFFEF4444);      // Red
  static const Color riskModerate = Color(0xFFF59E0B);  // Amber/Yellow
  static const Color riskLow = Color(0xFF10B981);       // Emerald Green

  // Attendance Status Colors
  static const Color attendancePresent = Color(0xFF10B981);
  static const Color attendanceAbsent = Color(0xFFEF4444);
  static const Color attendanceLate = Color(0xFFF59E0B);
  static const Color attendanceExcused = Color(0xFF3B82F6); // Blue

  // Grade Lock Status
  static const Color lockUnlocked = Color(0xFFF59E0B);
  static const Color lockLocked = Color(0xFFEF4444);
  static const Color lockApproved = Color(0xFF10B981);
}
