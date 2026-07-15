import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { studentsTable } from "@workspace/db/schema";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      studentId: string;
    }
  }
}

/**
 * Requires a signed-in Clerk user. On first request from a given user,
 * JIT-provisions a row in `students` keyed by the Clerk user id so progress
 * (lab_progress, lab_sessions) can key off `req.studentId` unchanged.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = getAuth(req);
    const userId = auth?.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await db
      .insert(studentsTable)
      .values({ id: userId })
      .onConflictDoNothing();

    req.studentId = userId;
    next();
  } catch (err) {
    next(err);
  }
}
