import { bigserial, boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Permissions } from "@/lib/permissions";

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isAdmin: boolean("is_admin").notNull().default(false),
    // Users in this role are in the rotation for auto-assigned leads.
    receivesLeads: boolean("receives_leads").notNull().default(false),
    permissions: jsonb("permissions").$type<Permissions>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: uniqueIndex("roles_name_idx").on(t.name),
  })
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  })
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// A snapshot of a project (and the files chosen) shared with a client via a
// public link. The id is the unguessable token in /share/<id>.
export type SharePayload = {
  title: string;
  subtitle: string;
  sections: { heading: string; lines: string[] }[];
  files: { name: string; file: string }[]; // file = stored name (uuid.ext)
  note: string;
  clientName: string;
};

export const shares = pgTable("shares", {
  id: text("id").primaryKey(),
  payload: jsonb("payload").$type<SharePayload>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Shared ERP data -------------------------------------------------------
// One generic table holds every record of every module (projects, units,
// leads, realtors, visits, bookings), keyed by (collection, id).
export const erpRecords = pgTable(
  "erp_records",
  {
    collection: text("collection").notNull(),
    id: text("id").notNull(),
    data: jsonb("data").$type<Record<string, any>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull().default(""),
  },
  (t) => ({ pk: primaryKey({ columns: [t.collection, t.id] }) })
);

// Atomic per-collection counters so two users never get the same ID.
export const erpCounters = pgTable("erp_counters", {
  name: text("name").primaryKey(),
  value: integer("value").notNull().default(0),
});

export const activityLog = pgTable("activity_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userName: text("user_name").notNull(),
  action: text("action").notNull(), // created | updated | deleted | auto
  collection: text("collection").notNull(),
  recordId: text("record_id").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
