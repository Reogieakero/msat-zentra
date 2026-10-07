import { Router } from "express";
import intakeRoutes from "./intake.routes.js";
import pipelineRoutes from "./pipeline.routes.js";
import queuesRoutes from "./queues.routes.js";
import sessionsRoutes from "./sessions.routes.js";

// Referral pipeline — thin mount only. Endpoint groups live in sibling
// routers by responsibility (pipeline moves, specialist intake, counseling
// sessions, desk queues); business logic lives in
// src/services/referrals/*.service.ts; request schemas in
// referrals.schemas.ts; shared data-access in referrals.repository.ts.
// Timeline helpers stay in ./timeline.js (shared with ADM my-cases).
// Mount order is order-insensitive (all paths are distinct).
const router = Router();

router.use(pipelineRoutes);
router.use(intakeRoutes);
router.use(sessionsRoutes);
router.use(queuesRoutes);

export default router;
