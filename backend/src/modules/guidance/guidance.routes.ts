import { Router } from "express";
import admRoutes from "./adm.routes.js";
import alertsRoutes from "./alerts.routes.js";
import anecdotalRoutes from "./anecdotal.routes.js";
import casesRoutes from "./cases.routes.js";
import overviewRoutes from "./overview.routes.js";
import settingsRoutes from "./settings.routes.js";

// Guidance desk — thin mount only. Endpoint groups live in sibling routers
// by responsibility (overview, alerts, referral cases, anecdotal files, ADM
// hand-offs + consultation review, settings); business logic lives in
// src/services/guidance/*.service.ts; request schemas in
// guidance.schemas.ts; shared data-access in guidance.repository.ts.
// Mount order is order-insensitive (all paths are distinct).
const router = Router();

router.use(overviewRoutes);
router.use(alertsRoutes);
router.use(casesRoutes);
router.use(anecdotalRoutes);
router.use(admRoutes);
router.use(settingsRoutes);

export default router;
