// Login — web-matched monochrome card, h-32px controls, Inter.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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

  Future<void> _submit() async {
    setState(() => _busy = true);
    final ok = await ref.read(authProvider.notifier).login(email: _email.text.trim(), password: _pass.text);
    setState(() => _busy = false);
    if (!mounted) return;
    if (ok) context.go('/term');
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
                  Text('Staff workspace — Advisers and Subject Teachers sign in with staff accounts.',
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
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
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
