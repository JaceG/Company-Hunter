import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  location: text("location"),
  distance: text("distance"),
  isBadLead: boolean("is_bad_lead").default(false).notNull(),
  notes: text("notes"),
});

export const insertBusinessSchema = createInsertSchema(businesses).omit({
  id: true,
});

export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businesses.$inferSelect;

export const searchParamsSchema = z.object({
  businessType: z.string().min(1, "Business type is required"),
  location: z.string().min(1, "Location is required"),
  radius: z.string().or(z.number()),
  maxResults: z.string().or(z.number()),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

export const searchResultSchema = z.object({
  businesses: z.array(insertBusinessSchema),
  total: z.number(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;
