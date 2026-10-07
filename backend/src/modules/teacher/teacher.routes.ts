import { Router } from "express";
import directoryRoutes from "./directory.routes.js";
import overviewRoutes from "./overview.routes.js";
import settingsRoutes from "./settings.routes.js";
import timetableRoutes from "./timetable.routes.js";

// Teacher workspace — thin mount only. Endpoint groups live in sibling
// routers by responsibility (overview, settings, teacher directory, class
// timetable); business logic lives in src/services/teacher/*.service.ts;
// request schemas in teacher.schemas.ts; shared data-access in
// teacher.repository.ts. Mount order is order-insensitive, except the
// DELETE /schedule/:id wildcard stays last inside timetable.routes.ts.
// NOTE: grade-flags, advisory, and grading sub-routers mount separately in
// app.ts and are unaffected.
const router = Router();

router.use(overviewRoutes);
router.use(settingsRoutes);
router.use(directoryRoutes);
router.use(timetableRoutes);

export default router;
