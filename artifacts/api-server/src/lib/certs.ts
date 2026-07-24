import { createHash } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { certRecordsTable, labProgressTable } from "@workspace/db/schema";
import { getAllLabs } from "./labs/registry";

/** Deterministic ID — same student+track+level always produces the same 16-char hex string. */
export function makeCertId(studentId: string, track: string, level?: number | null) {
  const key = level != null ? `${studentId}:${track}:level:${level}` : `${studentId}:${track}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 16).toUpperCase();
}

/**
 * Issue (or refresh) a cert after checking the student has passed every lab
 * in the given track/level. Returns the certId on success, null if incomplete.
 */
export async function issueCert(
  studentId: string,
  studentName: string,
  track: string,
  level?: number | null,
): Promise<string | null> {
  const allLabs = await getAllLabs();
  const scoped = allLabs.filter(l => l.track === track && (level == null || l.level === level));
  if (!scoped.length) return null;

  const passed = await db
    .select({ lastAttemptAt: labProgressTable.lastAttemptAt })
    .from(labProgressTable)
    .where(and(
      eq(labProgressTable.studentId, studentId),
      eq(labProgressTable.status, "passed"),
      inArray(labProgressTable.labId, scoped.map(l => l.id)),
    ));

  if (passed.length < scoped.length) return null;

  const earnedAt = passed
    .map(r => r.lastAttemptAt)
    .filter((d): d is Date => d != null)
    .reduce<Date>((max, d) => (d > max ? d : max), new Date(0));
  const expiresAt = new Date(earnedAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const certId = makeCertId(studentId, track, level);

  await db.execute(sql`
    INSERT INTO cert_records (cert_id, student_id, student_name, track, level, earned_at, expires_at)
    VALUES (${certId}, ${studentId}, ${studentName}, ${track}, ${level ?? null}, ${earnedAt}, ${expiresAt})
    ON CONFLICT (cert_id) DO UPDATE SET
      student_name = EXCLUDED.student_name,
      earned_at    = EXCLUDED.earned_at,
      expires_at   = EXCLUDED.expires_at
  `);

  return certId;
}
