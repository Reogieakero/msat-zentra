// Web-matched auth palette and form, with mobile-sized touch targets.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/session.dart';
import '../../design/brand.dart';
import 'login_background.dart';
import 'auth_flow_ui.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});
  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _form = GlobalKey<FormState>();
  final _passwordFocus = FocusNode();
  bool _busy = false;
  bool _googleBusy = false;
  bool _showPassword = false;
  bool _amber = false;
  String? _error;
  String _portal = 'staff';

  bool get _working => _busy || _googleBusy;

  @override
  void dispose() {
    _email.dispose();
    _pass.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_working || !_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final ok = await ref
          .read(authProvider.notifier)
          .login(
            email: _email.text.trim(),
            password: _pass.text,
            portal: _portal,
          );
      if (!mounted) return;
      if (ok) {
        TextInput.finishAutofillContext();
        context.go(_portal == 'staff' ? '/term' : '/$_portal/home');
      } else {
        setState(() => _error = ref.read(authProvider).error);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not sign in. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _googleSignIn() async {
    if (_working) return;
    setState(() => _googleBusy = true);
    try {
      final ok = await launchUrl(
        Uri.parse('${AppConfig.apiBaseUrl}/api/auth/google?role=$_portal'),
        mode: LaunchMode.externalApplication,
      );
      if (!mounted || ok) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'We couldn’t open Google sign-in. Try again, or sign in with your email and password.',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'We couldn’t open Google sign-in. Try again, or sign in with your email and password.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _googleBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = _amber ? const Color(0xffffd88a) : const Color(0xff7ef5d0);
    final panel = _amber ? const Color(0xff0d0805) : const Color(0xff070d0b);
    const ink = Color(0xfff3f7f5);
    const muted = Color(0xff99aaa3);
    const border = Color(0xff2a3530);
    final base = Theme.of(context);
    final theme = base.copyWith(
      brightness: Brightness.dark,
      colorScheme: ColorScheme.dark(
        primary: accent,
        onPrimary: const Color(0xff08110e),
        surface: panel,
        onSurface: ink,
        onSurfaceVariant: muted,
        outline: border,
        error: const Color(0xffff9f9f),
      ),
      textTheme: base.textTheme.apply(bodyColor: ink, displayColor: ink),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.025),
        hintStyle: const TextStyle(color: Color(0xff718079), fontSize: 14),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 15,
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: accent),
        ),
        errorMaxLines: 2,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ink,
          foregroundColor: const Color(0xff08110e),
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ink,
          side: const BorderSide(color: border),
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        ),
      ),
    );
    final title = switch (_portal) {
      'student' => 'Student sign in',
      'parent' => 'Parent sign in',
      _ => 'Staff sign in',
    };
    final description = switch (_portal) {
      'student' =>
        'Your grades, attendance, schedule, and modules in one place.',
      'parent' => 'Stay close to your child’s progress and school updates.',
      _ => 'Your workspace for teaching, advising, and supporting learners.',
    };
    return Theme(
      data: theme,
      child: Scaffold(
        backgroundColor: panel,
        body: Stack(
          children: [
            Positioned.fill(child: LoginBackground(amber: _amber)),
            SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final wide = constraints.maxWidth >= 840;
                  return SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: (constraints.maxHeight - 40).clamp(
                          0.0,
                          double.infinity,
                        ),
                      ),
                      child: Column(
                        children: [
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 1040),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: panel.withValues(alpha: 0.9),
                                border: Border.all(color: border),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                children: [
                                  const ZLogo(size: 28),
                                  const SizedBox(width: 9),
                                  const Expanded(
                                    child: Text(
                                      'Zentra',
                                      style: TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  _paletteButton(
                                    false,
                                    const Color(0xff7ef5d0),
                                  ),
                                  _paletteButton(true, const Color(0xffffd88a)),
                                ],
                              ),
                            ),
                          ),
                          SizedBox(height: wide ? 64 : 40),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 960),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Flexible(
                                  child: ConstrainedBox(
                                    constraints: const BoxConstraints(
                                      maxWidth: 420,
                                    ),
                                    child: Container(
                                      padding: EdgeInsets.all(
                                        constraints.maxWidth < 360 ? 20 : 28,
                                      ),
                                      decoration: BoxDecoration(
                                        color: panel.withValues(alpha: 0.96),
                                        border: Border.all(color: border),
                                        borderRadius: BorderRadius.circular(12),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withValues(
                                              alpha: 0.25,
                                            ),
                                            blurRadius: 40,
                                            offset: const Offset(0, 16),
                                          ),
                                        ],
                                      ),
                                      child: AutofillGroup(
                                        child: Form(
                                          key: _form,
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.stretch,
                                            children: [
                                              Text(
                                                'WELCOME TO ZENTRA',
                                                style: TextStyle(
                                                  color: accent,
                                                  fontSize: 10,
                                                  letterSpacing: 1.8,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                              const SizedBox(height: 12),
                                              Text(
                                                title,
                                                style: const TextStyle(
                                                  fontSize: 26,
                                                  fontWeight: FontWeight.w500,
                                                  letterSpacing: -0.6,
                                                ),
                                              ),
                                              const SizedBox(height: 8),
                                              Text(
                                                description,
                                                style: const TextStyle(
                                                  color: muted,
                                                  fontSize: 13,
                                                  height: 1.6,
                                                ),
                                              ),
                                              const SizedBox(height: 24),
                                              _portalPicker(accent, border),
                                              const SizedBox(height: 24),
                                              const Text(
                                                'School email',
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                              ),
                                              const SizedBox(height: 8),
                                              TextFormField(
                                                key: const Key('login-email'),
                                                controller: _email,
                                                enabled: !_working,
                                                decoration:
                                                    const InputDecoration(
                                                      hintText: 'name@msat.edu',
                                                    ),
                                                keyboardType:
                                                    TextInputType.emailAddress,
                                                textInputAction:
                                                    TextInputAction.next,
                                                autofillHints: const [
                                                  AutofillHints.username,
                                                ],
                                                autocorrect: false,
                                                onFieldSubmitted: (_) =>
                                                    _passwordFocus
                                                        .requestFocus(),
                                                validator: (value) {
                                                  final email =
                                                      value?.trim() ?? '';
                                                  if (email.isEmpty) {
                                                    return 'Enter your school email.';
                                                  }
                                                  if (!RegExp(
                                                    r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                                                  ).hasMatch(email)) {
                                                    return 'Enter a valid email address.';
                                                  }
                                                  return null;
                                                },
                                              ),
                                              const SizedBox(height: 18),
                                              const Text(
                                                'Password',
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                              ),
                                              const SizedBox(height: 8),
                                              TextFormField(
                                                key: const Key(
                                                  'login-password',
                                                ),
                                                controller: _pass,
                                                focusNode: _passwordFocus,
                                                enabled: !_working,
                                                decoration: InputDecoration(
                                                  hintText:
                                                      'Enter your password',
                                                  suffixIcon: IconButton(
                                                    tooltip: _showPassword
                                                        ? 'Hide password'
                                                        : 'Show password',
                                                    onPressed: () => setState(
                                                      () => _showPassword =
                                                          !_showPassword,
                                                    ),
                                                    icon: Icon(
                                                      _showPassword
                                                          ? Icons
                                                                .visibility_off_outlined
                                                          : Icons
                                                                .visibility_outlined,
                                                      size: 20,
                                                    ),
                                                    color: muted,
                                                  ),
                                                ),
                                                obscureText: !_showPassword,
                                                autocorrect: false,
                                                enableSuggestions: false,
                                                autofillHints: const [
                                                  AutofillHints.password,
                                                ],
                                                textInputAction:
                                                    TextInputAction.done,
                                                onFieldSubmitted: (_) =>
                                                    _submit(),
                                                validator: (value) =>
                                                    value == null ||
                                                        value.isEmpty
                                                    ? 'Enter your password.'
                                                    : null,
                                              ),
                                              if (_error != null) ...[
                                                const SizedBox(height: 16),
                                                Semantics(
                                                  liveRegion: true,
                                                  child: Container(
                                                    padding:
                                                        const EdgeInsets.all(
                                                          12,
                                                        ),
                                                    decoration: BoxDecoration(
                                                      color: const Color(
                                                        0x19ff9f9f,
                                                      ),
                                                      border: Border.all(
                                                        color: const Color(
                                                          0x55ff9f9f,
                                                        ),
                                                      ),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            6,
                                                          ),
                                                    ),
                                                    child: Text(
                                                      _error!,
                                                      style: const TextStyle(
                                                        color: Color(
                                                          0xffff9f9f,
                                                        ),
                                                        fontSize: 13,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                              const SizedBox(height: 24),
                                              FilledButton(
                                                onPressed: _working
                                                    ? null
                                                    : _submit,
                                                child: Row(
                                                  mainAxisAlignment:
                                                      MainAxisAlignment.center,
                                                  children: [
                                                    if (_busy) ...[
                                                      const AuthSpinner(
                                                        size: 16,
                                                        color: muted,
                                                      ),
                                                      const SizedBox(width: 10),
                                                    ],
                                                    Text(
                                                      _busy
                                                          ? 'Signing in…'
                                                          : 'Sign in',
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              const SizedBox(height: 20),
                                              const Row(
                                                children: [
                                                  Expanded(
                                                    child: Divider(
                                                      color: border,
                                                    ),
                                                  ),
                                                  Padding(
                                                    padding:
                                                        EdgeInsets.symmetric(
                                                          horizontal: 14,
                                                        ),
                                                    child: Text(
                                                      'OR',
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        color: muted,
                                                        letterSpacing: 1,
                                                      ),
                                                    ),
                                                  ),
                                                  Expanded(
                                                    child: Divider(
                                                      color: border,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 20),
                                              OutlinedButton.icon(
                                                onPressed: _working
                                                    ? null
                                                    : _googleSignIn,
                                                icon: _googleBusy
                                                    ? const AuthSpinner(
                                                        size: 16,
                                                      )
                                                    : SvgPicture.string(
                                                        _googleLogoSvg,
                                                        width: 18,
                                                        height: 18,
                                                      ),
                                                label: Text(
                                                  _googleBusy
                                                      ? 'Opening Google…'
                                                      : 'Sign in with Google',
                                                ),
                                              ),
                                              const SizedBox(height: 24),
                                              const Text(
                                                'Mati School of Arts and Trades',
                                                textAlign: TextAlign.center,
                                                style: TextStyle(
                                                  color: muted,
                                                  fontSize: 11,
                                                  height: 1.5,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                if (wide) ...[
                                  const SizedBox(width: 64),
                                  Flexible(
                                    child: _workspacePreview(
                                      accent,
                                      border,
                                      panel,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),
                          const Text(
                            'One learner record. Every school day.',
                            style: TextStyle(color: muted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _paletteButton(bool amber, Color color) => Semantics(
    selected: _amber == amber,
    child: IconButton(
      tooltip: amber ? 'Amber palette' : 'Mint and violet palette',
      onPressed: () => setState(() => _amber = amber),
      icon: Container(
        width: 18,
        height: 18,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
          border: Border.all(
            color: _amber == amber ? Colors.white : Colors.transparent,
            width: 2,
          ),
        ),
      ),
    ),
  );

  Widget _portalPicker(Color accent, Color border) => Container(
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      border: Border.all(color: border),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Row(
      children: [
        for (final entry in const {
          'staff': 'Staff',
          'student': 'Student',
          'parent': 'Parent',
        }.entries)
          Expanded(
            child: Semantics(
              selected: _portal == entry.key,
              child: TextButton(
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  minimumSize: const Size(0, 48),
                  foregroundColor: _portal == entry.key
                      ? accent
                      : const Color(0xff99aaa3),
                  backgroundColor: _portal == entry.key
                      ? accent.withValues(alpha: 0.1)
                      : Colors.transparent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(5),
                  ),
                ),
                onPressed: _working
                    ? null
                    : () {
                        if (_portal == entry.key) return;
                        setState(() {
                          _portal = entry.key;
                          _error = null;
                          _showPassword = false;
                          final email = _email.text;
                          _form.currentState?.reset();
                          _email.text = email;
                          _pass.clear();
                        });
                      },
                child: Text(entry.value, style: const TextStyle(fontSize: 12)),
              ),
            ),
          ),
      ],
    ),
  );

  Widget _workspacePreview(Color accent, Color border, Color panel) {
    final (title, lines) = switch (_portal) {
      'student' => (
        'Your learner workspace',
        [
          'View your grades each term.',
          'Track attendance and your schedule.',
          'Keep up with learning modules.',
        ],
      ),
      'parent' => (
        'Stay close to your child',
        [
          'Follow grades and attendance.',
          'Stay informed about school updates.',
          'Support every step of their progress.',
        ],
      ),
      _ => (
        'Your staff workspace',
        [
          'Encode grades and manage your classes.',
          'Take attendance and write anecdotal records.',
          'Support advisees and track their progress.',
        ],
      ),
    };
    return Container(
      decoration: BoxDecoration(
        color: panel.withValues(alpha: 0.85),
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: border)),
            ),
            child: Row(
              children: [
                for (var i = 0; i < 3; i++)
                  Padding(
                    padding: const EdgeInsets.only(right: 5),
                    child: Icon(
                      Icons.circle,
                      size: 7,
                      color: accent.withValues(alpha: 0.4),
                    ),
                  ),
                const SizedBox(width: 16),
                const Text(
                  'msat.edu/zentra',
                  style: TextStyle(color: Color(0xff99aaa3), fontSize: 11),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  switch (_portal) {
                    'student' => Icons.school_outlined,
                    'parent' => Icons.people_outline,
                    _ => Icons.work_outline,
                  },
                  color: accent,
                  size: 28,
                ),
                const SizedBox(height: 20),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 20),
                for (final line in lines)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Text(
                      '•  $line',
                      style: const TextStyle(
                        color: Color(0xff99aaa3),
                        fontSize: 13,
                        height: 1.6,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
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
