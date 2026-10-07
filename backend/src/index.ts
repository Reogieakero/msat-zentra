import "dotenv/config";
import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { logger } from "./lib/pino.js";
import { disconnectPrisma } from "./lib/prisma.js";
import { runEscalation } from "./services/gradeFlags.js";
import { sweepAutoAbsent } from "./services/autoAbsent.js";

const app = createApp();
const env = getEnv();
const port = env.PORT;

const server = app.listen(port, () => {
  logger.info({ port, env: env.NODE_ENV }, "Zentra backend listening");
});

// Graceful shutdown: stop accepting connections, wait for in-flight requests,
// then close the DB pool so Supabase doesn't strand half-open queries.
function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  clearInterval(escalationTimer);
  clearInterval(autoAbsentTimer);
  server.close(() => {
    disconnectPrisma().finally(() => process.exit(0));
  });
  // Hard deadline so a hung keep-alive socket can't block the deploy.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Hourly escalation sweep: overdue open grade flags flip to `escalated`.
// Reads also run it lazily, so this is a backstop, not the source of truth.
const escalationTimer = setInterval(() => {
  runEscalation()
    .then((count) => {
      if (count > 0) logger.info({ count }, "Grade flags escalated");
    })
    .catch((err) => logger.error({ err }, "Grade flag escalation sweep failed"));
}, 3_600_000);
escalationTimer.unref?.();

// Hourly auto-absent sweep: elapsed subject meetups with zero takes get
// materialized absent rows (system-recorded), so the engine and the
// attendance pages read real records. Idempotent; best-effort.
const autoAbsentTimer = setInterval(() => {
  sweepAutoAbsent()
    .then(({ meetups, rows }) => {
      if (rows > 0) logger.info({ meetups, rows }, "Auto-absent sweep wrote rows");
    })
    .catch((err) => logger.error({ err }, "Auto-absent sweep failed"));
}, 3_600_000);
autoAbsentTimer.unref?.();
