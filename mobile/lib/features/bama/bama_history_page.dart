// Bama per-type history — full-page "See all" for one record type.
// Opened from welcome log sections via /adviser/bama/history?type=...
// with the live list + resume/delete callbacks in extra.

import 'package:flutter/material.dart';

import 'bama_conversations.dart';

class BamaHistoryPage extends StatefulWidget {
  final String type;
  final List<BamaConversation> conversations;
  final ValueChanged<String> onResume;
  final ValueChanged<BamaConversation> onDelete;
  const BamaHistoryPage({
    super.key,
    required this.type,
    required this.conversations,
    required this.onResume,
    required this.onDelete,
  });

  @override
  State<BamaHistoryPage> createState() => _State();
}

class _State extends State<BamaHistoryPage> {
  final _q = TextEditingController();
  late List<BamaConversation> _items;

  @override
  void initState() {
    super.initState();
    _items = [for (final c in widget.conversations) if (c.type == widget.type) c];
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final needle = _q.text.trim().toLowerCase();
    final shown = _items.where((c) {
      if (needle.isEmpty) return true;
      return c.title.toLowerCase().contains(needle) || c.messages.any((m) => m.text.toLowerCase().contains(needle));
    }).toList();
    final title = widget.type == 'grade-flag' ? 'Grade flag logs' : 'Anecdotal logs';
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: TextField(
          controller: _q,
          decoration: const InputDecoration(prefixIcon: Icon(Icons.search, size: 18), hintText: 'Search chats…'),
          onChanged: (_) => setState(() {}),
        ),
      ),
      Expanded(
        child: shown.isEmpty
            ? Center(
                child: Text(
                  _items.isEmpty ? 'No ${title.toLowerCase()} yet.' : 'No chats match "$needle".',
                  style: theme.textTheme.bodySmall,
                ),
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                itemCount: shown.length,
                separatorBuilder: (context, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final c = shown[i];
                  return Card(
                    margin: EdgeInsets.zero,
                    child: ListTile(
                      dense: true,
                      title: Text(c.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        '${c.messages.length} messages${c.filed ? ' · Filed' : ''}',
                        style: const TextStyle(fontSize: 12, fontFeatures: [FontFeature.tabularFigures()]),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline, size: 18),
                        onPressed: () {
                          widget.onDelete(c);
                          setState(() => _items.removeWhere((e) => e.id == c.id));
                        },
                      ),
                      onTap: () {
                        widget.onResume(c.id);
                        Navigator.of(context).pop();
                      },
                    ),
                  );
                },
              ),
      ),
    ]);
  }
}
