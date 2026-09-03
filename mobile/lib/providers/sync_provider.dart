import 'package:flutter_riverpod/flutter_riverpod.dart';

class SyncMutationItem {
  final String id;
  final String method;
  final String endpoint;
  final Map<String, dynamic> payload;
  final DateTime timestamp;

  const SyncMutationItem({
    required this.id,
    required this.method,
    required this.endpoint,
    required this.payload,
    required this.timestamp,
  });
}

class SyncState {
  final bool isOnline;
  final List<SyncMutationItem> pendingQueue;
  final bool isSyncing;
  final String? lastSyncMessage;

  const SyncState({
    required this.isOnline,
    required this.pendingQueue,
    this.isSyncing = false,
    this.lastSyncMessage,
  });

  SyncState copyWith({
    bool? isOnline,
    List<SyncMutationItem>? pendingQueue,
    bool? isSyncing,
    String? lastSyncMessage,
  }) {
    return SyncState(
      isOnline: isOnline ?? this.isOnline,
      pendingQueue: pendingQueue ?? this.pendingQueue,
      isSyncing: isSyncing ?? this.isSyncing,
      lastSyncMessage: lastSyncMessage ?? this.lastSyncMessage,
    );
  }
}

class SyncNotifier extends StateNotifier<SyncState> {
  SyncNotifier()
      : super(const SyncState(
          isOnline: true,
          pendingQueue: [],
        ));

  void toggleOnlineStatus() {
    final newOnlineState = !state.isOnline;
    state = state.copyWith(isOnline: newOnlineState);

    if (newOnlineState && state.pendingQueue.isNotEmpty) {
      flushOutboxQueue();
    }
  }

  void registerMutation(String method, String endpoint, Map<String, dynamic> payload) {
    if (state.isOnline) {
      // Direct API call simulated
      state = state.copyWith(lastSyncMessage: 'Synced to server ($endpoint)');
    } else {
      // Offline: Enqueue to outbox
      final newItem = SyncMutationItem(
        id: 'op_${DateTime.now().millisecondsSinceEpoch}',
        method: method,
        endpoint: endpoint,
        payload: payload,
        timestamp: DateTime.now(),
      );
      final updatedQueue = [...state.pendingQueue, newItem];
      state = state.copyWith(
        pendingQueue: updatedQueue,
        lastSyncMessage: 'Queued offline action (${updatedQueue.length} pending)',
      );
    }
  }

  Future<void> flushOutboxQueue() async {
    if (state.pendingQueue.isEmpty) return;

    state = state.copyWith(isSyncing: true, lastSyncMessage: 'Flushing outbox queue...');
    await Future.delayed(const Duration(milliseconds: 1500)); // Simulate network sync delay

    final count = state.pendingQueue.length;
    state = state.copyWith(
      pendingQueue: [],
      isSyncing: false,
      lastSyncMessage: 'Successfully synced $count offline mutation(s)',
    );
  }
}

final syncProvider = StateNotifierProvider<SyncNotifier, SyncState>((ref) {
  return SyncNotifier();
});
