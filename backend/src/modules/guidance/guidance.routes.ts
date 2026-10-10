import { Router } from "express";
import admRoutes from "./adm.routes.js";
import alertsRoutes from "./alerts.routes.js";
import anecdotalRoutes from "./anecdotal.routes.js";
import casesRoutes from "./cases.routes.js";
import overviewRoutes from "./overview.routes.js";
import scheduleRoutes from "./schedule.routes.js";
import settingsRoutes from "./settings.routes.js";

const router = Router();

router.use(overviewRoutes);
router.use(alertsRoutes);
router.use(casesRoutes);
router.use(scheduleRoutes);
router.use(anecdotalRoutes);
router.use(admRoutes);
router.use(settingsRoutes);

export default router;
