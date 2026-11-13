import 'dart:math' as math;

import 'package:flutter/material.dart';

// A mobile-sized version of the web ScrollField: cached particles, one painter,
// and no widget rebuilds per frame. Keep the form outside this repaint boundary.
class LoginBackground extends StatefulWidget {
  const LoginBackground({super.key, required this.amber});

  final bool amber;

  @override
  State<LoginBackground> createState() => _LoginBackgroundState();
}

class _LoginBackgroundState extends State<LoginBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _motion = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 36),
  );
  late final _particles = _makeParticles();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context) ||
        !TickerMode.valuesOf(context).enabled) {
      _motion.stop();
    } else {
      _motion.repeat();
    }
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final first = widget.amber
        ? const Color(0xffffd88a)
        : const Color(0xff7ef5d0);
    final second = widget.amber
        ? const Color(0xffff9f5c)
        : const Color(0xff7a68ff);
    return ExcludeSemantics(
      child: IgnorePointer(
        child: RepaintBoundary(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: widget.amber
                  ? const Color(0xff080503)
                  : const Color(0xff050807),
              gradient: RadialGradient(
                center: const Alignment(0.9, -0.7),
                radius: 1.3,
                colors: [
                  first.withValues(alpha: 0.09),
                  second.withValues(alpha: 0.035),
                  Colors.transparent,
                ],
                stops: const [0, 0.5, 1],
              ),
            ),
            child: CustomPaint(
              painter: _ParticlePainter(_motion, _particles, first, second),
              child: const SizedBox.expand(),
            ),
          ),
        ),
      ),
    );
  }
}

typedef _Particle = ({
  Offset ring,
  Offset radar,
  Offset document,
  double depth,
});

List<_Particle> _makeParticles() {
  final random = math.Random(42);
  return List.generate(650, (index) {
    final angle = random.nextDouble() * math.pi * 2;
    final tube = random.nextDouble() * math.pi * 2;
    final radius = 0.7 + 0.22 * math.cos(tube);
    final ring = Offset(
      radius * math.cos(angle),
      radius * math.sin(angle) * 0.65 + 0.16 * math.sin(tube),
    );
    final radarRadius = 0.2 + (index % 4) * 0.22;
    final radar = Offset(
      radarRadius * math.cos(angle),
      radarRadius * math.sin(angle),
    );
    final t = random.nextDouble();
    final document = switch (index % 4) {
      0 => Offset(-0.55, t * 1.6 - 0.8),
      1 => Offset(0.55, t * 1.6 - 0.8),
      2 => Offset(t * 1.1 - 0.55, random.nextBool() ? -0.8 : 0.8),
      _ => Offset(t * 0.8 - 0.4, (index % 9) * 0.15 - 0.6),
    };
    return (
      ring: ring,
      radar: radar,
      document: document,
      depth: random.nextDouble(),
    );
  });
}

class _ParticlePainter extends CustomPainter {
  _ParticlePainter(this.motion, this.particles, this.first, this.second)
    : super(repaint: motion);

  final Animation<double> motion;
  final List<_Particle> particles;
  final Color first;
  final Color second;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width * 0.7, 390.0);
    final center = Offset(size.width * 0.86, math.min(size.height * 0.25, 260));
    final phase = motion.value * 3;
    final stage = phase.floor() % 3;
    // Hold each silhouette before morphing, like the web login's auto-cycle.
    final blend = Curves.easeInOut.transform(
      ((phase % 1 - 0.55) / 0.45).clamp(0.0, 1.0),
    );
    final rotation = motion.value * math.pi * 0.3 - 0.3;
    final paint = Paint();
    for (final particle in particles) {
      final shapes = [particle.ring, particle.radar, particle.document];
      final point = Offset.lerp(shapes[stage], shapes[(stage + 1) % 3], blend)!;
      final rotated = Offset(
        point.dx * math.cos(rotation) - point.dy * math.sin(rotation),
        point.dx * math.sin(rotation) + point.dy * math.cos(rotation),
      );
      paint.color = Color.lerp(
        first,
        second,
        particle.depth,
      )!.withValues(alpha: 0.16 + particle.depth * 0.42);
      canvas.drawCircle(
        center + rotated * scale,
        0.6 + particle.depth * 0.8,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_ParticlePainter oldDelegate) =>
      oldDelegate.first != first ||
      oldDelegate.second != second ||
      oldDelegate.motion != motion ||
      oldDelegate.particles != particles;
}
