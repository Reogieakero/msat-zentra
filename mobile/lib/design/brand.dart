// Zentra brand mark — shared logo widget.
// The source art (assets/zentra.png) is dark-on-white, so it always
// sits on a white rounded tile (6px, 1px border in dark) in both themes.
// Never place the raw dark mark directly on dark surfaces.

import 'dart:convert';

import 'package:flutter/material.dart';

class ZLogo extends StatelessWidget {
  final double size;
  final double radius;
  const ZLogo({super.key, this.size = 28, this.radius = 6});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(radius),
        border: isDark ? Border.all(color: theme.colorScheme.outline) : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: Image.asset(
        'assets/zentra.png',
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (context, _, _) => Icon(Icons.school_outlined, size: size * 0.6, color: theme.colorScheme.primary),
      ),
    );
  }
}

/// Circular avatar variant for chat/composer surfaces.
class ZLogoAvatar extends StatelessWidget {
  final double radius;
  const ZLogoAvatar({super.key, this.radius = 14});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        border: isDark ? Border.all(color: theme.colorScheme.outline) : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: Image.asset(
        'assets/zentra.png',
        fit: BoxFit.contain,
        errorBuilder: (context, _, _) => Icon(Icons.pets, size: radius, color: theme.colorScheme.primary),
      ),
    );
  }
}

/// Teacher profile photo — web topbar rule: photoUrl wins, fallback is the
/// generic person icon (not initials). Handles data URLs (camera uploads)
/// via memory image and remote URLs via network image.
class TeacherAvatar extends StatelessWidget {
  final String? photoUrl;
  final double radius;
  const TeacherAvatar({super.key, required this.photoUrl, this.radius = 16});

  @override
  Widget build(BuildContext context) {
    final url = photoUrl;
    Widget? image;
    if (url != null && url.isNotEmpty) {
      if (url.startsWith('data:image')) {
        try {
          final bytes = base64Decode(url.split(',').last);
          image = Image.memory(bytes, fit: BoxFit.cover, errorBuilder: (context, _, _) => const Icon(Icons.person_outline));
        } catch (_) {
          image = null;
        }
      } else {
        image = Image.network(url, fit: BoxFit.cover, errorBuilder: (context, _, _) => const Icon(Icons.person_outline));
      }
    }
    return CircleAvatar(
      radius: radius,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
      child: image == null
          ? Icon(Icons.person_outline, size: radius, color: Theme.of(context).colorScheme.onSurfaceVariant)
          : ClipOval(child: SizedBox(width: radius * 2, height: radius * 2, child: image)),
    );
  }
}

/// Bama's profile picture — the penguin avatar, used everywhere Bama speaks
/// in the chat thread (welcome hero, message bubbles, typing row). The art
/// is self-contained in a circle, so it clips cleanly with no tile.
class BamaAvatar extends StatelessWidget {
  final double radius;
  const BamaAvatar({super.key, this.radius = 14});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Theme.of(context).colorScheme.surfaceContainerLow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Image.asset(
        'assets/bama.png',
        fit: BoxFit.cover,
        errorBuilder: (context, _, _) => Icon(Icons.pets, size: radius, color: Theme.of(context).colorScheme.primary),
      ),
    );
  }
}
