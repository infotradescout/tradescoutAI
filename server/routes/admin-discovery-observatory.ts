import router from "./admin-discovery-evidence";
import { isAuthenticated, isSuperAdmin } from "../auth";
import { pool } from "../db";
import { createRequestStagesHandler } from "./discovery-request-stages";

// Preserve all existing evidence/capture routes and their original guards.
// This explicit guard also protects any reads appended by this module.
router.use(isAuthenticated, isSuperAdmin);
router.get("/request-stages", createRequestStagesHandler({ connect: () => pool.connect() }));
export default router;
