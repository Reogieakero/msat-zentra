// Shared web tokens with mobile-safe controls. Inter is bundled for offline use.
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';

import 'tokens.dart';
import 'theme_mode.dart';

ThemeData zLightTheme({Color? primaryOverride, Color? secondaryOverride}) =>
    _workspaceTheme(Brightness.light, primaryOverride, secondaryOverride);

ThemeData zDarkTheme({Color? primaryOverride, Color? secondaryOverride}) =>
    _workspaceTheme(Brightness.dark, primaryOverride, secondaryOverride);

ThemeData _workspaceTheme(
  Brightness brightness,
  Color? primaryOverride,
  Color? secondaryOverride,
) {
  final dark = brightness == Brightness.dark;
  final background = dark ? ZDark.background : ZLight.background;
  final foreground = dark ? ZDark.foreground : ZLight.foreground;
  final card = dark ? ZDark.card : ZLight.card;
  final muted = dark ? ZDark.muted : ZLight.muted;
  final mutedFg = dark ? ZDark.mutedFg : ZLight.mutedFg;
  final border = dark ? ZDark.border : ZLight.border;
  final input = dark ? ZDark.input : ZLight.input;
  final ring = dark ? ZDark.ring : ZLight.ring;
  final primary = primaryOverride ?? (dark ? ZDark.primary : ZLight.primary);
  final primaryFg = primaryOverride == null
      ? (dark ? ZDark.primaryFg : ZLight.primaryFg)
      : contrastForeground(primary);
  final secondary =
      secondaryOverride ?? (dark ? ZDark.secondary : ZLight.secondary);
  final secondaryFg = secondaryOverride == null
      ? (dark ? ZDark.foreground : ZLight.primary)
      : contrastForeground(secondary);
  final destructive = dark ? ZDark.primary : ZLight.primary;
  // Set every Material surface/accent family: unspecified M3 defaults otherwise
  // introduce purple tint that does not exist in the web workspace.
  final scheme = ColorScheme(
    brightness: brightness,
    primary: primary,
    onPrimary: primaryFg,
    primaryContainer: muted,
    onPrimaryContainer: foreground,
    secondary: secondary,
    onSecondary: secondaryFg,
    secondaryContainer: secondary,
    onSecondaryContainer: secondaryFg,
    tertiary: primary,
    onTertiary: primaryFg,
    tertiaryContainer: muted,
    onTertiaryContainer: foreground,
    error: destructive,
    onError: dark ? ZDark.primaryFg : ZLight.primaryFg,
    errorContainer: destructive.withValues(alpha: dark ? 0.2 : 0.1),
    onErrorContainer: destructive,
    surface: background,
    onSurface: foreground,
    onSurfaceVariant: mutedFg,
    surfaceDim: background,
    surfaceBright: card,
    surfaceContainerLowest: background,
    surfaceContainerLow: muted,
    surfaceContainer: card,
    surfaceContainerHigh: muted,
    surfaceContainerHighest: muted,
    outline: border,
    outlineVariant: border,
    inverseSurface: dark ? ZLight.background : ZDark.background,
    onInverseSurface: dark ? ZLight.foreground : ZDark.foreground,
    inversePrimary: dark ? ZLight.primary : ZDark.primary,
    shadow: Colors.black,
    scrim: Colors.black,
    surfaceTint: Colors.transparent,
  );
  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    fontFamily: 'Inter',
  );
  final text = base.textTheme.copyWith(
    headlineSmall: base.textTheme.headlineSmall?.copyWith(
      fontSize: ZTokens.heroSize,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.2,
    ),
    titleLarge: base.textTheme.titleLarge?.copyWith(
      fontSize: 18,
      fontWeight: FontWeight.w500,
    ),
    titleMedium: base.textTheme.titleMedium?.copyWith(
      fontSize: 15,
      fontWeight: FontWeight.w600,
    ),
    titleSmall: base.textTheme.titleSmall?.copyWith(
      fontSize: 13,
      fontWeight: FontWeight.w600,
    ),
    bodyLarge: base.textTheme.bodyLarge?.copyWith(fontSize: 16, height: 1.5),
    bodyMedium: base.textTheme.bodyMedium?.copyWith(fontSize: 14, height: 1.5),
    bodySmall: base.textTheme.bodySmall?.copyWith(fontSize: 12, height: 1.5),
    labelLarge: base.textTheme.labelLarge?.copyWith(
      fontSize: 13,
      fontWeight: FontWeight.w500,
    ),
    labelSmall: base.textTheme.labelSmall?.copyWith(fontSize: 11),
  );
  final buttonShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(ZTokens.radiusLg),
  );
  OutlineInputBorder fieldBorder(Color color, [double width = 1]) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(ZTokens.radiusLg),
        borderSide: BorderSide(color: color, width: width),
      );
  final buttonText = text.labelLarge;
  return base.copyWith(
    textTheme: text,
    scaffoldBackgroundColor: background,
    canvasColor: card,
    primaryColor: primary,
    focusColor: ring.withValues(alpha: 0.2),
    hoverColor: muted.withValues(alpha: dark ? 0.5 : 0.8),
    highlightColor: primary.withValues(alpha: 0.06),
    splashColor: primary.withValues(alpha: 0.08),
    disabledColor: foreground.withValues(alpha: 0.5),
    materialTapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.standard,
    appBarTheme: AppBarTheme(
      backgroundColor: background,
      foregroundColor: foreground,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      toolbarHeight: ZTokens.topBarH,
      titleTextStyle: text.titleMedium?.copyWith(
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
    ),
    cardTheme: CardThemeData(
      color: card,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ZTokens.radiusXl),
        side: BorderSide(color: border),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: primaryFg,
        disabledBackgroundColor: primary.withValues(alpha: 0.5),
        disabledForegroundColor: primaryFg.withValues(alpha: 0.5),
        minimumSize: const Size(48, ZTokens.controlH),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        shape: buttonShape,
        textStyle: buttonText,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: foreground,
        side: BorderSide(color: dark ? input : border),
        minimumSize: const Size(48, ZTokens.controlH),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        shape: buttonShape,
        textStyle: buttonText,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: primary,
        minimumSize: const Size(48, ZTokens.controlH),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        shape: buttonShape,
        textStyle: buttonText,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: foreground,
        minimumSize: const Size(48, 48),
        iconSize: 20,
        shape: buttonShape,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      constraints: const BoxConstraints(minHeight: ZTokens.controlH),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      hintStyle: text.bodyMedium?.copyWith(color: mutedFg),
      labelStyle: text.bodyMedium?.copyWith(color: mutedFg),
      border: fieldBorder(input),
      enabledBorder: fieldBorder(input),
      disabledBorder: fieldBorder(input.withValues(alpha: input.a * 0.5)),
      focusedBorder: fieldBorder(ring, 2),
      errorBorder: fieldBorder(destructive),
      focusedErrorBorder: fieldBorder(destructive, 2),
      errorStyle: text.bodySmall?.copyWith(color: destructive),
      errorMaxLines: 3,
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: muted,
      labelStyle: text.bodySmall?.copyWith(color: foreground),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ZTokens.radiusMd),
      ),
      side: BorderSide.none,
    ),
    drawerTheme: DrawerThemeData(
      backgroundColor: dark ? ZDark.sidebar : ZLight.sidebar,
      surfaceTintColor: Colors.transparent,
    ),
    listTileTheme: ListTileThemeData(
      textColor: foreground,
      iconColor: mutedFg,
      selectedColor: foreground,
      selectedTileColor: muted,
      minTileHeight: 48,
      titleTextStyle: text.bodyMedium,
      subtitleTextStyle: text.bodySmall?.copyWith(color: mutedFg),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: card,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ZTokens.radiusXl),
        side: BorderSide(color: border),
      ),
      titleTextStyle: text.titleLarge,
      contentTextStyle: text.bodyMedium,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: card,
      modalBackgroundColor: card,
      surfaceTintColor: Colors.transparent,
      dragHandleColor: mutedFg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(ZTokens.radiusXl),
        ),
      ),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: card,
      surfaceTintColor: Colors.transparent,
      textStyle: text.bodyMedium,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ZTokens.radiusLg),
        side: BorderSide(color: border),
      ),
    ),
    dropdownMenuTheme: DropdownMenuThemeData(
      textStyle: text.bodyMedium,
      menuStyle: MenuStyle(
        backgroundColor: WidgetStatePropertyAll(card),
        surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: card,
      contentTextStyle: text.bodyMedium?.copyWith(color: foreground),
      actionTextColor: primary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ZTokens.radiusLg),
        side: BorderSide(color: border),
      ),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: primary,
      linearTrackColor: muted,
    ),
    dividerTheme: DividerThemeData(color: border, thickness: 1, space: 1),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );
}
