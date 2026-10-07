// Theme mode + workspace palette — web parity.
// Theme (light/dark/system) is local-only (Hive), like web next-themes
// localStorage. Palette persists server-side (StaffProfile) and is cached
// locally so it paints on cold start.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

const _boxName = 'zentra.settings';

class ThemeSettings {
  final ThemeMode mode;
  final String? primaryHex;
  final String? secondaryHex;
  const ThemeSettings({required this.mode, this.primaryHex, this.secondaryHex});
}

Color? hexToColor(String? hex) {
  if (hex == null) return null;
  final m = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(hex.trim());
  if (m == null) return null;
  return Color(int.parse('FF${m.group(1)}', radix: 16));
}

/// Web contrastForeground: luminance > 0.4 → dark ink else near-white.
Color contrastForeground(Color c) {
  final lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b);
  return lum > 0.4 ? const Color(0xFF18181B) : const Color(0xFFFAFAFA);
}

final themeSettingsProvider = StateNotifierProvider<ThemeSettingsNotifier, ThemeSettings>((ref) => ThemeSettingsNotifier());

class ThemeSettingsNotifier extends StateNotifier<ThemeSettings> {
  ThemeSettingsNotifier() : super(const ThemeSettings(mode: ThemeMode.system)) {
    _load();
  }

  void _load() {
    if (!Hive.isBoxOpen(_boxName)) return;
    final box = Hive.box(_boxName);
    final mode = switch (box.get('themeMode') as String?) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    state = ThemeSettings(
      mode: mode,
      primaryHex: box.get('primaryColor') as String?,
      secondaryHex: box.get('secondaryColor') as String?,
    );
  }

  Future<void> setMode(ThemeMode mode) async {
    await Hive.box(_boxName).put('themeMode', mode.name);
    state = ThemeSettings(mode: mode, primaryHex: state.primaryHex, secondaryHex: state.secondaryHex);
  }

  Future<void> syncPalette(String? primaryHex, String? secondaryHex) async {
    final box = Hive.box(_boxName);
    if (primaryHex == null) {
      await box.delete('primaryColor');
    } else {
      await box.put('primaryColor', primaryHex);
    }
    if (secondaryHex == null) {
      await box.delete('secondaryColor');
    } else {
      await box.put('secondaryColor', secondaryHex);
    }
    state = ThemeSettings(mode: state.mode, primaryHex: primaryHex, secondaryHex: secondaryHex);
  }
}

Future<void> openThemeSettingsBox() async {
  if (!Hive.isBoxOpen(_boxName)) await Hive.openBox(_boxName);
}
