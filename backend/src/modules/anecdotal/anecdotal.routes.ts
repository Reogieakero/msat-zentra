import { Router } from "express";
import foldersRoutes from "./folders.routes.js";
import recordsRoutes from "./records.routes.js";
import signaturesRoutes from "./signatures.routes.js";

// Anecdotal records — thin mount only. Endpoint groups live in sibling
// routers by responsibility (filings + reads, owner folders, drawn-signature
// sign-off); business logic lives in src/services/anecdotal/*.service.ts;
// request schemas in anecdotal.schemas.ts; shared data-access in
// anecdotal.repository.ts. The OCForm-01 workbook builder stays in
// ocform01.service.ts. Mount order is order-insensitive.
const router = Router();

router.use(recordsRoutes);
router.use(foldersRoutes);
router.use(signaturesRoutes);

export default router;
