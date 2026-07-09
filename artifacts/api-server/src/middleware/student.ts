import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { parseCookie as parseCookieHeader } from "cookie";
import { unsign } from "cookie-signature";
import { db } from "@workspace/db";
import { studentsTable } from "@workspace/db/schema";

const COOKIE_NAME = "linuxlabs_student_id";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      studentId: string;
    }
  }
}

export async function studentIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signedCookies = req.signedCookies as Record<string, string> | undefined;
    let studentId = signedCookies?.[COOKIE_NAME];

    if (!studentId) {
      studentId = randomUUID();
      res.cookie(COOKIE_NAME, studentId, {
        maxAge: ONE_YEAR_MS,
        httpOnly: true,
        sameSite: "lax",
        signed: true,
      });
    }

    await db
      .insert(studentsTable)
      .values({ id: studentId })
      .onConflictDoNothing();

    req.studentId = studentId;
    next();
  } catch (err) {
    next(err);
  }
}

export function studentIdFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const parsed = parseCookieHeader(cookieHeader);
  const raw = parsed[COOKIE_NAME];
  if (!raw) return null;

  // cookie-parser signs cookies as "s:<value>.<hmac>", URI-encoded on the wire.
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("s:")) return null;

  const unsigned = unsign(decoded.slice(2), secret);
  return unsigned === false ? null : unsigned;
}
