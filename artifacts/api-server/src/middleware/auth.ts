import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
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
 * Auth middleware: requires a valid Better Auth session.
 * JIT-provisions a row in `students` on first request.
 * Returns 401 if no authenticated session is present.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    const userId = session?.user?.id ?? null;

    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
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
