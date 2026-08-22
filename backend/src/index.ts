import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { logger } from "./lib/pino.js";

const app = createApp();
const env = getEnv();
const port = env.PORT;

app.listen(port, () => {
  logger.info({ port, env: env.NODE_ENV }, "Zentra backend listening");
});
