import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  jsonb,
  timestamp,
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
export const labSessionsTable = pgTable("lab_sessions", {
  id: serial("id").primaryKey(),
  studentId: text("student_id").notNull(),
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
});

export const insertLabSessionSchema = createInsertSchema(
  labSessionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLabSession = z.infer<typeof insertLabSessionSchema>;
export type LabSessionRow = typeof labSessionsTable.$inferSelect;

// Best-known progress per student+lab, updated on every verify attempt.
export const labProgressTable = pgTable("lab_progress", {
  id: serial("id").primaryKey(),
  studentId: text("student_id").notNull(),
  labId: text("lab_id").notNull(),
  status: text("status").notNull().default("not_started"), // not_started | in_progress | passed
  bestScore: integer("best_score").notNull().default(0),
  lastResults: jsonb("last_results"),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertLabProgressSchema = createInsertSchema(
  labProgressTable,
).omit({ id: true, updatedAt: true });
export type InsertLabProgress = z.infer<typeof insertLabProgressSchema>;
export type LabProgressRow = typeof labProgressTable.$inferSelect;
