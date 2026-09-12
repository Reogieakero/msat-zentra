import 'package:flutter/material.dart';

/// Global responsive breakpoints and dimension constants for Zentra.
class AppBreakpoints {
  AppBreakpoints._();

  // Screen Width Thresholds (in pixels)
  static const double mobileMax = 599.0;
  static const double tabletMin = 600.0;
  static const double tabletMax = 1023.0;
  static const double desktopMin = 1024.0;
  static const double desktopLargeMin = 1440.0;

  // Max Content / Card Container Widths
  static const double maxContentWidthMobile = double.infinity;
  static const double maxContentWidthTablet = 768.0;
  static const double maxContentWidthDesktop = 1280.0;
  static const double maxFormWidth = 460.0;

  // Dynamic Responsive Grid Column Counts
  static int getGridColumnCount(double width) {
    if (width >= desktopLargeMin) return 4;
    if (width >= desktopMin) return 3;
    if (width >= tabletMin) return 2;
    return 1;
  }

  // Dynamic Responsive Horizontal Padding
  static double getHorizontalPadding(double width) {
    if (width >= desktopMin) return 32.0;
    if (width >= tabletMin) return 24.0;
    return 16.0;
  }

  // Dynamic Responsive Dialog Width
  static double getDialogWidth(double width) {
    if (width >= desktopMin) return 560.0;
    if (width >= tabletMin) return 480.0;
    return width * 0.9;
  }
}
