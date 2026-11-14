import 'dart:math' as math;

import 'package:flutter/material.dart';

// Same fixed arc and rotation as web Loader2; respects reduced motion.
class ZSpinner extends StatefulWidget {
  const ZSpinner({super.key, this.size = 18, this.color});
  final double size;
  final Color? color;
  @override
  State<ZSpinner> createState() => _ZSpinnerState();
}

class _ZSpinnerState extends State<ZSpinner>
    with SingleTickerProviderStateMixin {
  late final _rotation = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 1),
  );
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context) ||
        !TickerMode.valuesOf(context).enabled) {
      _rotation.stop();
    } else {
      _rotation.repeat();
    }
  }

  @override
  void dispose() {
    _rotation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: RepaintBoundary(
      child: RotationTransition(
        turns: _rotation,
        child: SizedBox.square(
          dimension: widget.size,
          child: CustomPaint(
            painter: _SpinnerPainter(
              widget.color ?? Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
      ),
    ),
  );
}

class _SpinnerPainter extends CustomPainter {
  const _SpinnerPainter(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) => canvas.drawArc(
    (Offset.zero & size).deflate(1.5),
    -math.pi / 2,
    math.pi * 1.5,
    false,
    Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round,
  );
  @override
  bool shouldRepaint(_SpinnerPainter oldDelegate) => color != oldDelegate.color;
}
