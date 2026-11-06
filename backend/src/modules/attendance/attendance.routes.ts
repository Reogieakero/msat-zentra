import { Router } from "express";
import heatmapsRoutes from "./heatmaps.routes.js";
import legacyRoutes from "./legacy.routes.js";
import sectionsRoutes from "./sections.routes.js";
import studentsRoutes from "./students.routes.js";
import subjectsRoutes from "./subjects.routes.js";
import takingRoutes from "./taking.routes.js";

const router = Router();

router.use(takingRoutes);
router.use(heatmapsRoutes);
router.use(sectionsRoutes);
router.use(studentsRoutes);
router.use(subjectsRoutes);
router.use(legacyRoutes);

export default router;
