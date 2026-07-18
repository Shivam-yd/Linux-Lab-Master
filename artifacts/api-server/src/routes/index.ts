import { Router, type IRouter } from "express";
import healthRouter from "./health";
import labsRouter from "./labs";
import sessionsRouter from "./sessions";
import configRouter from "./config";
import adminRouter from "./admin";
import passwordResetRouter from "./password-reset";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(labsRouter);
router.use(sessionsRouter);
router.use(adminRouter);
router.use(passwordResetRouter);

export default router;
