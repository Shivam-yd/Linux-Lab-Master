import { db } from "@workspace/db";
import { adminAuditLogTable, errorEventsTable } from "@workspace/db/schema";
import type { Request } from "express";

export async function recordAdminAudit(
  req: Request,
  statusCode: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const actorEmail = req.adminEmail;
  if (!actorEmail || req.path === "/operations/audit" || (req as Request & { skipAdminAudit?: boolean }).skipAdminAudit) return;
  await db.insert(adminAuditLogTable).values({
    actorEmail,
    action: `${req.method} ${req.path}`,
    method: req.method,
    path: req.path,
    statusCode,
    metadata: metadata ?? null,
  });
}

export async function recordErrorEvent(input: {
  source: string;
  error: unknown;
  req?: Request;
  statusCode?: number;
  context?: Record<string, unknown>;
}): Promise<void> {
  const error = input.error instanceof Error ? input.error : new Error(String(input.error));
  try {
    await db.insert(errorEventsTable).values({
      source: input.source,
      message: error.message.slice(0, 2000),
      route: input.req?.path ?? null,
      method: input.req?.method ?? null,
      statusCode: input.statusCode ?? null,
      fingerprint: `${input.source}:${error.message.slice(0, 200)}`,
      context: input.context ?? null,
    });
  } catch {
    // Error tracking must never turn the original failure into a second failure.
  }
}