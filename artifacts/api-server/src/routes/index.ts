import { Router, type IRouter } from "express";
import healthRouter from "./health";
import labsRouter from "./labs";
import statsRouter from "./stats";
import certsRouter from "./certs";
import sessionsRouter from "./sessions";
import configRouter from "./config";
import adminRouter from "./admin";
import passwordResetRouter from "./password-reset";
import registrationRouter from "./registration";
import accountRouter from "./account";
import uiProxyRouter from "./ui-proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(statsRouter);
router.use(certsRouter);
router.use(configRouter);
router.use(registrationRouter);
// Mount admin before the auth-gated labs router. Otherwise /admin/check is
// intercepted by labsRouter's requireAuth middleware.
router.use("/admin", adminRouter);
router.use(labsRouter);
router.use(sessionsRouter);
router.use(uiProxyRouter);
router.use(passwordResetRouter);
router.use(accountRouter);

export default router;
