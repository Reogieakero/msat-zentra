// Notifications inbox — web parity (NotificationsBell + label.ts).
// GET /api/notifications/ (latest 50, desc), POST /read/:id, POST /read-all.
// Unread is client-derived. Titles/taps port teacherNotificationTitle/Target.

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'api_client.dart';

class ZNotification {
  final String id;
  final String type;
  final String? sourceTable;
  final String? sourceId;
  final String message;
  final bool isRead;
  final String createdAt;
  const ZNotification({
    required this.id,
    required this.type,
    this.sourceTable,
    this.sourceId,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });
  factory ZNotification.fromJson(Map<String, dynamic> j) => ZNotification(
        id: j['id']?.toString() ?? '',
        type: j['type']?.toString() ?? '',
        sourceTable: j['sourceTable']?.toString(),
        sourceId: j['sourceId']?.toString(),
        message: j['message']?.toString() ?? '',
        isRead: (j['isRead'] ?? false) as bool,
        createdAt: j['createdAt']?.toString() ?? '',
      );
}

final notificationsProvider = FutureProvider<List<ZNotification>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.dio.get('/api/notifications/');
    final data = res.data;
    final List list = data is List ? data : (data is Map && data['notifications'] is List ? data['notifications'] as List : []);
    return [for (final n in list) ZNotification.fromJson(n as Map<String, dynamic>)];
  } on DioException catch (e) {
    throw api.toApiException(e);
  }
});

Future<void> markNotificationRead(WidgetRef ref, String id) async {
  final api = ref.read(apiClientProvider);
  try {
    await api.dio.post('/api/notifications/read/$id');
  } on DioException catch (e) {
    api.throwApi(e);
  }
  ref.invalidate(notificationsProvider);
}

Future<int> markAllNotificationsRead(WidgetRef ref) async {
  final api = ref.read(apiClientProvider);
  try {
    final res = await api.dio.post('/api/notifications/read-all');
    ref.invalidate(notificationsProvider);
    return (res.data['updated'] ?? 0) as int;
  } on DioException catch (e) {
    api.throwApi(e);
  }
}

/// YYYY-MM-DD HH:MM (mirrors web formatBellDate).
String formatBellDate(String iso) {
  try {
    return DateFormat('yyyy-MM-dd HH:mm').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}

String _prettifyType(String type) => type
    .split('_')
    .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
    .join(' ');

bool _has(RegExp re, String s) => re.hasMatch(s);

/// Port of teacherNotificationTitle (label.ts) — message-sniffed titles.
String teacherNotificationTitle(ZNotification n) {
  final msg = n.message;
  if (n.sourceTable == 'adm_devices') return 'Device update';
  if (_has(RegExp(r'invited you to a parent meeting', caseSensitive: false), msg)) return 'Parent meeting invitation';
  if (n.sourceTable == 'adm_parent_meetings') {
    if (n.type == 'generic_adm_parent_meetings_outcome') return 'Meeting outcome recorded';
    return 'Parent meeting booked';
  }
  if (n.sourceTable == 'referrals' || n.type == 'referral_status_change') {
    if (_has(RegExp(r'clinic accepted your referral', caseSensitive: false), msg)) return 'Clinic accepted your referral';
    if (_has(RegExp(r'clinic booked a session', caseSensitive: false), msg)) return 'Clinic session booked';
    if (_has(RegExp(r'clinic completed a session', caseSensitive: false), msg)) return 'Clinic session completed';
    if (_has(RegExp(r'escalated to ADM', caseSensitive: false), msg)) return 'Referral escalated to ADM';
    if (_has(RegExp(r'was escalated', caseSensitive: false), msg)) return 'Referral escalated';
    if (_has(RegExp(r'was dismissed', caseSensitive: false), msg)) return 'Referral dismissed';
    if (_has(RegExp(r'more info was requested', caseSensitive: false), msg)) return 'Info requested';
    if (_has(RegExp(r'is now in progress', caseSensitive: false), msg)) return 'Referral in progress';
    if (_has(RegExp(r'was marked resolved', caseSensitive: false), msg)) return 'Referral resolved';
    if (_has(RegExp(r'guidance accepted your referral', caseSensitive: false), msg)) return 'Guidance accepted your referral';
    if (_has(RegExp(r'guidance booked a session', caseSensitive: false), msg)) return 'Guidance session booked';
    if (_has(RegExp(r'sent to ADM', caseSensitive: false), msg)) return 'Sent to ADM';
    if (_has(RegExp(r'sent to the clinic', caseSensitive: false), msg)) return 'Sent to clinic';
    if (_has(RegExp(r're-submitted', caseSensitive: false), msg)) return 'Referral re-submitted';
    return 'Referral update';
  }
  if (n.type == 'new_followup') return 'New follow-up';
  if (n.sourceTable == 'interventions') {
    if (_has(RegExp(r'booked an intervention session', caseSensitive: false), msg)) return 'Intervention session booked';
    if (_has(RegExp(r'completed an intervention session', caseSensitive: false), msg)) return 'Intervention session completed';
  }
  if (n.type == 'intervention_detected') {
    if (_has(RegExp(r'flagged Moderate risk', caseSensitive: false), msg)) return 'Advisee flagged Moderate risk';
    return 'Advisee flagged High risk';
  }
  return _prettifyType(n.type);
}

/// Port of teacherNotificationTarget (label.ts), mapped onto mobile routes.
/// Referral-family targets land on the adviser referrals list; timetable
/// verdicts on the section schedule; everything else has no mobile target.
String? teacherNotificationTarget(ZNotification n, {required bool isAdviser}) {
  if (n.sourceTable == 'section_timetable_entries' && n.sourceId != null) return '/adviser/schedule';
  const referralFamily = {'referrals', 'counseling_sessions', 'interventions', 'adm_parent_meetings', 'adm_profiles'};
  if (n.sourceTable != null && referralFamily.contains(n.sourceTable)) {
    return isAdviser ? '/adviser/referrals' : null;
  }
  return null;
}
