import { Router } from "express";
import catalogRoutes from "./academics-catalog.routes.js";
import sectionsRoutes from "./academics-sections.routes.js";
import advisersRoutes from "./academics-advisers.routes.js";

const router = Router();

router.use(catalogRoutes);
router.use(sectionsRoutes);
router.use(advisersRoutes);

export default router;
