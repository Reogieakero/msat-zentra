// Teacher Settings — web parity with frontend/src/app/teacher/settings.
// Sections: Profile (photo + name), Adviser claim/release, Master Teacher,
// Appearance (Light/Dark/System, local), Palette (server-persisted), Password.
// Served at the existing /teacher/more path (drawer + avatar point there).

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/session.dart';
import '../../design/brand.dart';
import '../../design/theme_mode.dart';
import '../../shared/widgets.dart';
import 'settings_data.dart';

const _primaryPresets = ['#7c3aed', '#2563eb', '#0d9488', '#16a34a', '#d97706', '#ea580c', '#e11d48', '#db2777'];
const _secondaryPresets = ['#27272a', '#3f3f46', '#52525b', '#a1a1aa', '#e4e4e7', '#f4f4f5', '#fef3c7', '#ede9fe'];

Color? _swatch(String hex) => hexToColor(hex);

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});
  @override
  ConsumerState<SettingsPage> createState() => _State();
}

class _State extends ConsumerState<SettingsPage> {
  final _name = TextEditingController();
  bool _nameInit = false;
  bool _pickingSection = false;
  String? _selectedSection;
  bool _mtBusy = false;
  bool _photoBusy = false;
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  String? _passError;
  bool _passBusy = false;

  @override
  void dispose() {
    _name.dispose();
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final file = await ImagePicker().pickImage(source: source, maxWidth: 1024, imageQuality: 85);
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    if (bytes.length > 2 * 1024 * 1024) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Photo must be 2MB or smaller.')));
      return;
    }
    final ext = file.path.split('.').last.toLowerCase();
    final mime = ext == 'png' ? 'image/png' : 'image/jpeg';
    setState(() => _photoBusy = true);
    try {
      await uploadTeacherPhoto(ref, 'data:$mime;base64,${base64Encode(bytes)}');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile photo updated.')));
    } on DioException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(settingsError(e, 'Could not update photo.'))));
    } finally {
      if (mounted) setState(() => _photoBusy = false);
    }
  }

  void _choosePhotoSource() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text('Take photo', style: TextStyle(fontSize: 13)),
            onTap: () {
              Navigator.pop(ctx);
              _pickPhoto(ImageSource.camera);
            },
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Choose from gallery', style: TextStyle(fontSize: 13)),
            onTap: () {
              Navigator.pop(ctx);
              _pickPhoto(ImageSource.gallery);
            },
          ),
        ]),
      ),
    );
  }

  Future<void> _saveName() async {
    final value = _name.text.trim();
    if (value.isEmpty || value.length > 100) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Name must be 1–100 characters.')));
      return;
    }
    try {
      await patchTeacherProfile(ref, {'fullName': value});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated.')));
    } on DioException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(settingsError(e, 'Could not update profile.'))));
    }
  }

  Future<void> _toggleMaster(bool next, {required bool takenByOther, String? holderName}) async {
    if (next && takenByOther) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(holderName != null ? 'Master Teacher is currently designated by $holderName.' : 'Master Teacher is currently designated.')));
      return;
    }
    setState(() => _mtBusy = true);
    try {
      await setMasterTeacher(ref, next);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(next ? 'Master Teacher enabled.' : 'Master Teacher disabled.')));
    } on DioException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(settingsError(e, 'Could not update status.'))));
    } finally {
      if (mounted) setState(() => _mtBusy = false);
    }
  }

  Future<void> _savePassword() async {
    if (_next.text.length < 8) {
      setState(() => _passError = 'New password must be at least 8 characters.');
      return;
    }
    if (_next.text != _confirm.text) {
      setState(() => _passError = 'New passwords do not match.');
      return;
    }
    setState(() {
      _passError = null;
      _passBusy = true;
    });
    try {
      await changePassword(ref, currentPassword: _current.text, newPassword: _next.text);
      _current.clear();
      _next.clear();
      _confirm.clear();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password updated. Use your new password next time you sign in.')));
    } on DioException catch (e) {
      setState(() => _passError = settingsError(e, 'Failed to update password.'));
    } finally {
      if (mounted) setState(() => _passBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Keep the locally cached palette in sync with the server profile.
    ref.listen(teacherProfileProvider, (_, next) {
      next.maybeWhen(
        data: (p) => ref.read(themeSettingsProvider.notifier).syncPalette(p.primaryColor, p.secondaryColor),
        orElse: () {},
      );
    });
    final profile = ref.watch(teacherProfileProvider);
    return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 80), children: [
      Text('Settings', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
      Text('Your profile, appearance, and account security.', style: theme.textTheme.bodySmall),
      const SizedBox(height: 12),
      profile.when(
        loading: () => const ZSkeletonList(count: 2),
        error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(teacherProfileProvider)),
        data: (p) {
          if (!_nameInit) {
            _name.text = p.fullName;
            _nameInit = true;
          }
          return Column(children: [
            _section(
              context,
              title: 'Profile',
              subtitle: 'Your display name and photo.',
              child: Column(children: [
                Row(children: [
                  TeacherAvatar(photoUrl: p.photoUrl, radius: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: _photoBusy ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.photo_camera_outlined, size: 16),
                      label: Text(_photoBusy ? 'Uploading…' : 'Change photo'),
                      onPressed: _photoBusy ? null : _choosePhotoSource,
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                TextField(controller: _name, decoration: const InputDecoration(labelText: 'Full name'), maxLength: 100),
                const SizedBox(height: 8),
                Align(alignment: Alignment.centerRight, child: FilledButton(onPressed: _saveName, child: const Text('Save profile'))),
              ]),
            ),
            const SizedBox(height: 8),
            _AdviserCard(
              picking: _pickingSection,
              selected: _selectedSection,
              onPicking: (v) => setState(() {
                _pickingSection = v;
                if (!v) _selectedSection = null;
              }),
              onSelect: (id) => setState(() => _selectedSection = id),
            ),
            const SizedBox(height: 8),
            _MasterTeacherCard(
              busy: _mtBusy,
              onToggle: (next, {required takenByOther, holderName}) => _toggleMaster(next, takenByOther: takenByOther, holderName: holderName),
            ),
            const SizedBox(height: 8),
            _section(
              context,
              title: 'Appearance',
              subtitle: 'Applies instantly across the whole workspace.',
              child: _ThemePicker(),
            ),
            const SizedBox(height: 8),
            _PaletteCard(profile: p),
            const SizedBox(height: 8),
            _section(
              context,
              title: 'Password',
              subtitle: 'Choose a new password at least 8 characters long.',
              child: Column(children: [
                TextField(controller: _current, decoration: const InputDecoration(labelText: 'Current password'), obscureText: true),
                const SizedBox(height: 8),
                TextField(controller: _next, decoration: const InputDecoration(labelText: 'New password'), obscureText: true),
                const SizedBox(height: 8),
                TextField(controller: _confirm, decoration: const InputDecoration(labelText: 'Confirm new password'), obscureText: true),
                if (_passError != null) ...[
                  const SizedBox(height: 4),
                  Text(_passError!, style: TextStyle(color: theme.colorScheme.error, fontSize: 13)),
                ],
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton(onPressed: _passBusy ? null : _savePassword, child: Text(_passBusy ? 'Saving…' : 'Update password')),
                ),
              ]),
            ),
          ]);
        },
      ),
      const SizedBox(height: 8),
      const ZCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Grade flags', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          SizedBox(height: 4),
          Text('Raise and resolve flags inside each class workspace. Overdue flags escalate to the Principal.', style: TextStyle(fontSize: 13)),
        ]),
      ),
    ]);
  }

  static Widget _section(BuildContext context, {required String title, required String subtitle, required Widget child}) => ZCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 12),
          child,
        ]),
      );
}

