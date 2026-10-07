import { Router } from "express";
import lifecycleRoutes from "./lifecycle.routes.js";
import recordsRoutes from "./records.routes.js";

// SF10 permanent records — thin mount only. Endpoint groups live in sibling
// routers by responsibility (records reads + upload, verify/validate/release
// lifecycle); business logic lives in src/services/sf10/records.service.ts;
// shared grade-band data-access in sf10.repository.ts. Mount order is
// order-insensitive (all paths are distinct).
const router = Router();

router.use(recordsRoutes);
router.use(lifecycleRoutes);

export default router;
