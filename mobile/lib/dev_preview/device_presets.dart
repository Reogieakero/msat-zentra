import 'package:flutter/widgets.dart';

/// Generic logical-pixel viewports, not hardware or operating-system emulators.
class DevicePreset {
  const DevicePreset(this.label, this.size, this.safeArea);

  final String label;
  final Size size;
  final EdgeInsets safeArea;

  Size viewport({required bool landscape}) =>
      landscape ? Size(size.height, size.width) : size;

  EdgeInsets padding({required bool landscape}) => landscape
      ? EdgeInsets.fromLTRB(
          safeArea.top,
          safeArea.right,
          safeArea.bottom,
          safeArea.left,
        )
      : safeArea;
}

const devicePresets = [
  DevicePreset(
    'Compact phone',
    Size(360, 800),
    EdgeInsets.only(top: 24, bottom: 24),
  ),
  DevicePreset(
    'Standard phone',
    Size(390, 844),
    EdgeInsets.only(top: 47, bottom: 34),
  ),
  DevicePreset(
    'Large phone',
    Size(430, 932),
    EdgeInsets.only(top: 47, bottom: 34),
  ),
  DevicePreset(
    'Standard tablet',
    Size(768, 1024),
    EdgeInsets.only(top: 24, bottom: 20),
  ),
  DevicePreset(
    'Large tablet',
    Size(1024, 1366),
    EdgeInsets.only(top: 24, bottom: 20),
  ),
];
