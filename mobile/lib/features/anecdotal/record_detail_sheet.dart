// Record detail sheet — web OcForm01PreviewDialog parity (mobile-native).
// Full write-up, follow-ups + add, folder move, .xlsx export via share
// sheet, signature block (view mine, draw-pad create, apply, 2-tap remove).

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:signature/signature.dart';

import '../../shared/widgets.dart';
import 'anecdotal_data.dart';

class RecordDetailSheet extends ConsumerStatefulWidget {
  final MyAnecdotalRecord record;
  final ScrollController scroll;
  const RecordDetailSheet({super.key, required this.record, required this.scroll});

  @override
  ConsumerState<RecordDetailSheet> createState() => _State();
}

class _State extends ConsumerState<RecordDetailSheet> {
  Map<String, dynamic>? _detail;
  String? _error;
  bool _busy = false;
  final _followup = TextEditingController();
  bool _confirmRemoveSign = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _followup.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final d = await fetchRecordDetail(ref, widget.record.id);
      if (mounted) {
        setState(() {
          _detail = d;
          _busy = false;
        });
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _error = anecdotalError(e, 'Repository unavailable.');
          _busy = false;
        });
      }
    }
  }

  Future<void> _addFollowup() async {
    if (_followup.text.trim().isEmpty) return;
    try {
      await addRecordFollowup(ref, widget.record.id, _followup.text);
      _followup.clear();
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Follow-up added.')));
    } on DioException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(anecdotalError(e, 'Could not add follow-up.'))));
    }
  }

  Future<void> _export() async {
    try {
      final bytes = await downloadRecordExport(ref, widget.record.id);
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/GCForm-01_${widget.record.date}.xlsx';
      await File(path).writeAsBytes(Uint8List.fromList(bytes), flush: true);
      if (mounted) {
        await SharePlus.instance.share(
          ShareParams(
            files: [XFile(path, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')],
            text: 'GCForm-01 ${widget.record.studentName}',
          ),
        );
      }
    } on DioException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(anecdotalError(e, 'Could not export.'))));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not share the file.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_busy && _detail == null) {
      return const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList(count: 4));
    }
    if (_error != null && _detail == null) {
      return Padding(padding: const EdgeInsets.all(16), child: ErrorView(message: _error!, onRetry: _load));
    }
    final d = _detail ?? <String, dynamic>{};
    final followups = (d['followups'] as List? ?? []);
    final canSign = d['canSign'] == true;
    final signedBy = d['signedBy']?.toString();
    final signedAt = d['signedAt']?.toString();
    return ListView(controller: widget.scroll, padding: const EdgeInsets.all(16), children: [
      Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(widget.record.studentName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            Text('${widget.record.lrn} · ${widget.record.section} · ${widget.record.date}',
                style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
          ]),
        ),
        FlagChip(flag: widget.record.category.isEmpty ? 'behavioral' : widget.record.category),
      ]),
      if (signedBy != null) ...[
        const SizedBox(height: 6),
        Text('Signed by $signedBy${signedAt != null ? ' · $signedAt' : ''}', style: theme.textTheme.bodySmall),
      ],
      const SizedBox(height: 12),
      _field(context, 'Category', (d['category'] ?? widget.record.category)?.toString() ?? ''),
      _field(context, 'Confidentiality', (d['confidentialityLevel'] ?? widget.record.confidentialityLevel)?.toString() ?? ''),
      _field(context, 'Location', (d['location'] ?? d['descriptionOfLocation'])?.toString() ?? ''),
      _field(context, 'Incident', (d['incident'] ?? d['descriptionOfIncident'])?.toString() ?? ''),
      _field(context, 'Notes / Recommendations', (d['notes'] ?? d['notesRecommendationsActions'])?.toString() ?? ''),
      _field(context, 'Class performance', (d['classPerformance'] ?? '')?.toString() ?? ''),
      _field(context, 'Attendance summary', (d['attendanceSummary'] ?? '')?.toString() ?? ''),
      const SizedBox(height: 12),
      Text('Follow-ups (${followups.length})', style: theme.textTheme.titleSmall),
      const SizedBox(height: 6),
      for (final f in followups)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: ZCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(((f as Map)['notes'] ?? '').toString(), style: const TextStyle(fontSize: 13)),
              const SizedBox(height: 2),
              Text('${f['by'] ?? ''} · ${f['date'] ?? ''}', style: theme.textTheme.bodySmall),
            ]),
          ),
        ),
      Row(children: [
        Expanded(
          child: TextField(controller: _followup, decoration: const InputDecoration(labelText: 'Add a follow-up'), maxLines: 2),
        ),
        const SizedBox(width: 8),
        FilledButton(onPressed: _addFollowup, child: const Text('Add')),
      ]),
      const SizedBox(height: 12),
      _FolderMoveRow(recordId: widget.record.id, currentFolderId: widget.record.folderId, onMoved: _load),
      const SizedBox(height: 8),
      SizedBox(width: double.infinity, child: OutlinedButton.icon(icon: const Icon(Icons.share_outlined, size: 16), label: const Text('Export .xlsx'), onPressed: _export)),
      const SizedBox(height: 12),
      _SignatureBlock(
        recordId: widget.record.id,
        canSign: canSign,
        confirmRemove: _confirmRemoveSign,
        onConfirmRemove: (v) => setState(() => _confirmRemoveSign = v),
        onChanged: _load,
      ),
    ]);
  }

  static Widget _field(BuildContext context, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: Theme.of(context).textTheme.labelSmall),
          Text(value.isEmpty ? '—' : value, style: const TextStyle(fontSize: 13)),
        ]),
      );
}

