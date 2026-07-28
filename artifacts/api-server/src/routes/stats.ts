import { Router, type IRouter } from "express"
import { getAllLabs } from "../lib/labs/registry"

const router: IRouter = Router()

router.get("/stats", async (_req, res): Promise<void> => {
  const labs = await getAllLabs()
  const tracks = new Set(labs.map(l => l.track)).size
  res.json({ labs: labs.length, tracks })
})

export default router
