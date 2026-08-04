import { integer, jsonb, pgTable, serial, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const adminAuditLogTable = pgTable(
  "admin_audit_log",
  {
    id: serial("id").primaryKey(),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_admin_audit_created_at").on(table.createdAt)],
);

export const cleanupRunsTable = pgTable(
  "cleanup_runs",
  {
    id: serial("id").primaryKey(),
    status: text("status").notNull(), // running | success | error
    deletedRows: integer("deleted_rows").notNull().default(0),
    stoppedSessions: integer("stopped_sessions").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("idx_cleanup_runs_started_at").on(table.startedAt)],
);

export const errorEventsTable = pgTable(
  "error_events",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(), // api | verify | cleanup | docker
    message: text("message").notNull(),
    route: text("route"),
    method: text("method"),
    statusCode: integer("status_code"),
    fingerprint: text("fingerprint"),
    context: jsonb("context"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_error_events_created_at").on(table.createdAt)],
);

export type AdminAuditLogRow = typeof adminAuditLogTable.$inferSelect;
export type CleanupRunRow = typeof cleanupRunsTable.$inferSelect;
export type ErrorEventRow = typeof errorEventsTable.$inferSelect;