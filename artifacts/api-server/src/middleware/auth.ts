import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { studentsTable } from "@workspace/db/schema";
import { v4 as uuidv4 } from "uuid";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      studentId: string;
    }
  }
}

const GUEST_COOKIE = "_sid";
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365 * 5; // 5 years

/**
 * Auth middleware with two modes:
 *
 * • Clerk mode (CLERK_SECRET_KEY is set): requires a signed-in Clerk user.
 *   JIT-provisions a row in `students` keyed by the Clerk user id.
 *
 * • Guest mode (no CLERK_SECRET_KEY): self-hosted / no-auth fallback.
 *   Reads or creates a signed cookie (_sid) as the anonymous student ID.
 *   Uses SESSION_SECRET for cookie signing via cookie-parser.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let userId: string | null = null;

    if (process.env.CLERK_SECRET_KEY) {
      // ── Clerk auth with guest fallback ─────────────────────────────────────
      // Prefer a signed-in Clerk session; fall back to a guest cookie so
      // unauthenticated users can still use labs without creating an account.
      const auth = getAuth(req);
      userId = auth?.userId ?? null;
    }

    if (!userId) {
      // ── Guest / cookie auth ────────────────────────────────────────────────
      // req.signedCookies is populated by cookie-parser(SESSION_SECRET) in app.ts
      const existing = req.signedCookies[GUEST_COOKIE] as string | undefined;
      if (existing) {
        userId = existing;
      } else {
        userId = uuidv4();
        res.cookie(GUEST_COOKIE, userId, {
          signed: true,
          maxAge: COOKIE_MAX_AGE_MS,
          httpOnly: true,
          sameSite: "lax",
        });
      }
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
