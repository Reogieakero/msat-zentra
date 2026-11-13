import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'device_presets.dart';

/// Enabled only by Linux debug runs; mobile and release builds bypass it.
bool get devicePreviewEnabled =>
    kDebugMode &&
    !kIsWeb &&
    defaultTargetPlatform == TargetPlatform.linux &&
    const bool.fromEnvironment('DEVICE_PREVIEW', defaultValue: true);

/// Wraps the router, including its overlay, in a constrained virtual viewport.
class DevicePreviewHost extends StatefulWidget {
  const DevicePreviewHost({super.key, required this.child});

  final Widget child;

  @override
  State<DevicePreviewHost> createState() => _DevicePreviewHostState();
}

class _DevicePreviewHostState extends State<DevicePreviewHost> {
  DevicePreset _device = devicePresets[1];
  bool _landscape = false;
  bool _fit = true;
  bool _frame = true;

  @override
  Widget build(BuildContext context) {
    final viewport = _device.viewport(landscape: _landscape);
    final padding = _device.padding(landscape: _landscape);
    final border = _frame ? 10.0 : 0.0;
    final outer = Size(
      viewport.width + border * 2,
      viewport.height + border * 2,
    );
    // Do not leak the Linux window's insets into the virtual device. A real
    // desktop keyboard still works, but this does not simulate a soft keyboard.
    final media = MediaQuery.of(context).copyWith(
      size: viewport,
      devicePixelRatio: 1,
      padding: padding,
      viewPadding: padding,
      viewInsets: EdgeInsets.zero,
      systemGestureInsets: EdgeInsets.zero,
      displayFeatures: const [],
    );

    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8),
            child: Wrap(
              spacing: 12,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text(
                  'Device preview',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                for (final device in devicePresets)
                  ChoiceChip(
                    label: Text(device.label),
                    selected: _device == device,
                    onSelected: (_) => setState(() => _device = device),
                  ),
                Text('${viewport.width.toInt()} × ${viewport.height.toInt()}'),
                TextButton.icon(
                  onPressed: () => setState(() => _landscape = !_landscape),
                  icon: const Icon(Icons.screen_rotation),
                  label: const Text('Rotate device'),
                ),
                FilterChip(
                  label: Text(_fit ? 'Fit to window' : 'Actual size (1:1)'),
                  selected: _fit,
                  onSelected: (value) => setState(() => _fit = value),
                ),
                FilterChip(
                  label: const Text('Device frame'),
                  selected: _frame,
                  onSelected: (value) => setState(() => _frame = value),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final scale = _fit
                    ? math.min(
                        1.0,
                        math.min(
                          math.max(1.0, constraints.maxWidth - 32) /
                              outer.width,
                          math.max(1.0, constraints.maxHeight - 32) /
                              outer.height,
                        ),
                      )
                    : 1.0;
                // Keep this tree identical for every setting so the router,
                // open dialogs, form state and scroll positions survive changes.
                return ClipRect(
                  child: SingleChildScrollView(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: SizedBox(
                        width: math.max(
                          constraints.maxWidth,
                          outer.width * scale + 32,
                        ),
                        height: math.max(
                          constraints.maxHeight,
                          outer.height * scale + 32,
                        ),
                        child: Center(
                          child: SizedBox(
                            width: outer.width * scale,
                            height: outer.height * scale,
                            child: FittedBox(
                              child: SizedBox(
                                width: outer.width,
                                height: outer.height,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: Colors.black87,
                                    borderRadius: BorderRadius.circular(
                                      _frame ? 28 : 0,
                                    ),
                                  ),
                                  child: Padding(
                                    padding: EdgeInsets.all(border),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(
                                        _frame ? 18 : 0,
                                      ),
                                      child: MediaQuery(
                                        data: media,
                                        child: ColoredBox(
                                          key: const ValueKey(
                                            'preview-viewport',
                                          ),
                                          color: Theme.of(context)
                                              .scaffoldBackgroundColor,
                                          child: widget.child,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
