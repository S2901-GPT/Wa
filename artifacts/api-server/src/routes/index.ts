import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import aiRouter from "./ai";
import healthRouter from "./health";
import obituaryRequestsRouter from "./obituary-requests";
import posterSettingsRouter from "./poster-settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(obituaryRequestsRouter);
router.use(posterSettingsRouter);
router.use(aiRouter);

export default router;