class _FolderMoveRow extends ConsumerWidget {
  final String recordId;
  final String? currentFolderId;
  final VoidCallback onMoved;
  const _FolderMoveRow({required this.recordId, required this.currentFolderId, required this.onMoved});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final folders = ref.watch(anecdotalFoldersProvider);
    return folders.maybeWhen(
      data: (list) => DropdownButtonFormField<String>(
        initialValue: currentFolderId,
        decoration: const InputDecoration(labelText: 'Folder'),
        items: [
          const DropdownMenuItem(value: null, child: Text('No folder', style: TextStyle(fontSize: 13))),
          for (final f in list) DropdownMenuItem(value: f.id, child: Text(f.name, style: const TextStyle(fontSize: 13))),
        ],
        onChanged: (v) async {
          try {
            await moveAnecdotalRecord(ref, recordId, v);
            onMoved();
          } on DioException catch (e) {
            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(anecdotalError(e, 'Could not move.'))));
          }
        },
      ),
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _SignatureBlock extends ConsumerStatefulWidget {
  final String recordId;
  final bool canSign;
  final bool confirmRemove;
  final ValueChanged<bool> onConfirmRemove;
  final VoidCallback onChanged;
  const _SignatureBlock({
    required this.recordId,
    required this.canSign,
    required this.confirmRemove,
    required this.onConfirmRemove,
    required this.onChanged,
  });

  @override
  ConsumerState<_SignatureBlock> createState() => _SignState();
}

class _SignState extends ConsumerState<_SignatureBlock> {
  final _pad = SignatureController(penStrokeWidth: 3, exportBackgroundColor: const Color(0x00000000));
  bool _drawing = false;

  @override
  void dispose() {
    _pad.dispose();
    super.dispose();
  }

  ImageProvider? _imageOf(String? url) {
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ZCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Signature', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        FutureBuilder<String?>(
          future: fetchMySignature(ref),
          builder: (_, snap) {
            final img = _imageOf(snap.data);
            if (img == null) return Text('No saved signature yet.', style: theme.textTheme.bodySmall);
            return Image(image: img, height: 72, errorBuilder: (context, _, _) => const Icon(Icons.draw_outlined));
          },
        ),
        const SizedBox(height: 8),
        if (_drawing) ...[
          Container(
            height: 160,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(6), border: Border.all(color: theme.colorScheme.outline)),
            child: Signature(controller: _pad, backgroundColor: theme.colorScheme.surface),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => setState(() => _drawing = false), child: const Text('Cancel'))),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                onPressed: () async {
                  if (_pad.isEmpty) return;
                  final bytes = await _pad.toPngBytes();
                  if (bytes == null || !context.mounted) return;
                  try {
                    await saveMySignature(ref, 'data:image/png;base64,${base64Encode(bytes)}');
                    if (!context.mounted) return;
                    setState(() => _drawing = false);
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Signature saved.')));
                  } on DioException catch (e) {
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(anecdotalError(e, 'Could not save signature.'))));
                  }
                },
                child: const Text('Save signature'),
              ),
            ),
          ]),
        ] else
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => setState(() => _drawing = true), child: const Text('Draw new'))),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                onPressed: !widget.canSign
                    ? null
                    : () async {
                        try {
                          await applyMySignature(ref, widget.recordId);
                          widget.onChanged();
                          if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Signature applied.')));
                        } on DioException catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(anecdotalError(e, 'Could not apply signature.'))));
                          }
                        }
                      },
                child: const Text('Apply my signature'),
              ),
            ),
          ]),
        const SizedBox(height: 8),
        OutlinedButton(
          style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFDC2626)),
          onPressed: !widget.canSign
              ? null
              : () async {
                  if (!widget.confirmRemove) {
                    widget.onConfirmRemove(true);
                    return;
                  }
                  try {
                    await removeRecordSignature(ref, widget.recordId);
                    widget.onConfirmRemove(false);
                    widget.onChanged();
                  } on DioException catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(anecdotalError(e, 'Could not remove signature.'))));
                    }
                  }
                },
          child: Text(widget.confirmRemove ? 'Tap again to confirm removal' : 'Remove signature'),
        ),
        if (!widget.canSign) Text('Only the section adviser or observing teacher can sign.', style: theme.textTheme.bodySmall),
      ]),
    );
  }
}
