import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { db } from "@workspace/db";
import { studentsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
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
 * Re-assigns lab_progress and lab_sessions from a guest ID to an authenticated
 * user ID, then deletes the orphaned guest student row.
 * Only migrates rows for labs the authenticated user hasn't touched yet.
 */
/** Returns the number of lab_progress rows successfully migrated. */
async function claimGuestProgress(guestId: string, userId: string): Promise<number> {
  try {
    // Ensure the authenticated user has a students row first.
    await db.insert(studentsTable).values({ id: userId }).onConflictDoNothing();

    // Move progress rows that don't conflict with existing authenticated progress.
    const progressResult = await db.execute(sql`
      UPDATE lab_progress
      SET student_id = ${userId}
      WHERE student_id = ${guestId}
        AND lab_id NOT IN (
          SELECT lab_id FROM lab_progress WHERE student_id = ${userId}
        )
    `);

    // Move session rows that don't conflict.
    await db.execute(sql`
      UPDATE lab_sessions
      SET student_id = ${userId}
      WHERE student_id = ${guestId}
        AND lab_id NOT IN (
          SELECT lab_id FROM lab_sessions WHERE student_id = ${userId}
        )
    `);

    // Delete the guest student row (cascades any remaining orphaned rows).
    await db.execute(sql`DELETE FROM students WHERE id = ${guestId}`);

    return (progressResult.rowCount ?? 0) as number;
  } catch {
    // Never block the request if migration fails — guest just starts fresh.
    return 0;
  }
}

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

    // When a real auth session is present, migrate any guest progress then
    // clear the guest cookie so the two identities never bleed into each other.
    if (userId && req.signedCookies[GUEST_COOKIE]) {
      const guestId = req.signedCookies[GUEST_COOKIE] as string;
      const claimed = await claimGuestProgress(guestId, userId);
      res.clearCookie(GUEST_COOKIE);
      if (claimed > 0) {
        // JS-readable cookie (httpOnly: false) so the frontend can show a toast.
        res.cookie("_guest_claimed", String(claimed), {
          maxAge: 60_000,
          httpOnly: false,
          sameSite: "lax",
          path: "/",
          secure: req.secure || req.headers["x-forwarded-proto"] === "https",
        });
      }
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
