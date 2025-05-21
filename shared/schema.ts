import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// PostgreSQL business table (for temporary storage)
export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  location: text("location"),
  distance: text("distance"),
  isBadLead: boolean("is_bad_lead").default(false).notNull(),
  notes: text("notes"),
  isDuplicate: boolean("is_duplicate").default(false),
  careerLink: text("career_link"),
});

export const insertBusinessSchema = createInsertSchema(businesses).omit({
  id: true,
});

export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businesses.$inferSelect;

// MongoDB schemas (for user accounts and saved business lists)
export const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

export type UserCreate = z.infer<typeof userSchema>;
export type UserLogin = z.infer<typeof loginSchema>;

export interface User {
  _id?: string;
  email: string;
  password: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const savedBusinessSchema = z.object({
  userId: z.string(),
  name: z.string(),
  website: z.string().optional(),
  location: z.string().optional(),
  distance: z.string().optional(),
  isBadLead: z.boolean().default(false),
  notes: z.string().optional(),
  careerLink: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export type SavedBusiness = z.infer<typeof savedBusinessSchema> & {
  _id?: string;
};

export const savedListSchema = z.object({
  userId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  businesses: z.array(z.string()).optional(), // Array of business IDs
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export type SavedList = z.infer<typeof savedListSchema> & {
  _id?: string;
};

// Search parameters
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

export const importBusinessSchema = z.object({
  isBadLead: z.boolean().default(false),
  name: z.string(),
  website: z.string().optional(),
  careerLink: z.string().optional(),
  location: z.string().optional(),
  distance: z.string().optional(),
  notes: z.string().optional(),
});

export type ImportBusiness = z.infer<typeof importBusinessSchema>;
