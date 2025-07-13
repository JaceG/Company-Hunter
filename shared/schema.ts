import { z } from "zod";

// Business schema for in-memory search results
export const businessSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  website: z.string().optional(),
  location: z.string().optional(),
  distance: z.string().optional(),
  isBadLead: z.boolean().default(false),
  notes: z.string().optional(),
  isDuplicate: z.boolean().default(false).optional(),
  careerLink: z.string().optional(),
});

export const insertBusinessSchema = businessSchema.omit({
  id: true,
});

export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = z.infer<typeof businessSchema>;

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

// API Keys management for multi-user support
export const apiKeysSchema = z.object({
  userId: z.string(),
  googlePlacesApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export type ApiKeys = z.infer<typeof apiKeysSchema> & {
  _id?: string;
};

// State-based search parameters
export const stateSearchParamsSchema = z.object({
  businessType: z.string().min(1, "Business type is required"),
  state: z.string().min(2, "State is required"),
  maxCities: z.number().min(1).max(5).default(5), // Reduced for compliance
  maxResults: z.string().or(z.number()),
});

export type StateSearchParams = z.infer<typeof stateSearchParamsSchema>;

// Temporary search results table schema (compliant with Google ToS)
export const temporarySearchResultSchema = z.object({
  id: z.number().optional(),
  sessionId: z.string().min(1, "Session ID is required"),
  name: z.string().min(1, "Name is required"),
  website: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  distance: z.string().min(1, "Distance is required"),
  isBadLead: z.boolean().default(false),
  notes: z.string().default(""),
  careerLink: z.string().default(""),
  createdAt: z.date().default(() => new Date()),
  expiresAt: z.date().default(() => new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24 hour expiry
});

export type TemporarySearchResult = z.infer<typeof temporarySearchResultSchema>;
