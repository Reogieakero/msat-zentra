// Zentra mobile entry — Adviser + Subject Teacher app.
// Reuses the SAME Express + Prisma API as the Next.js web app.
// Run: flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'core/config.dart';
import 'core/sync_outbox.dart';
import 'design/theme.dart';
import 'design/theme_mode.dart';
import 'features/app_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  await Hive.openBox(AppConfig.termScopeBox);
  await Hive.openBox(AppConfig.outboxBox);
  await Hive.openBox(AppConfig.bamaBox);
  await openThemeSettingsBox();
  runApp(const ProviderScope(child: ZentraApp()));
}

class ZentraApp extends ConsumerWidget {
  const ZentraApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final settings = ref.watch(themeSettingsProvider);
    final pending = Hive.box(AppConfig.outboxBox).listenable();
    final primary = hexToColor(settings.primaryHex);
    final secondary = hexToColor(settings.secondaryHex);
    return ValueListenableBuilder(
      valueListenable: pending,
      builder: (context, _, _) => MaterialApp.router(
        title: 'Zentra',
        debugShowCheckedModeBanner: false,
        theme: zLightTheme(primaryOverride: primary, secondaryOverride: secondary),
        darkTheme: zDarkTheme(primaryOverride: primary, secondaryOverride: secondary),
        themeMode: settings.mode,
        routerConfig: router,
      ),
    );
  }
}

// Sync banner host — call Outbox.flush() on reconnect from a connectivity
// listener in Phase 5 (connectivity_plus). Kept here so Phase 0 compiles.
Future<int> flushPending(WidgetRef ref) => ref.read(outboxProvider).flush();
