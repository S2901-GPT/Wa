import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import healthRouter from "./health";
import obituaryRequestsRouter from "./obituary-requests";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(obituaryRequestsRouter);

export default router;
