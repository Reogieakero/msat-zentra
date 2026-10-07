import { Router } from "express";
import casesRoutes from "./cases.routes.js";
import queuesRoutes from "./queues.routes.js";
import sessionsRoutes from "./sessions.routes.js";

// Intervention follow-ups — thin mount only. Endpoint groups live in sibling
// routers by responsibility (engine queue, case lifecycle, counseling
// sessions); business logic lives in src/services/interventions/*.service.ts;
// request schemas in interventions.schemas.ts; shared data-access in
// interventions.repository.ts. Mount order is order-insensitive.
const router = Router();

router.use(queuesRoutes);
router.use(casesRoutes);
router.use(sessionsRoutes);

export default router;
