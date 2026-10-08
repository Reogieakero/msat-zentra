import { Router } from "express";
import foldersRoutes from "./folders.routes.js";
import recordsRoutes from "./records.routes.js";
import signaturesRoutes from "./signatures.routes.js";

const router = Router();

router.use(recordsRoutes);
router.use(foldersRoutes);
router.use(signaturesRoutes);

export default router;
