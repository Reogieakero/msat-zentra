// Signature block — web OcForm01PreviewDialog parity (mobile-native).
// States mirror frontend/src/components/ocform01/OcForm01PreviewDialog.tsx:
// Create my signature | Apply my signature + Replace | Remove (2-tap confirm),
// with saving/applying spinners and an inline sign error line.

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:signature/signature.dart';

import '../../shared/widgets.dart';
import 'anecdotal_data.dart';

/// Drawn sign-off from the detail payload (`signature: {by, at, imageUrl}`),
/// with fallbacks for the legacy mobile keys
/// (`signedBy/signedAt + signature.imageUrl/signatureImageUrl`).
class RecordSignature {
  final String by;
  final String at;
  final String imageUrl;
  const RecordSignature({required this.by, required this.at, required this.imageUrl});
}

RecordSignature? recordSignatureOf(Map<String, dynamic> detail) {
  final sig = detail['signature'];
  if (sig is Map) {
    final url = sig['imageUrl']?.toString() ?? '';
    if (url.isNotEmpty) {
      return RecordSignature(
        by: sig['by']?.toString() ?? detail['signedBy']?.toString() ?? 'Adviser',
        at: sig['at']?.toString() ?? detail['signedAt']?.toString() ?? '',
      imageUrl: url,
      );
    }
  }
  final direct = detail['signatureImageUrl']?.toString() ?? '';
  if (direct.isNotEmpty) {
    return RecordSignature(
      by: detail['signedBy']?.toString() ?? 'Adviser',
      at: detail['signedAt']?.toString() ?? '',
      imageUrl: direct,
    );
  }
  return null;
}

ImageProvider? signatureImageOf(String? url) {
  if (url == null || url.isEmpty) return null;
  if (url.startsWith('data:image')) {
    try {
      return MemoryImage(base64Decode(url.split(',').last));
    } catch (_) {
      return null;
    }
  }
  return NetworkImage(url);
}

class SignatureBlock extends ConsumerStatefulWidget {
  final String recordId;
  final bool canSign;
  final RecordSignature? signature;
  final VoidCallback onChanged;
  const SignatureBlock({
    super.key,
    required this.recordId,
    required this.canSign,
    required this.signature,
    required this.onChanged,
  });

  @override
  ConsumerState<SignatureBlock> createState() => _SignatureBlockState();
}

class _SignatureBlockState extends ConsumerState<SignatureBlock> {
  final _pad = SignatureController(penStrokeWidth: 3, exportBackgroundColor: const Color(0x00000000));
  bool _signing = false;
  bool _saving = false;
  bool _applying = false;
  bool _mySigLoading = true;
  bool _confirmingRemove = false;
  String? _signError;
  String? _mySignatureUrl;

  @override
  void initState() {
    super.initState();
    _loadMine();
  }

  @override
  void dispose() {
    _pad.dispose();
    super.dispose();
  }

  Future<void> _loadMine() async {
    if (!widget.canSign) {
      if (mounted) setState(() => _mySigLoading = false);
      return;
    }
    setState(() => _mySigLoading = true);
    try {
      final url = await fetchMySignature(ref);
      if (mounted) setState(() => _mySignatureUrl = (url?.isEmpty ?? true) ? null : url);
    } catch (_) {
      // The pad stays available — saving a signature fixes this too (web parity).
      if (mounted) setState(() => _mySignatureUrl = null);
    } finally {
      if (mounted) setState(() => _mySigLoading = false);
    }
  }

