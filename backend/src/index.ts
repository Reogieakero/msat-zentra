import "dotenv/config";
import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { logger } from "./lib/pino.js";
import { disconnectPrisma } from "./lib/prisma.js";
import { runEscalation } from "./services/gradeFlags.js";
import { sweepAutoAbsent } from "./services/autoAbsent.js";
import { refreshRiskSnapshots } from "./services/riskRefresh.js";

const app = createApp();
const env = getEnv();
const port = env.PORT;

const server = app.listen(port, () => {
  logger.info({ port, env: env.NODE_ENV }, "Zentra backend listening");
});
// Emergency application-level boundary (not a target): normal paged
// requests should complete in <2s. Slow endpoints must be investigated,
// heavy reports served from cache/snapshot — never block UI for 30s.
server.timeout = 25_000;
server.headersTimeout = 26_000;
server.requestTimeout = 25_000;

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  clearInterval(escalationTimer);
  clearInterval(autoAbsentTimer);
  clearInterval(riskRefreshTimer);
  server.close(() => {
    disconnectPrisma().finally(() => process.exit(0));
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const escalationTimer = setInterval(() => {
  runEscalation()
    .then((count) => {
      if (count > 0) logger.info({ count }, "Grade flags escalated");
    })
    .catch((err) => logger.error({ err }, "Grade flag escalation sweep failed"));
}, 3_600_000);
escalationTimer.unref?.();

const autoAbsentTimer = setInterval(() => {
  sweepAutoAbsent()
    .then(({ meetups, rows }) => {
      if (rows > 0) logger.info({ meetups, rows }, "Auto-absent sweep wrote rows");
    })
    .catch((err) => logger.error({ err }, "Auto-absent sweep failed"));
}, 3_600_000);
autoAbsentTimer.unref?.();

const riskRefreshTimer = setInterval(() => {
  refreshRiskSnapshots()
    .then(({ profiles, rosters, pruned }) => {
      if (profiles + rosters + pruned > 0)
        logger.info({ profiles, rosters, pruned }, "Risk snapshot refresh completed");
    })
    .catch((err) => logger.error({ err }, "Risk snapshot refresh failed"));
}, 3_600_000);
riskRefreshTimer.unref?.();
