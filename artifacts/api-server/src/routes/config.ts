import { Router } from "express";

const router = Router();

// Exposes runtime feature flags to the frontend without leaking secrets.
router.get("/config", (_req, res) => {
  res.json({
    googleEnabled: !!(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    enforcePlans: process.env.ENFORCE_PLANS !== "false",
  });
});

export default router;