class _ThemePicker extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeSettingsProvider).mode;
    String selected = switch (mode) { ThemeMode.light => 'light', ThemeMode.dark => 'dark', _ => 'system' };
    return SegTabs<String>(
      values: const ['light', 'dark', 'system'],
      labels: const ['Light', 'Dark', 'System'],
      selected: selected,
      onChanged: (v) => ref.read(themeSettingsProvider.notifier).setMode(switch (v) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      }),
    );
  }
}

class _PaletteCard extends ConsumerWidget {
  final TeacherProfile profile;
  const _PaletteCard({required this.profile});

  Future<void> _apply(WidgetRef ref, BuildContext context, {String? primary, String? secondary, bool keepPrimary = true}) async {
    final nextPrimary = keepPrimary ? (primary ?? profile.primaryColor) : primary;
    final nextSecondary = keepPrimary ? (secondary ?? profile.secondaryColor) : secondary;
    try {
      await patchTeacherProfile(ref, {'primaryColor': nextPrimary, 'secondaryColor': nextSecondary});
      await ref.read(themeSettingsProvider.notifier).syncPalette(nextPrimary, nextSecondary);
    } on DioException catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(settingsError(e, 'Could not update palette.'))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Widget swatches(List<String> presets, String? selected, ValueChanged<String> onPick) => Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final hex in presets)
              InkWell(
                borderRadius: BorderRadius.circular(999),
                onTap: () => onPick(hex),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _swatch(hex),
                    border: Border.all(
                      color: selected == hex ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.outline,
                      width: selected == hex ? 3 : 1,
                    ),
                  ),
                ),
              ),
          ],
        );
    return _State._section(
      context,
      title: 'Workspace palette',
      subtitle: 'Paints cards, buttons, and accents across your workspace.',
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Primary', style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: 6),
        swatches(_primaryPresets, profile.primaryColor, (hex) => _apply(ref, context, primary: hex)),
        const SizedBox(height: 12),
        Text('Secondary', style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: 6),
        swatches(_secondaryPresets, profile.secondaryColor, (hex) => _apply(ref, context, secondary: hex)),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: OutlinedButton(
            onPressed: () async {
              await _apply(ref, context, primary: null, secondary: null, keepPrimary: false);
            },
            child: const Text('Reset to default'),
          ),
        ),
      ]),
    );
  }
}

