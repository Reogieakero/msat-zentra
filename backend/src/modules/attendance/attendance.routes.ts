import { Router } from "express";
import heatmapsRoutes from "./heatmaps.routes.js";
import legacyRoutes from "./legacy.routes.js";
import sectionsRoutes from "./sections.routes.js";
import studentsRoutes from "./students.routes.js";
import subjectsRoutes from "./subjects.routes.js";
import takingRoutes from "./taking.routes.js";

// Attendance — thin mount only. Endpoint groups live in sibling routers by
// responsibility (taking writes, heatmaps, section reads, student reads,
// subject reads, frozen legacy archive); business logic lives in
// src/services/attendance/*.service.ts; request schemas in
// attendance.schemas.ts; shared data-access in attendance.repository.ts.
// The generic attendance engine stays in src/services/attendance.ts.
// Mount order is order-insensitive (all paths are distinct).
const router = Router();

router.use(takingRoutes);
router.use(heatmapsRoutes);
router.use(sectionsRoutes);
router.use(studentsRoutes);
router.use(subjectsRoutes);
router.use(legacyRoutes);

export default router;