  Future<void> _saveDrawn() async {
    if (_pad.isEmpty || _saving) return;
    setState(() {
      _saving = true;
      _signError = null;
    });
    try {
      final bytes = await _pad.toPngBytes();
      if (bytes == null) {
        if (mounted) setState(() => _saving = false);
        return;
      }
      await saveMySignature(ref, 'data:image/png;base64,${base64Encode(bytes)}');
      final url = await fetchMySignature(ref);
      if (!mounted) return;
      setState(() {
        _mySignatureUrl = (url?.isEmpty ?? true) ? null : url;
        _signing = false;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Signature saved.')));
    } on DioException catch (e) {
      if (mounted) setState(() => _signError = anecdotalError(e, 'Your signature could not be saved. Try drawing again.'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _apply() async {
    if (_applying) return;
    setState(() {
      _applying = true;
      _signError = null;
    });
    try {
      await applyMySignature(ref, widget.recordId);
      widget.onChanged();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Signature applied.')));
    } on DioException catch (e) {
      if (mounted) setState(() => _signError = anecdotalError(e, 'Your signature could not be applied. Try again.'));
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  Future<void> _remove() async {
    if (!_confirmingRemove) {
      setState(() => _confirmingRemove = true);
      return;
    }
    setState(() => _confirmingRemove = false);
    try {
      await removeRecordSignature(ref, widget.recordId);
      widget.onChanged();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Signature removed.')));
    } on DioException catch (e) {
      if (!mounted) return;
      // Web surfaces remove failures on the dialog error line.
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(anecdotalError(e, 'The signature could not be removed. Try again.'))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sig = widget.signature;
    return ZCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Signature', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        if (sig != null) ...[
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(4)),
                child: Text('Signed',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: theme.colorScheme.onPrimary)),
              ),
              Text(
                sig.at.isEmpty ? sig.by : '${sig.by} · ${sig.at.length >= 10 ? sig.at.substring(0, 10) : sig.at}',
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
          const SizedBox(height: 8),
        ],
        if (_signing) ...[
          Container(
            height: 160,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: theme.colorScheme.outline),
            ),
            child: Signature(controller: _pad, backgroundColor: theme.colorScheme.surface),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _saving
                    ? null
                    : () => setState(() {
                          _signing = false;
                          _signError = null;
                        }),
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                onPressed: _saving ? null : _saveDrawn,
                child: Text(_saving ? 'Saving…' : 'Save signature'),
              ),
            ),
          ]),
        ] else if (widget.canSign && sig == null && _mySignatureUrl != null) ...[
          Row(children: [
            Expanded(
              child: FilledButton.icon(
                icon: const Icon(Icons.draw_outlined, size: 16),
                onPressed: _applying ? null : _apply,
                label: Text(_applying ? 'Applying…' : 'Apply my signature'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() {
                  _signError = null;
                  _signing = true;
                  _pad.clear();
                }),
                child: const Text('Replace'),
              ),
            ),
          ]),
          const SizedBox(height: 8),
          _MinePreview(url: _mySignatureUrl),
        ] else if (widget.canSign && sig == null && _mySignatureUrl == null && !_mySigLoading) ...[
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.draw_outlined, size: 16),
              onPressed: () => setState(() {
                _signError = null;
                _signing = true;
                _pad.clear();
              }),
              label: const Text('Create my signature'),
            ),
          ),
        ] else if (widget.canSign && sig == null && _mySigLoading) ...[
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 4),
            child: ZSkeletonList(count: 1),
          ),
        ] else if (widget.canSign && sig != null) ...[
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFDC2626)),
              icon: const Icon(Icons.delete_outline, size: 16),
              onPressed: _remove,
              onLongPress: () => setState(() => _confirmingRemove = false),
              label: Text(_confirmingRemove ? 'Confirm remove' : 'Remove signature'),
            ),
          ),
        ] else ...[
          _MinePreview(url: _mySignatureUrl),
        ],
        if (_signError != null) ...[
          const SizedBox(height: 6),
          Text(_signError!, style: TextStyle(fontSize: 12, color: theme.colorScheme.error)),
        ],
        if (!widget.canSign) ...[
          const SizedBox(height: 6),
          Text('Only the section adviser or observing teacher can sign.', style: theme.textTheme.bodySmall),
        ],
      ]),
    );
  }
}

class _MinePreview extends StatelessWidget {
  final String? url;
  const _MinePreview({required this.url});

  @override
  Widget build(BuildContext context) {
    final img = signatureImageOf(url);
    if (img == null) {
      return Text('No saved signature yet.', style: Theme.of(context).textTheme.bodySmall);
    }
    return Image(image: img, height: 72, errorBuilder: (context, _, _) => const Icon(Icons.draw_outlined));
  }
}
