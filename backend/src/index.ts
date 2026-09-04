import "dotenv/config";
import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { logger } from "./lib/pino.js";
import { runEscalation } from "./services/gradeFlags.js";

const app = createApp();
const env = getEnv();
const port = env.PORT;

app.listen(port, () => {
  logger.info({ port, env: env.NODE_ENV }, "Zentra backend listening");
});

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
