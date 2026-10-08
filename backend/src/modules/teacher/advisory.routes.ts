import { Router } from "express";
import claimRoutes from "./claim.routes.js";
import rosterRoutes from "./roster.routes.js";
import studentsRoutes from "./students.routes.js";

const router = Router();

router.use(studentsRoutes);
router.use(rosterRoutes);
router.use(claimRoutes);

export default router;
