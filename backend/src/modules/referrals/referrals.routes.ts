import { Router } from "express";
import intakeRoutes from "./intake.routes.js";
import pipelineRoutes from "./pipeline.routes.js";
import queuesRoutes from "./queues.routes.js";
import sessionsRoutes from "./sessions.routes.js";

const router = Router();

router.use(pipelineRoutes);
router.use(intakeRoutes);
router.use(sessionsRoutes);
router.use(queuesRoutes);

export default router;
