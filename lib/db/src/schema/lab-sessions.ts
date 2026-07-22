import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
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
    // Used by the cleanup job (stopExpiredSessions) to find running sessions
    // older than 1 hour without a full table scan.
    index("idx_lab_sessions_status_updated").on(table.status, table.updatedAt),
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
    // Supports per-lab analytics (cohort stats, leaderboard) without a full scan.
    index("idx_lab_progress_lab_id").on(table.labId),
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
  active: boolean("active").notNull().default(true), // admin can disable a lab without a deploy
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
export type RemoteLabRow = typeof remoteLabsTable.$inferSelect;

/** One row per admin-approved password-reset request. */
export const passwordResetRequestsTable = pgTable("password_reset_requests", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | used
  resetToken: text("reset_token"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  // When the reset token expires (set at approval time, mirrors Better Auth's token TTL).
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});
export type PasswordResetRequestRow = typeof passwordResetRequestsTable.$inferSelect;

// ─── Registration control ─────────────────────────────────────────────────────

/** Single-row settings table (id always = 1). */
export const registrationSettingsTable = pgTable("registration_settings", {
  id: integer("id").primaryKey().default(1),
  mode: text("mode").notNull().default("open"), // open | invite_only | invite_or_request
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
export type RegistrationMode = "open" | "invite_only" | "invite_or_request";
export type RegistrationSettingsRow = typeof registrationSettingsTable.$inferSelect;

/** Pre-approved email addresses allowed to create accounts. */
export const registrationInvitesTable = pgTable("registration_invites", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});
export type RegistrationInviteRow = typeof registrationInvitesTable.$inferSelect;

/** Account creation requests submitted by prospective students. */
export const registrationRequestsTable = pgTable(
  "registration_requests",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | denied
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Prevents duplicate requests for the same email and makes the race-safe
    // onConflictDoNothing insert in registration.ts actually atomic.
    uniqueIndex("uq_reg_req_email").on(table.email),
  ],
);
export type RegistrationRequestRow = typeof registrationRequestsTable.$inferSelect;

/** One cert record written when a student shares their certificate. */
export const certRecordsTable = pgTable("cert_records", {
  certId:      text("cert_id").primaryKey(),
  studentName: text("student_name").notNull(),
  track:       text("track").notNull(),
  level:       integer("level"),
  earnedAt:    timestamp("earned_at", { withTimezone: true }).notNull(),
});
export type CertRecordRow = typeof certRecordsTable.$inferSelect;

/** One difficulty rating per student per lab (upserted on submission). */
export const labRatingsTable = pgTable(
  "lab_ratings",
  {
    studentId: text("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
    labId:     text("lab_id").notNull(),
    rating:    text("rating").notNull(), // 'easy' | 'ok' | 'hard'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_lab_ratings_student_lab").on(table.studentId, table.labId)],
);
export type LabRatingRow = typeof labRatingsTable.$inferSelect;

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
