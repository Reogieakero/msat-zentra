import { Router } from "express";
import claimRoutes from "./claim.routes.js";
import rosterRoutes from "./roster.routes.js";
import studentsRoutes from "./students.routes.js";
import sf10AccessRoutes from "./sf10-access.routes.js";
import sf10AutofillRoutes from "./sf10-autofill.routes.js";
import modulesRoutes from "./modules.routes.js";
import interventionsRoutes from "./interventions.routes.js";

const router = Router();

router.use(studentsRoutes);
router.use(rosterRoutes);
router.use(claimRoutes);
router.use(sf10AccessRoutes);
router.use(sf10AutofillRoutes);
router.use(modulesRoutes);
router.use(interventionsRoutes);

export default router;
