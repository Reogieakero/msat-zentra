import { Router } from "express";
import devicesRoutes from "./devices.routes.js";
import meetingsRoutes from "./meetings.routes.js";
import metaRoutes from "./meta.routes.js";
import overviewRoutes from "./overview.routes.js";
import profilesRoutes from "./profiles.routes.js";
import queuesRoutes from "./queues.routes.js";

const router = Router();

router.use(metaRoutes);
router.use(overviewRoutes);
router.use(queuesRoutes);
router.use(profilesRoutes);
router.use(meetingsRoutes);
router.use(devicesRoutes);

export default router;
