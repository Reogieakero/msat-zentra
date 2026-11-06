import { Router } from "express";
import overviewRoutes from "./academics-overview.routes.js";
import assignRoutes from "./academics-assign.routes.js";
import scheduleRoutes from "./academics-schedule.routes.js";

const router = Router();

router.use(overviewRoutes);
router.use(assignRoutes);
router.use(scheduleRoutes);

export default router;
