import { Router, type IRouter } from "express";
import healthRouter from "./health";
import labsRouter from "./labs";
import certsRouter from "./certs";
import sessionsRouter from "./sessions";
import configRouter from "./config";
import adminRouter from "./admin";
import passwordResetRouter from "./password-reset";
import registrationRouter from "./registration";

const router: IRouter = Router();

router.use(healthRouter);
router.use(certsRouter);
router.use(configRouter);
router.use(registrationRouter);
router.use(labsRouter);
router.use(sessionsRouter);
router.use("/admin", adminRouter);
router.use(passwordResetRouter);

export default router;
