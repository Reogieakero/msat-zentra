import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widget_previews.dart';

import '../../design/brand.dart';
import '../../shared/spinner.dart';
import 'login_background.dart';

const authInk = Color(0xfff3f7f5);
const authMuted = Color(0xff99aaa3);
const authMint = Color(0xff7ef5d0);
const authPanel = Color(0xff070d0b);
const authBorder = Color(0xff2a3530);

// Scoped to the sign-in hand-off. Workspace themes and loaders stay unchanged.
class AuthFlowScaffold extends StatelessWidget {
  const AuthFlowScaffold({
    super.key,
    required this.child,
    this.centerContent = false,
  });

  final Widget child;
  final bool centerContent;

  Widget _fitContent(Widget content) =>
      centerContent ? IntrinsicHeight(child: content) : content;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context);
    final theme = base.copyWith(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xff050807),
      colorScheme: const ColorScheme.dark(
        primary: authMint,
        onPrimary: Color(0xff08110e),
        surface: authPanel,
        onSurface: authInk,
        onSurfaceVariant: authMuted,
        outline: authBorder,
        error: Color(0xffff9f9f),
      ),
      textTheme: base.textTheme.apply(
        bodyColor: authInk,
        displayColor: authInk,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          foregroundColor: const Color(0xff08110e),
          backgroundColor: authInk,
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        ),
      ),
    );
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Theme(
        data: theme,
        child: Scaffold(
          body: Stack(
            children: [
              const Positioned.fill(child: LoginBackground(amber: false)),
              SafeArea(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          minHeight: math.max(0, constraints.maxHeight - 40),
                        ),
                        child: _fitContent(
                          Column(
                            children: [
                              ConstrainedBox(
                                constraints: const BoxConstraints(
                                  maxWidth: 1040,
                                ),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: authPanel.withValues(alpha: 0.9),
                                    border: Border.all(color: authBorder),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Row(
                                    children: [
                                      ZLogo(size: 28),
                                      SizedBox(width: 9),
                                      Text(
                                        'Zentra',
                                        style: TextStyle(
                                          fontSize: 17,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 40),
                              if (centerContent)
                                Expanded(
                                  child: Center(
                                    key: const ValueKey('auth-flow-center'),
                                    child: ConstrainedBox(
                                      constraints: const BoxConstraints(
                                        maxWidth: 900,
                                      ),
                                      child: child,
                                    ),
                                  ),
                                )
                              else
                                ConstrainedBox(
                                  constraints: const BoxConstraints(
                                    maxWidth: 900,
                                  ),
                                  child: child,
                                ),
                              const SizedBox(height: 32),
                              const Text(
                                'Mati School of Arts and Trades',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: authMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Fixed-width rotating arc, like the web's Loader2, instead of Material's
// expanding/contracting progress animation. No artificial progress percentage.
class AuthSpinner extends ZSpinner {
  const AuthSpinner({super.key, super.size, super.color});
}

class AuthLoading extends StatelessWidget {
  const AuthLoading({super.key, required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    label: label,
    child: ExcludeSemantics(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const AuthSpinner(),
            const SizedBox(width: 12),
            Flexible(
              child: Text(
                label,
                style: const TextStyle(color: authMuted, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

@Preview(
  name: 'Preparing workspace · phone',
  group: 'Authentication',
  size: Size(390, 844),
)
@Preview(
  name: 'Preparing workspace · wide',
  group: 'Authentication',
  size: Size(1200, 800),
)
Widget authLoadingPreview() => const MaterialApp(
  home: AuthFlowScaffold(
    centerContent: true,
    child: AuthLoading(label: 'Preparing workspace…'),
  ),
);
