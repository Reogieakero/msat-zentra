// Zentra theme — light + dark parity with web globals.css.
// Inter everywhere, rounded-md 6px, 1px borders, h-32px controls, micro motion.

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'tokens.dart';
import 'theme_mode.dart';

ThemeData zLightTheme({Color? primaryOverride, Color? secondaryOverride}) {
  final base = ThemeData.light(useMaterial3: true);
  final text = GoogleFonts.interTextTheme(base.textTheme);
  final scheme = ColorScheme.light(
    surface: ZLight.background,
    onSurface: ZLight.foreground,
    surfaceContainerLow: ZLight.muted,
    onSurfaceVariant: ZLight.mutedFg,
    primary: primaryOverride ?? ZLight.primary,
    onPrimary: primaryOverride == null ? ZLight.primaryFg : contrastForeground(primaryOverride),
    secondary: secondaryOverride ?? ZLight.secondary,
    onSecondary: secondaryOverride == null ? ZLight.foreground : contrastForeground(secondaryOverride),
    outline: ZLight.border,
    outlineVariant: ZLight.border,
    error: ZTokens.destructiveRed,
  );
  return base.copyWith(
    colorScheme: scheme,
    scaffoldBackgroundColor: ZLight.background,
    textTheme: text,
    appBarTheme: base.appBarTheme.copyWith(
      backgroundColor: ZLight.background,
      foregroundColor: ZLight.foreground,
      elevation: 0,
      scrolledUnderElevation: 0,
      toolbarHeight: ZTokens.topBarH,
      titleTextStyle: text.titleMedium?.copyWith(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.2),
    ),
    cardTheme: base.cardTheme.copyWith(
      color: ZLight.card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ZTokens.radiusLg),
        side: const BorderSide(color: ZLight.border, width: 1),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, ZTokens.controlH),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ZTokens.radiusLg)),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, ZTokens.controlH),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ZTokens.radiusLg)),
        side: const BorderSide(color: ZLight.border),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ZTokens.radiusPill)),
      side: const BorderSide(color: ZLight.border),
    ),
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(ZTokens.radiusLg), borderSide: const BorderSide(color: ZLight.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(ZTokens.radiusLg), borderSide: const BorderSide(color: ZLight.border)),
    ),
    dividerTheme: const DividerThemeData(color: ZLight.border, thickness: 1, space: 1),
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    }),
  );
}

ThemeData zDarkTheme({Color? primaryOverride, Color? secondaryOverride}) {
  final base = ThemeData.dark(useMaterial3: true);
  final text = GoogleFonts.interTextTheme(base.textTheme);
  final scheme = ColorScheme.dark(
    surface: ZDark.background,
    onSurface: ZDark.foreground,
    surfaceContainerLow: ZDark.muted,
    onSurfaceVariant: ZDark.mutedFg,
    primary: primaryOverride ?? ZDark.primary,
    onPrimary: primaryOverride == null ? ZDark.primaryFg : contrastForeground(primaryOverride),
    secondary: secondaryOverride ?? ZDark.secondary,
    onSecondary: secondaryOverride == null ? ZDark.foreground : contrastForeground(secondaryOverride),
    outline: ZDark.border,
    outlineVariant: ZDark.border,
    error: ZTokens.destructiveRed,
  );
  return base.copyWith(
    colorScheme: scheme,
    scaffoldBackgroundColor: ZDark.background,
    textTheme: text,
    appBarTheme: base.appBarTheme.copyWith(
      backgroundColor: ZDark.background,
      foregroundColor: ZDark.foreground,
      elevation: 0,
      scrolledUnderElevation: 0,
      toolbarHeight: ZTokens.topBarH,
      titleTextStyle: text.titleMedium?.copyWith(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.2),
    ),
    cardTheme: base.cardTheme.copyWith(
      color: ZDark.card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ZTokens.radiusLg),
        side: const BorderSide(color: ZDark.border, width: 1),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, ZTokens.controlH),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ZTokens.radiusLg)),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, ZTokens.controlH),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ZTokens.radiusLg)),
        side: const BorderSide(color: ZDark.border),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ZTokens.radiusPill)),
      side: const BorderSide(color: ZDark.border),
    ),
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(ZTokens.radiusLg), borderSide: const BorderSide(color: ZDark.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(ZTokens.radiusLg), borderSide: const BorderSide(color: ZDark.border)),
    ),
    dividerTheme: const DividerThemeData(color: ZDark.border, thickness: 1, space: 1),
  );
}
