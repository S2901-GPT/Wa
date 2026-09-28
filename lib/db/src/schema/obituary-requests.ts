import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const obituaryRequestsTable = pgTable("obituary_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").notNull().unique(),
  deceasedName: text("deceased_name").notNull(),
  status: text("status").notNull().default("new"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ObituaryRequestRow = typeof obituaryRequestsTable.$inferSelect;