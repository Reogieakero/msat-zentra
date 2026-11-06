import { Router } from "express";
import casesRoutes from "./cases.routes.js";
import queuesRoutes from "./queues.routes.js";
import sessionsRoutes from "./sessions.routes.js";

const router = Router();

router.use(queuesRoutes);
router.use(casesRoutes);
router.use(sessionsRoutes);

export default router;
