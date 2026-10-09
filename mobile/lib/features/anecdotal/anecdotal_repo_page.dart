// Anecdotal records repo — web anecdotal/page.tsx + folders/ parity.
// All records (search, 20/page) | By student (grouped hubs). Tap opens the
// detail sheet. Empty states deep-link to Bama filing (?new=1 equivalent).

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../shared/widgets.dart';
import 'anecdotal_data.dart';
import 'record_detail_sheet.dart';

const _pageSize = 20;

class AnecdotalRepoPage extends ConsumerStatefulWidget {
  const AnecdotalRepoPage({super.key});
  @override
  ConsumerState<AnecdotalRepoPage> createState() => _State();
}

class _State extends ConsumerState<AnecdotalRepoPage> {
  String _view = 'all'; // all | students
  String _q = '';
  String? _folderId; // null = all folders
  int _page = 0;
  bool _legendOpen = true;

  void _openDetail(MyAnecdotalRecord r) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        builder: (_, scroll) => RecordDetailSheet(record: r, scroll: scroll),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final repo = ref.watch(anecdotalMineProvider);
    final folders = ref.watch(anecdotalFoldersProvider);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Column(children: [
          ZSearchField(hint: 'Search name, LRN, or section', onChanged: (v) => setState(() {
            _q = v.trim().toLowerCase();
            _page = 0;
          })),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: SegTabs<String>(
                values: const ['all', 'students'],
                labels: const ['All records', 'By student'],
                selected: _view,
                onChanged: (v) => setState(() => _view = v),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton.icon(
              icon: const Icon(Icons.create_new_folder_outlined, size: 16),
              label: const Text('Folders'),
              onPressed: () => showFolderManager(context, ref),
            ),
          ]),
        ]),
      ),
      folders.maybeWhen(
        data: (list) {
          if (list.isEmpty) return const SizedBox.shrink();
          return SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(label: const Text('All folders', style: TextStyle(fontSize: 12)), selected: _folderId == null, onSelected: (_) => setState(() => _folderId = null), visualDensity: VisualDensity.compact),
              ),
              for (final f in list)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(f.name, style: const TextStyle(fontSize: 12)),
                    selected: _folderId == f.id,
                    onSelected: (_) => setState(() {
                      _folderId = f.id;
                      _page = 0;
                    }),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
            ]),
          );
        },
        orElse: () => const SizedBox.shrink(),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
        child: ZCard(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            InkWell(
              borderRadius: BorderRadius.circular(6),
              onTap: () => setState(() => _legendOpen = !_legendOpen),
              child: Row(children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    color: Theme.of(context).colorScheme.surfaceContainerLow,
                  ),
                  child: const Icon(Icons.info_outline, size: 20),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Legend', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    Text('What each folder color means.', style: TextStyle(fontSize: 12)),
                  ]),
                ),
                Icon(_legendOpen ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, size: 20),
              ]),
            ),
            if (_legendOpen) ...[
              const SizedBox(height: 8),
              for (final key in anecdotalCategoryColors.keys)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: anecdotalCategoryColors[key]),
                    ),
                    const SizedBox(width: 8),
                    Text(anecdotalCategoryLabels[key]!, style: const TextStyle(fontSize: 13)),
                  ]),
                ),
            ],
          ]),
        ),
      ),
      const SizedBox(height: 8),
      Expanded(
        child: repo.when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: ZSkeletonList()),
          error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(anecdotalMineProvider)),
          data: (records) {
            var shown = records.where((r) {
              final mq = _q.isEmpty ||
                  r.studentName.toLowerCase().contains(_q) ||
                  r.lrn.contains(_q) ||
                  r.section.toLowerCase().contains(_q);
              final mf = _folderId == null || r.folderId == _folderId;
              return mq && mf;
            }).toList();
            if (shown.isEmpty) {
              return Padding(
                padding: const EdgeInsets.all(16),
                child: ZEmpty(
                  icon: Icons.folder_outlined,
                  title: records.isEmpty ? 'No files stored yet' : 'No records match',
                  subtitle: records.isEmpty ? 'File your first record with Bama.' : 'Try a different search or folder.',
                  actionLabel: records.isEmpty ? 'Chat with Bama' : null,
                  onAction: records.isEmpty ? () => context.go('/adviser/bama?new=1') : null,
                ),
              );
            }
            if (_view == 'students') return _studentHubs(shown);
            final pages = (shown.length / _pageSize).ceil().clamp(1, 9999);
            final page = _page.clamp(0, pages - 1);
            final slice = shown.skip(page * _pageSize).take(_pageSize).toList();
            return Column(children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async => ref.invalidate(anecdotalMineProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    itemCount: slice.length,
                    separatorBuilder: (context, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) => _RecordRow(record: slice[i], onTap: () => _openDetail(slice[i])),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Row(children: [
                  Expanded(
                    child: Text('${shown.length} record${shown.length == 1 ? '' : 's'} · page ${page + 1} of $pages',
                        style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                  ),
                  OutlinedButton(onPressed: page > 0 ? () => setState(() => _page = page - 1) : null, child: const Text('Previous')),
                  const SizedBox(width: 8),
                  OutlinedButton(onPressed: page < pages - 1 ? () => setState(() => _page = page + 1) : null, child: const Text('Next')),
                ]),
              ),
            ]);
          },
        ),
      ),
    ]);
  }

  Widget _studentHubs(List<MyAnecdotalRecord> shown) {
    final groups = <String, List<MyAnecdotalRecord>>{};
    for (final r in shown) {
      groups.putIfAbsent(r.studentId.isEmpty ? r.lrn : r.studentId, () => []).add(r);
    }
    final entries = groups.entries.toList()
      ..sort((a, b) => b.value.map((r) => r.observationDatetime).fold('', (p, e) => e.compareTo(p) > 0 ? e : p).compareTo(
          a.value.map((r) => r.observationDatetime).fold('', (p, e) => e.compareTo(p) > 0 ? e : p)));
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(anecdotalMineProvider),
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
        itemCount: entries.length,
        separatorBuilder: (context, _) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final records = entries[i].value..sort((a, b) => b.observationDatetime.compareTo(a.observationDatetime));
          final first = records.first;
          final cats = {for (final r in records) r.category.trim().toLowerCase()};
          final uniform = cats.length == 1 ? anecdotalCategoryColor(cats.first) : null;
          return ZCard(
            padding: EdgeInsets.zero,
            child: ExpansionTile(
              dense: true,
              leading: uniform == null
                  ? null
                  : Container(width: 10, height: 10, decoration: BoxDecoration(shape: BoxShape.circle, color: uniform)),
              title: Text(first.studentName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text('${first.lrn} · ${first.section} · ${records.length} record${records.length == 1 ? '' : 's'}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
              children: [
                for (final r in records) _RecordRow(record: r, onTap: () => _openDetail(r), dense: true),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _RecordRow extends StatelessWidget {
  final MyAnecdotalRecord record;
  final VoidCallback onTap;
  final bool dense;
  const _RecordRow({required this.record, required this.onTap, this.dense = false});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ZCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      onTap: onTap,
      child: Row(children: [
        Builder(builder: (_) {
          final c = anecdotalCategoryColor(record.category);
          return Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(6), color: c.withValues(alpha: 0.12)),
            child: Icon(Icons.folder_outlined, size: 20, color: c),
          );
        }),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(record.studentName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            Text('${record.lrn} · ${record.section}',
                style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            const SizedBox(height: 2),
            Text(
                '${record.date} · ${anecdotalCategoryLabel(record.category)}${record.folderName?.isNotEmpty ?? false ? ' · ${record.folderName}' : ''}',
                style: theme.textTheme.bodySmall),
          ]),
        ),
        const Icon(Icons.chevron_right, size: 18),
      ]),
    );
  }
}

void showFolderManager(BuildContext context, WidgetRef ref) {
  final name = TextEditingController();
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(6))),
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      builder: (_, scroll) => Padding(
        padding: const EdgeInsets.all(16),
        child: Consumer(builder: (ctx, ref2, _) {
          final folders = ref2.watch(anecdotalFoldersProvider);
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Folders', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text('Organize your filed records. Deleting a folder keeps its records.', style: Theme.of(ctx).textTheme.bodySmall),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: name, decoration: const InputDecoration(labelText: 'New folder name'), maxLength: 60)),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: () async {
                  if (name.text.trim().isEmpty) return;
                  try {
                    await createAnecdotalFolder(ref, name.text);
                    name.clear();
                  } on DioException catch (e) {
                    if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(anecdotalError(e, 'Could not create folder.'))));
                  }
                },
                child: const Text('Add'),
              ),
            ]),
            const SizedBox(height: 8),
            Expanded(
              child: folders.when(
                loading: () => const ZSkeletonList(count: 3),
                error: (e, _) => Center(child: Text(e.toString())),
                data: (list) {
                  if (list.isEmpty) return const Center(child: Text('No folders yet.'));
                  return ListView.separated(
                    controller: scroll,
                    itemCount: list.length,
                    separatorBuilder: (context, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) => _FolderRow(folder: list[i]),
                  );
                },
              ),
            ),
          ]);
        }),
      ),
    ),
  );
}