class _AdviserCard extends ConsumerWidget {
  final bool picking;
  final String? selected;
  final ValueChanged<bool> onPicking;
  final ValueChanged<String> onSelect;
  const _AdviserCard({required this.picking, required this.selected, required this.onPicking, required this.onSelect});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final overview = ref.watch(overviewProvider);
    final sections = ref.watch(adviserSectionsProvider);
    final isAdviser = overview.maybeWhen(data: (d) => d['isAdviser'] == true, orElse: () => false);
    final advisoryName = overview.maybeWhen(data: (d) => d['advisorySection']?['name']?.toString(), orElse: () => null);
    return _State._section(
      context,
      title: 'Adviser',
      subtitle: 'Pick your section from the master teacher\u2019s schedule.',
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(isAdviser && advisoryName != null ? 'Adviser of $advisoryName' : 'Not an adviser',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        if (!isAdviser) Text('Only Overview, Workspace and Settings show until you claim a section.', style: theme.textTheme.bodySmall),
        const SizedBox(height: 8),
        sections.when(
          loading: () => const Text('Loading sections…', style: TextStyle(fontSize: 13)),
          error: (e, _) => Text(e.toString(), style: TextStyle(color: theme.colorScheme.error, fontSize: 13)),
          data: (list) {
            final mine = list.where((s) => s.advisedByMe).toList();
            return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (mine.isNotEmpty)
                for (final s in mine)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(children: [
                      Expanded(child: Text(s.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                      TextButton(
                        onPressed: () async {
                          try {
                            await releaseAdvisorySection(ref, s.id);
                            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Advisory released.')));
                          } on DioException catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(settingsError(e, 'Could not release.'))));
                            }
                          }
                        },
                        child: const Text('Release', style: TextStyle(fontSize: 13)),
                      ),
                    ]),
                  ),
              if (picking) ...[
                for (final s in list)
                  Builder(builder: (_) {
                    final selectable = s.claimable || s.advisedByMe;
                    final isSel = selected == s.id;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          alignment: Alignment.centerLeft,
                          side: BorderSide(color: isSel ? theme.colorScheme.primary : theme.colorScheme.outline, width: isSel ? 2 : 1),
                        ),
                        onPressed: selectable ? () => onSelect(s.id) : null,
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(s.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          Text(
                            'Grade ${s.gradeNumber}${s.adviserLabel.isNotEmpty ? ' · Listed as "${s.adviserLabel}"' : ''} · ${!selectable ? (s.holderName != null ? 'Advised by ${s.holderName}' : 'Already claimed') : (isSel ? 'Selected' : 'Select this section')}',
                            style: theme.textTheme.bodySmall,
                          ),
                        ]),
                      ),
                    );
                  }),
                Row(children: [
                  Expanded(child: OutlinedButton(onPressed: () => onPicking(false), child: const Text('Close'))),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton(
                      onPressed: selected == null
                          ? null
                          : () async {
                              try {
                                await claimAdvisorySection(ref, selected!);
                                onPicking(false);
                                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Advisory saved.')));
                              } on DioException catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(settingsError(e, 'Could not save.'))));
                                }
                              }
                            },
                      child: const Text('Save section'),
                    ),
                  ),
                ]),
              ] else
                OutlinedButton(onPressed: () => onPicking(true), child: Text(isAdviser ? 'Change section' : 'I\u2019m an adviser')),
            ]);
          },
        ),
      ]),
    );
  }
}

class _MasterTeacherCard extends ConsumerWidget {
  final bool busy;
  final void Function(bool, {required bool takenByOther, String? holderName}) onToggle;
  const _MasterTeacherCard({required this.busy, required this.onToggle});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(overviewProvider);
    return overview.maybeWhen(
      data: (d) {
        final isMaster = d['isMasterTeacher'] == true;
        final eligible = d['masterTeacherEligible'] == true;
        final taken = d['masterTeacherTaken'] == true;
        final holder = d['masterTeacherHolderName']?.toString();
        final takenByOther = !isMaster && taken;
        if (!eligible && !isMaster) return const SizedBox.shrink();
        return Column(children: [
          _State._section(
            context,
            title: 'Master Teacher',
            subtitle: 'Self-declared designation for grades 7–10 classes.',
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Master Teacher status', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  Text(
                    isMaster
                        ? 'Currently designated — only one designation at a time.'
                        : takenByOther
                            ? (holder != null ? 'Currently designated by $holder — unavailable until released.' : 'Currently designated — unavailable until released.')
                            : 'Not designated',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ]),
              ),
              if (!takenByOther)
                Switch(value: isMaster, onChanged: busy ? null : (v) => onToggle(v, takenByOther: takenByOther, holderName: holder)),
            ]),
          ),
          const SizedBox(height: 8),
        ]);
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}
