import { Router } from "express";
import claimRoutes from "./claim.routes.js";
import rosterRoutes from "./roster.routes.js";
import studentsRoutes from "./students.routes.js";

// Adviser workspace — thin mount only. Endpoint groups live in sibling
// routers by responsibility (advisee students, roster enlistment + sheet
// prefill, section claiming); business logic lives in
// src/services/advisory/*.service.ts; request schemas in
// advisory.schemas.ts; shared data-access in advisory.repository.ts.
// Mount order is order-insensitive (all paths are distinct).
const router = Router();

router.use(studentsRoutes);
router.use(rosterRoutes);
router.use(claimRoutes);

export default router;
