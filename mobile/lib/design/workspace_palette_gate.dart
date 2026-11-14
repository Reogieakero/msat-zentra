import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/session.dart';
import '../features/settings/settings_data.dart';
import 'theme_mode.dart';

// The web mounts PaletteGate on the workspace, not on the Settings page.
class WorkspacePaletteGate extends ConsumerStatefulWidget {
  const WorkspacePaletteGate({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<WorkspacePaletteGate> createState() =>
      _WorkspacePaletteGateState();
}

class _WorkspacePaletteGateState extends ConsumerState<WorkspacePaletteGate>
    with WidgetsBindingObserver {
  Timer? _poll;
  int _version = 0;
  String? _signature;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ref.listenManual(authProvider, (previous, next) {
      if (previous?.loggedIn == true && !next.loggedIn) _apply(null, null);
    });
    ref.listenManual(teacherProfileProvider, (_, next) {
      final profile = next.asData?.value;
      if (!next.isLoading &&
          profile != null &&
          ref.read(authProvider).loggedIn) {
        _apply(profile.primaryColor, profile.secondaryColor);
      }
    }, fireImmediately: true);
    _poll = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_visible && ref.read(authProvider).loggedIn) {
        ref.invalidate(teacherProfileProvider);
      }
    });
  }

  bool get _visible =>
      mounted &&
      (WidgetsBinding.instance.lifecycleState == null ||
          WidgetsBinding.instance.lifecycleState ==
              AppLifecycleState.resumed) &&
      ModalRoute.of(context)?.isCurrent == true;

  void _apply(String? primary, String? secondary) {
    final signature = '$primary|$secondary';
    if (_signature == signature) return;
    _signature = signature;
    final version = ++_version;
    // Cached profile data can arrive synchronously during initState. Defer the
    // app-wide theme update until the current build has finished.
    unawaited(
      Future<void>.microtask(() async {
        if (!mounted || version != _version) return;
        try {
          await ref
              .read(themeSettingsProvider.notifier)
              .syncPalette(primary, secondary);
        } catch (error) {
          // Appearance still applies when only the local cache cannot be saved.
          debugPrint('Could not cache workspace appearance: $error');
        }
      }),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        _visible &&
        ref.read(authProvider).loggedIn) {
      ref.invalidate(teacherProfileProvider);
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
