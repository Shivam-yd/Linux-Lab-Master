import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
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
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 1 week

/**
 * Auth middleware with two modes:
 *
 * • Better Auth mode: if a valid Better Auth session cookie is present,
 *   uses the authenticated user's ID. JIT-provisions a row in `students`.
 *
 * • Guest mode fallback: reads or creates a signed cookie (_sid) as the
 *   anonymous student ID. Uses SESSION_SECRET for cookie signing.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let userId: string | null = null;

    // ── Better Auth session ────────────────────────────────────────────────
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    userId = session?.user?.id ?? null;

    // When a real auth session is present, clear any lingering guest cookie
    // so the two identities can never bleed into each other.
    if (userId && req.signedCookies[GUEST_COOKIE]) {
      res.clearCookie(GUEST_COOKIE);
    }

    if (!userId) {
      // ── Guest / cookie auth ──────────────────────────────────────────────
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
          // Mark secure when the request arrived over HTTPS (nginx sets X-Forwarded-Proto).
          secure: req.secure || req.headers["x-forwarded-proto"] === "https",
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
