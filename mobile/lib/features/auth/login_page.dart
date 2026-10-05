// Login page — POST /api/auth/login {email,password,role:'staff'}.
// Both Adviser + Subject Teacher log in here; concrete role comes from backend.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/session.dart';

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
    if (ok) {
      context.go('/term');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Zentra — Staff Login')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          TextField(controller: _email, decoration: const InputDecoration(labelText: 'Email'), keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          TextField(controller: _pass, decoration: const InputDecoration(labelText: 'Password'), obscureText: true, onSubmitted: (_) => _submit()),
          if (auth.error != null) ...[
            const SizedBox(height: 8),
            Text(auth.error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 16),
          FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? 'Signing in…' : 'Sign in')),
          const SizedBox(height: 8),
          const Text('Advisers and Subject Teachers sign in with staff accounts.', style: TextStyle(color: Colors.grey)),
        ]),
      ),
    );
  }
}
