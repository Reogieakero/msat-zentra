import { Router } from "express";
import devicesRoutes from "./devices.routes.js";
import meetingsRoutes from "./meetings.routes.js";
import metaRoutes from "./meta.routes.js";
import overviewRoutes from "./overview.routes.js";
import profilesRoutes from "./profiles.routes.js";
import queuesRoutes from "./queues.routes.js";

// ADM Coordinator desk — thin mount only. Endpoint groups live in
// sibling routers by resource; business logic lives in
// src/services/adm/*.service.ts; request schemas in adm.schemas.ts;
// shared data-access in adm.repository.ts. Mount order is
// order-insensitive (all paths are distinct; no param-route shadowing).
const router = Router();

router.use(metaRoutes);
router.use(overviewRoutes);
router.use(queuesRoutes);
router.use(profilesRoutes);
router.use(meetingsRoutes);
router.use(devicesRoutes);

export default router;