class _FolderRow extends ConsumerStatefulWidget {
  final AnecdotalFolder folder;
  const _FolderRow({required this.folder});
  @override
  ConsumerState<_FolderRow> createState() => _RowState();
}

class _RowState extends ConsumerState<_FolderRow> {
  bool _editing = false;
  late final TextEditingController _name = TextEditingController(text: widget.folder.name);

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_editing) {
      return Row(children: [
        Expanded(child: TextField(controller: _name, decoration: const InputDecoration(labelText: 'Folder name'), maxLength: 60)),
        IconButton(
          icon: const Icon(Icons.check, size: 18),
          onPressed: () async {
            try {
              await renameAnecdotalFolder(ref, widget.folder.id, _name.text);
              if (!context.mounted) return;
              setState(() => _editing = false);
            } on DioException catch (e) {
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(anecdotalError(e, 'Could not rename.'))));
            }
          },
        ),
        IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => setState(() => _editing = false)),
      ]);
    }
    return ZCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(children: [
        const Icon(Icons.folder_outlined, size: 20),
        const SizedBox(width: 10),
        Expanded(child: Text(widget.folder.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
        IconButton(icon: const Icon(Icons.edit_outlined, size: 18), onPressed: () => setState(() => _editing = true)),
        IconButton(
          icon: const Icon(Icons.delete_outline, size: 18),
          onPressed: () async {
            final ok = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Delete folder?', style: TextStyle(fontSize: 15)),
                content: Text('“${widget.folder.name}” will be removed. Its records are kept.', style: const TextStyle(fontSize: 13)),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                  FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Delete'),
                  ),
                ],
              ),
            );
            if (ok == true) {
              try {
                await deleteAnecdotalFolder(ref, widget.folder.id);
              } on DioException catch (e) {
                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(anecdotalError(e, 'Could not delete.'))));
              }
            }
          },
        ),
      ]),
    );
  }
}
