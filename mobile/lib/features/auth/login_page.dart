// Login — web-matched monochrome card, h-32px controls, Inter.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/session.dart';
import '../../design/brand.dart';
import '../../shared/widgets.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});
  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _email = TextEditingController();
  final _pass = TextEditingController();
  bool _busy = false;
  bool _googleBusy = false;
  String _portal = 'staff';

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      final ok = await ref.read(authProvider.notifier).login(
            email: _email.text.trim(),
            password: _pass.text,
            portal: _portal,
          );
      if (!mounted) return;
      if (ok) context.go(_portal == 'staff' ? '/term' : '/$_portal/home');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _googleSignIn() async {
    setState(() => _googleBusy = true);
    try {
      final ok = await launchUrl(
        Uri.parse('${AppConfig.apiBaseUrl}/api/auth/google?role=$_portal'),
        mode: LaunchMode.externalApplication,
      );
      if (!mounted || ok) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open Google sign-in.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open Google sign-in.')),
      );
    } finally {
      if (mounted) setState(() => _googleBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: ZCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Center(child: ZLogo(size: 64, radius: 12)),
                  const SizedBox(height: 12),
                  const Text('Zentra', textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: -0.4)),
                  const SizedBox(height: 4),
                  Text(
                    _portal == 'staff'
                        ? 'Staff workspace — Advisers and Subject Teachers sign in with staff accounts.'
                        : _portal == 'student'
                            ? 'Student portal — view your grades, attendance, schedule, and modules.'
                            : 'Parent portal — follow your linked child\'s progress.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 16),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'staff', label: Text('Staff')),
                      ButtonSegment(value: 'student', label: Text('Student')),
                      ButtonSegment(value: 'parent', label: Text('Parent')),
                    ],
                    selected: {_portal},
                    onSelectionChanged: _busy
                        ? null
                        : (value) => setState(() => _portal = value.first),
                    showSelectedIcon: false,
                  ),
                  const SizedBox(height: 16),
                  TextField(controller: _email, decoration: const InputDecoration(labelText: 'Email'), keyboardType: TextInputType.emailAddress),
                  const SizedBox(height: 12),
                  TextField(controller: _pass, decoration: const InputDecoration(labelText: 'Password'), obscureText: true, onSubmitted: (_) => _submit()),
                  if (auth.error != null) ...[
                    const SizedBox(height: 8),
                    Text(auth.error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13)),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? 'Signing in…' : 'Sign in')),
                  const SizedBox(height: 16),
                  Row(children: [
                    const Expanded(child: Divider(height: 1)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        'OR',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                    const Expanded(child: Divider(height: 1)),
                  ]),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: (_busy || _googleBusy) ? null : _googleSignIn,
                    icon: SvgPicture.string(_googleLogoSvg, width: 16, height: 16),
                    label: const Text('Sign in with Google'),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// Same four-color "G" as the web login button (LoginForm.tsx GoogleIcon).
const _googleLogoSvg = '''
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>
''';
