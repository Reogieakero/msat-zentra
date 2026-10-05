// Zentra mobile — environment / config.
// Mirrors frontend/.env (NEXT_PUBLIC_API_BASE_URL) + backend/.env (MOBILE_ORIGIN).
//
// The app never talks to Postgres/Prisma directly. All data goes through
// the Express API (backend/src/app.ts), which owns Prisma.

class AppConfig {
  /// Pass with `--dart-define=API_BASE_URL=http://10.0.2.2:4000`
  /// (Android emulator) or your LAN IP for physical devices.
  /// Falls back to localhost for desktop/web debugging.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000',
  );

  static const appScheme = 'msat-zentra';

  /// Matches backend JWT TTLs (see backend/.env.example).
  static const accessTokenKey = 'zentra.access';
  static const refreshTokenKey = 'zentra.refresh';
  static const termScopeBox = 'zentra.term';
  static const outboxBox = 'zentra.outbox';
  static const cacheBox = 'zentra.cache';
  static const bamaBox = 'zentra.bama';
}
