import 'package:flutter/material.dart';
import '../constants/app_breakpoints.dart';

enum DeviceType { mobile, tablet, desktop }

/// BuildContext Extensions for seamless global screen size querying.
extension ResponsiveContext on BuildContext {
  /// Screen size dimensions
  Size get screenSize => MediaQuery.of(this).size;
  double get screenWidth => screenSize.width;
  double get screenHeight => screenSize.height;

  /// Device type boolean checks
  bool get isMobile => screenWidth < AppBreakpoints.tabletMin;
  bool get isTablet =>
      screenWidth >= AppBreakpoints.tabletMin && screenWidth <= AppBreakpoints.tabletMax;
  bool get isDesktop => screenWidth >= AppBreakpoints.desktopMin;

  /// Enum representation of device type
  DeviceType get deviceType {
    if (isDesktop) return DeviceType.desktop;
    if (isTablet) return DeviceType.tablet;
    return DeviceType.mobile;
  }

  /// Selects a responsive value based on current device screen width.
  /// Falls back smoothly: desktop -> tablet -> mobile.
  T responsiveValue<T>({
    required T mobile,
    T? tablet,
    T? desktop,
  }) {
    if (isDesktop) return desktop ?? tablet ?? mobile;
    if (isTablet) return tablet ?? mobile;
    return mobile;
  }

  /// Dynamic horizontal padding based on screen width
  double get responsiveHorizontalPadding =>
      AppBreakpoints.getHorizontalPadding(screenWidth);

  /// Dynamic grid column count based on screen width
  int get responsiveGridColumns =>
      AppBreakpoints.getGridColumnCount(screenWidth);
}

/// A declarative builder widget that switches between Mobile, Tablet, and Desktop layouts.
class ResponsiveLayout extends StatelessWidget {
  final Widget mobile;
  final Widget? tablet;
  final Widget? desktop;

  const ResponsiveLayout({
    super.key,
    required this.mobile,
    this.tablet,
    this.desktop,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= AppBreakpoints.desktopMin && desktop != null) {
          return desktop!;
        }
        if (constraints.maxWidth >= AppBreakpoints.tabletMin && tablet != null) {
          return tablet!;
        }
        return mobile;
      },
    );
  }
}

/// Helper wrapper that constrains children to a maximum width on tablet & desktop screens.
class ResponsiveCenter extends StatelessWidget {
  final Widget child;
  final double? maxWidth;
  final EdgeInsetsGeometry? padding;

  const ResponsiveCenter({
    super.key,
    required this.child,
    this.maxWidth,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final double effectiveMaxWidth = maxWidth ??
        context.responsiveValue<double>(
          mobile: AppBreakpoints.maxContentWidthMobile,
          tablet: AppBreakpoints.maxContentWidthTablet,
          desktop: AppBreakpoints.maxContentWidthDesktop,
        );

    return Alignment(0, 0) == Alignment.center
        ? Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: effectiveMaxWidth),
              child: Padding(
                padding: padding ??
                    EdgeInsets.symmetric(
                      horizontal: context.responsiveHorizontalPadding,
                    ),
                child: child,
              ),
            ),
          )
        : child;
  }
}
