import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import aiRouter from "./ai";
import healthRouter from "./health";
import obituaryRequestsRouter, { labObituaryRequestsRouter } from "./obituary-requests";
import labRouter from "./lab";
import posterSettingsRouter from "./poster-settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(obituaryRequestsRouter);
router.use(labObituaryRequestsRouter);
router.use(labRouter);
router.use(posterSettingsRouter);
router.use(aiRouter);

export default router;
