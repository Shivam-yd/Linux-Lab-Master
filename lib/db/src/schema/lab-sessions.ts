import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per anonymous browser (identified via a long-lived cookie).
export const studentsTable = pgTable("students", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// The currently active (or most recently active) sandbox for a student+lab.
export const labSessionsTable = pgTable(
  "lab_sessions",
  {
    id: serial("id").primaryKey(),
    // FK ensures orphan rows can never accumulate when a student is cleaned up.
    studentId: text("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    labId: text("lab_id").notNull(),
    containerId: text("container_id"),
    containerName: text("container_name"),
    status: text("status").notNull().default("starting"), // starting | running | stopped | error
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Unique constraint enables ON CONFLICT DO UPDATE upserts and prevents
    // duplicate rows from concurrent requests for the same student+lab.
    uniqueIndex("uq_lab_sessions_student_lab").on(table.studentId, table.labId),
  ],
);

export const insertLabSessionSchema = createInsertSchema(
  labSessionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLabSession = z.infer<typeof insertLabSessionSchema>;
export type LabSessionRow = typeof labSessionsTable.$inferSelect;

// Best-known progress per student+lab, updated on every verify attempt.
export const labProgressTable = pgTable(
  "lab_progress",
  {
    id: serial("id").primaryKey(),
    // FK ensures orphan rows can never accumulate when a student is cleaned up.
    studentId: text("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    labId: text("lab_id").notNull(),
    status: text("status").notNull().default("not_started"), // not_started | in_progress | passed
    bestScore: integer("best_score").notNull().default(0),
    lastResults: jsonb("last_results"),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Unique constraint enables ON CONFLICT DO UPDATE upserts and prevents
    // duplicate rows from concurrent verify requests for the same student+lab.
    uniqueIndex("uq_lab_progress_student_lab").on(table.studentId, table.labId),
  ],
);

export const insertLabProgressSchema = createInsertSchema(
  labProgressTable,
).omit({ id: true, updatedAt: true });
export type InsertLabProgress = z.infer<typeof insertLabProgressSchema>;
export type LabProgressRow = typeof labProgressTable.$inferSelect;

// ─── Remote labs (fetched from GitHub) ───────────────────────────────────────

/** One row per lab pulled from the GitHub repo — definition stored as JSONB. */
export const remoteLabsTable = pgTable("remote_labs", {
  id: text("id").primaryKey(), // matches LabDefinition.id
  definition: jsonb("definition").notNull(), // full LabDefinition serialised
  sha: text("sha"), // GitHub blob SHA — used to skip unchanged files
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
export type RemoteLabRow = typeof remoteLabsTable.$inferSelect;

/** One row written after every sync attempt (background or manual). */
export const labSyncLogTable = pgTable("lab_sync_log", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(), // "success" | "error"
  labsAdded: integer("labs_added").notNull().default(0),
  labsUpdated: integer("labs_updated").notNull().default(0),
  totalRemote: integer("total_remote").notNull().default(0),
  errorMessage: text("error_message"),
  triggeredBy: text("triggered_by").notNull().default("auto"), // "auto" | "manual"
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type LabSyncLogRow = typeof labSyncLogTable.$inferSelect;
