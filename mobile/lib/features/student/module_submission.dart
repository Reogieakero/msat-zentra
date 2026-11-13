import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../services/portal_service.dart';
import '../../shared/models.dart';
import '../../shared/user_messages.dart';

class ModuleSubmissionSheet extends ConsumerStatefulWidget {
  final PortalModule module;
  const ModuleSubmissionSheet({super.key, required this.module});

  @override
  ConsumerState<ModuleSubmissionSheet> createState() => _ModuleSubmissionSheetState();
}

class _ModuleSubmissionSheetState extends ConsumerState<ModuleSubmissionSheet> {
  final _link = TextEditingController();
  String _kind = 'link';
  XFile? _photo;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _link.text = widget.module.submissionUrl ?? '';
  }

  @override
  void dispose() {
    _link.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final url = Uri.tryParse(_link.text.trim());
    if (_kind == 'link' && (url == null || !['http', 'https'].contains(url.scheme) || url.host.isEmpty)) {
      setState(() => _error = 'Enter a valid http or https link.');
      return;
    }
    if (_kind == 'photo' && _photo == null) {
      setState(() => _error = 'Choose a photo of your answer.');
      return;
    }
    setState(() { _busy = true; _error = null; });
    final api = ref.read(apiClientProvider);
    final path = '/api/student/modules/${widget.module.id}/submission';
    try {
      if (_kind == 'link') {
        await api.dio.put(path, data: {'submissionUrl': _link.text.trim()});
      } else if (_kind == 'physical') {
        await api.dio.post('$path/physical');
      } else {
        final photo = _photo!;
        final bytes = await photo.readAsBytes();
        if (bytes.length > 10 * 1024 * 1024) throw ApiException('FILE_TOO_LARGE', 'Choose a photo smaller than 10 MB.');
        await api.dio.post('$path/upload', data: FormData.fromMap({
          'kind': 'file',
          'file': MultipartFile.fromBytes(bytes, filename: photo.name),
        }));
      }
      if (!mounted) return;
      ref.invalidate(studentModulesProvider);
      ref.invalidate(studentHomeProvider);
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = userMessage(e, fallback: 'We couldn’t submit your answer. Please try again.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.viewInsetsOf(context).bottom + 24),
    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(widget.module.moduleName, style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 12),
      SegmentedButton<String>(
        segments: const [
          ButtonSegment(value: 'link', label: Text('Link')),
          ButtonSegment(value: 'photo', label: Text('Photo')),
          ButtonSegment(value: 'physical', label: Text('In person')),
        ],
        selected: {_kind}, showSelectedIcon: false,
        onSelectionChanged: _busy ? null : (value) => setState(() { _kind = value.first; _error = null; }),
      ),
      const SizedBox(height: 12),
      if (_kind == 'link') TextField(controller: _link, enabled: !_busy, decoration: const InputDecoration(labelText: 'Answered module link'), keyboardType: TextInputType.url),
      if (_kind == 'photo') OutlinedButton.icon(
        icon: const Icon(Icons.photo_outlined), label: Text(_photo?.name ?? 'Choose answer photo'),
        onPressed: _busy ? null : () async {
          try {
            final photo = await ImagePicker().pickImage(source: ImageSource.gallery);
            if (mounted && photo != null) setState(() => _photo = photo);
          } catch (e) {
            if (mounted) setState(() => _error = userMessage(e, fallback: 'We couldn’t open your photos. Please try again.'));
          }
        },
      ),
      if (_kind == 'physical') const Text('Confirm that you have handed the answered module to your adviser in person.'),
      if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
      const SizedBox(height: 16),
      FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? 'Submitting…' : 'Submit answer')),
    ]),
  );
}
