import express from "express";
import helmet from "helmet";
import cors from "cors";
import { getEnv } from "./config/env.js";
import { errorHandler, notFound } from "./lib/errors.js";

import authRoutes from "./modules/auth/auth.routes.js";
import gradesRoutes from "./modules/grades/grades.routes.js";
import attendanceRoutes from "./modules/attendance/attendance.routes.js";
import anecdotalRoutes from "./modules/anecdotal/anecdotal.routes.js";
import referralsRoutes from "./modules/referrals/referrals.routes.js";
import admRoutes from "./modules/adm/adm.routes.js";
import sf10Routes from "./modules/sf10/sf10.routes.js";
import riskRoutes from "./modules/risk/risk.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";
import overviewRoutes from "./modules/overview/overview.routes.js";
import academicsRoutes from "./modules/academics/academics.routes.js";

export function createApp() {
  const env = getEnv();
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: [env.WEB_ORIGIN, env.MOBILE_ORIGIN], credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/grades", gradesRoutes);
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/anecdotal", anecdotalRoutes);
  app.use("/api/referrals", referralsRoutes);
  app.use("/api/adm", admRoutes);
  app.use("/api/sf10", sf10Routes);
  app.use("/api/risk", riskRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/overview", overviewRoutes);
  app.use("/api/academics", academicsRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
