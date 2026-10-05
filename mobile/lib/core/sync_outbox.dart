// Zentra mobile — offline outbox (Hive) per PLAN.md O9.
// Mutations allowed offline (attendance bulk, grade score, anecdotal draft,
// followup) are queued with a client opId and flushed on reconnect.
// Conflict: Last-Write-Wins by updated_at + server authority; POST /sync is
// idempotent by opId (backend addition, Phase 5).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';
import 'config.dart';

final outboxProvider = Provider<Outbox>((ref) => Outbox(ref.watch(apiClientProvider)));

class Outbox {
  final ApiClient api;
  Outbox(this.api);

  Box get _box => Hive.box(AppConfig.outboxBox);

  Future<void> enqueue({required String method, required String path, required Map<String, dynamic> body}) async {
    await _box.add({'opId': const Uuid().v4(), 'method': method, 'path': path, 'body': body, 'at': DateTime.now().toIso8601String()});
  }

  List<Map<String, dynamic>> get pending => [for (final v in _box.values) Map<String, dynamic>.from(v as Map)];

  int get pendingCount => _box.length;

  /// Flush in FIFO order. Stops on first failure (keeps order, retries later).
  Future<int> flush() async {
    var done = 0;
    for (final key in _box.keys.toList()) {
      final op = Map<String, dynamic>.from(_box.get(key) as Map);
      try {
        final method = (op['method'] as String).toUpperCase();
        final path = op['path'] as String;
        final body = Map<String, dynamic>.from(op['body'] as Map)..['opId'] = op['opId'];
        if (method == 'POST') {
          await api.dio.post(path, data: body);
        } else if (method == 'PATCH') {
          await api.dio.patch(path, data: body);
        } else {
          await api.dio.post(path, data: body);
        }
        await _box.delete(key);
        done++;
      } catch (_) {
        break;
      }
    }
    return done;
  }
}
