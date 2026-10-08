import { Router } from "express";
import directoryRoutes from "./directory.routes.js";
import overviewRoutes from "./overview.routes.js";
import settingsRoutes from "./settings.routes.js";
import timetableRoutes from "./timetable.routes.js";

const router = Router();

router.use(overviewRoutes);
router.use(settingsRoutes);
router.use(directoryRoutes);
router.use(timetableRoutes);

export default router;
