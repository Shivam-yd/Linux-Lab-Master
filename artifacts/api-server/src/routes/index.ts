import { Router, type IRouter } from "express";
import healthRouter from "./health";
import labsRouter from "./labs";
import sessionsRouter from "./sessions";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(labsRouter);
router.use(sessionsRouter);

export default router;
