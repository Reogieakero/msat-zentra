import { Router } from "express";
import lifecycleRoutes from "./lifecycle.routes.js";
import recordsRoutes from "./records.routes.js";

const router = Router();

router.use(recordsRoutes);
router.use(lifecycleRoutes);

export default router;
