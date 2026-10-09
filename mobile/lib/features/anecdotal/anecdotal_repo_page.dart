// Anecdotal records repo — web anecdotal/page.tsx + folders/ parity.
// All records (search, 20/page) | By student (grouped hubs). Tap opens the
// official GCForm-01 preview (native A4 sheet + signature + Download .xlsx).
// Empty states deep-link to Bama filing (?new=1 equivalent).
// NOTE: custom-folder + follow-up UI was removed; the API helpers in
// anecdotal_data.dart are intentionally kept for future use.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../shared/widgets.dart';
import 'anecdotal_data.dart';
import 'record_preview_page.dart';

const _pageSize = 20;

class AnecdotalRepoPage extends ConsumerStatefulWidget {
  const AnecdotalRepoPage({super.key});
  @override
  ConsumerState<AnecdotalRepoPage> createState() => _State();
}

class _State extends ConsumerState<AnecdotalRepoPage> {
  String _view = 'all'; // all | students
  String _q = '';
  int _page = 0;
  bool _legendOpen = true;

  void _openDetail(MyAnecdotalRecord r) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => RecordPreviewPage(record: r)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final repo = ref.watch(anecdotalMineProvider);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Column(children: [
          ZSearchField(hint: 'Search name, LRN, or section', onChanged: (v) => setState(() {
            _q = v.trim().toLowerCase();
            _page = 0;
          })),
          const SizedBox(height: 8),
          SegTabs<String>(
            values: const ['all', 'students'],
            labels: const ['All records', 'By student'],
            selected: _view,
            onChanged: (v) => setState(() => _view = v),
          ),
        ]),
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
              if (_q.isEmpty) return true;
              return r.studentName.toLowerCase().contains(_q) ||
                  r.lrn.contains(_q) ||
                  r.section.toLowerCase().contains(_q);
            }).toList();
            if (shown.isEmpty) {
              return Padding(
                padding: const EdgeInsets.all(16),
                child: ZEmpty(
                  icon: Icons.folder_outlined,
                  title: records.isEmpty ? 'No files stored yet' : 'No records match',
                  subtitle: records.isEmpty ? 'File your first record with Bama.' : 'Try a different search.',
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
            Text('${record.date} · ${anecdotalCategoryLabel(record.category)}',
                style: theme.textTheme.bodySmall),
          ]),
        ),
        const Icon(Icons.chevron_right, size: 18),
      ]),
    );
  }
}
