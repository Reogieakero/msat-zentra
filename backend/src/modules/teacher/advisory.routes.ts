import { Router } from "express";
import claimRoutes from "./claim.routes.js";
import rosterRoutes from "./roster.routes.js";
import studentsRoutes from "./students.routes.js";
import sf10AccessRoutes from "./sf10-access.routes.js";
import modulesRoutes from "./modules.routes.js";

const router = Router();

router.use(studentsRoutes);
router.use(rosterRoutes);
router.use(claimRoutes);
router.use(sf10AccessRoutes);
router.use(modulesRoutes);

export default router;
