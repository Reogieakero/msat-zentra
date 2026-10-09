// Record preview — web OcForm01PreviewDialog parity (mobile-native).
// Folder/row tap opens this page: it fetches the single-page A4 PDF twin of
// the official GCForm-01 export (GET /api/anecdotal/:id/pdf, drawn
// server-side from the same record data) and renders it with pinch-zoom +
// double-tap. The PDF is cached on disk per signature state, so signed
// forms stay viewable offline. Below the sheet: the web-exact signature
// flow + both downloads (.xlsx for the official file, .PDF to share the
// preview itself).

import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:share_plus/share_plus.dart';

import '../../shared/models.dart';
import '../../shared/widgets.dart';
import 'anecdotal_data.dart';
import 'signature_block.dart';

class RecordPreviewPage extends ConsumerStatefulWidget {
  final MyAnecdotalRecord record;
  const RecordPreviewPage({super.key, required this.record});

  @override
  ConsumerState<RecordPreviewPage> createState() => _PreviewState();
}

class _PreviewState extends ConsumerState<RecordPreviewPage> {
  final _pdfController = PdfViewerController();
  Map<String, dynamic>? _detail;
  Uint8List? _pdfBytes;
  String? _error;
  bool _busy = true;
  bool _exportingXlsx = false;
  bool _exportingPdf = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    // PdfViewerController holds no native resources in this version —
    // the viewer detaches itself when unmounted.
    super.dispose();
  }

  /// Cache identity includes the signature timestamp: signing/removing mints
  /// a new key, so a cached unsigned PDF can never shadow a signed one.
  String _cacheKey(Map<String, dynamic> detail) {
    final at = recordSignatureOf(detail)?.at.trim() ?? '';
    final stamp = at.isEmpty ? 'unsigned' : at.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '-');
    return 'OCForm-01_${widget.record.id}_$stamp.pdf';
  }

  Future<File> _cacheFile(String key) async {
    final dir = await getApplicationDocumentsDirectory();
    final cache = Directory('${dir.path}/ocform01_pdfs');
    if (!await cache.exists()) await cache.create(recursive: true);
    return File('${cache.path}/$key');
  }

  Future<void> _load() async {
    setState(() {
      _detail = null;
      _pdfBytes = null;
      _error = null;
      _busy = true;
    });
    try {
      final detail = await fetchRecordDetail(ref, widget.record.id);
      final key = _cacheKey(detail);
      final cached = await _cacheFile(key);
      Uint8List bytes;
      if (await cached.exists()) {
        bytes = await cached.readAsBytes();
      } else {
        final fresh = await downloadRecordPdf(ref, widget.record.id);
        bytes = Uint8List.fromList(fresh);
        await cached.writeAsBytes(bytes, flush: true);
      }
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _pdfBytes = bytes;
        _busy = false;
      });
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _error = anecdotalError(e, 'The official form could not be loaded. Check your connection and try again.');
          _busy = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _busy = false;
        });
      }
    }
  }

  String get _safeName => widget.record.studentName.trim().isEmpty
      ? widget.record.id
      : widget.record.studentName.trim().replaceAll(RegExp(r'\s+'), '-');

  Future<void> _shareXlsx() async {
    if (_exportingXlsx) return;
    setState(() => _exportingXlsx = true);
    try {
      final bytes = await downloadRecordExport(ref, widget.record.id);
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/OCForm-01_${_safeName}_${widget.record.date}.xlsx';
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
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not share the file.')));
    } finally {
      if (mounted) setState(() => _exportingXlsx = false);
    }
  }

  Future<void> _sharePdf() async {
    final bytes = _pdfBytes;
    if (bytes == null || _exportingPdf) return;
    setState(() => _exportingPdf = true);
    try {
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/OCForm-01_${_safeName}_${widget.record.date}.pdf';
      await File(path).writeAsBytes(bytes, flush: true);
      if (mounted) {
        await SharePlus.instance.share(
          ShareParams(
            files: [XFile(path, mimeType: 'application/pdf')],
            text: 'GCForm-01 ${widget.record.studentName}',
          ),
        );
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not share the file.')));
    } finally {
      if (mounted) setState(() => _exportingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('GCForm-01 preview')),
      body: Builder(builder: (_) {
        if (_busy) {
          return const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList(count: 6));
        }
        if (_error != null || _detail == null || _pdfBytes == null) {
          return Padding(padding: const EdgeInsets.all(16), child: ErrorView(message: _error ?? 'Could not load.', onRetry: _load));
        }
        final detail = _detail!;
        final canSign = detail['canSign'] == true;
        final sig = recordSignatureOf(detail);
        return Column(children: [
          Expanded(
            flex: 6,
            child: Container(
              color: Theme.of(context).colorScheme.surfaceContainerLow,
              child: PdfViewer.data(
                _pdfBytes!,
                sourceName: 'ocform01_${widget.record.id}',
                controller: _pdfController,
              ),
            ),
          ),
          Expanded(
            flex: 4,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SignatureBlock(
                  recordId: widget.record.id,
                  canSign: canSign,
                  signature: sig,
                  onChanged: _load,
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: _exportingXlsx
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.download_outlined, size: 16),
                      onPressed: _exportingXlsx ? null : _shareXlsx,
                      label: Text(_exportingXlsx ? 'Preparing…' : 'Download .xlsx'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      icon: _exportingPdf
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.picture_as_pdf_outlined, size: 16),
                      onPressed: _exportingPdf ? null : _sharePdf,
                      label: Text(_exportingPdf ? 'Preparing…' : 'Download .PDF'),
                    ),
                  ),
                ]),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ]);
      }),
    );
  }
}
