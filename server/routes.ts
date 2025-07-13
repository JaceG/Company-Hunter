import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertBusinessSchema, 
  searchParamsSchema, 
  importBusinessSchema, 
  type ImportBusiness,
  userSchema,
  loginSchema,
  savedBusinessSchema,
  savedListSchema,
  apiKeysSchema,
  stateSearchParamsSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import OpenAI from "openai";
import { 
  connectToMongoDB, 
  createUser, 
  loginUser, 
  getSavedBusinesses, 
  saveBusiness, 
  updateSavedBusiness, 
  deleteSavedBusiness,
  deleteAllSavedBusinesses,
  importBusinessesForUser,
  getSavedLists,
  createSavedList,
  getSavedListById,
  updateSavedList,
  deleteSavedList,
  addBusinessToList,
  removeBusinessFromList,
  getBusinessesForList,
  saveApiKeys,
  getApiKeys,
  deleteApiKeys
} from './mongodb';
import { authenticate, optionalAuth } from './middleware/auth';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI-powered search term and location generation for job-focused searches
async function generateJobFocusedSearchTerms(jobRole: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a job search expert who understands what types of companies hire specific roles. Generate comprehensive search terms for finding companies that would hire a specific job role. Return ONLY valid JSON in the exact format requested."
        },
        {
          role: "user",
          content: `Generate 12-18 search terms for companies that would likely hire "${jobRole}". Think about:
          - Different company types in that industry
          - Related business sectors
          - Company sizes (startups, agencies, enterprises)
          - Specific niches within the field
          
          For example, if the job role is "web developer", include terms like:
          "software company", "web development agency", "digital marketing agency", "tech startup", "IT consulting", "e-commerce company", "SaaS company", "mobile app development", "custom software development", "digital agency", "marketing technology company", etc.
          
          If the job role is "graphic designer", include terms like:
          "design agency", "marketing agency", "advertising agency", "branding company", "print shop", "digital marketing company", "creative agency", "web design company", etc.
          
          Focus on actual business types, not job titles. Return JSON in this exact format: {"terms": ["term1", "term2", "term3"]}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{"terms": []}');
    console.log("OpenAI generated search terms:", result);
    return result.terms && result.terms.length > 0 ? result.terms : [`${jobRole} company`];
  } catch (error) {
    console.error("Error generating job-focused search terms:", error);
    // Provide intelligent fallback terms based on common job roles
    if (jobRole.toLowerCase().includes('web') || jobRole.toLowerCase().includes('developer') || jobRole.toLowerCase().includes('software')) {
      return [
        "software company",
        "web development agency", 
        "tech startup",
        "digital marketing agency",
        "IT consulting",
        "e-commerce company",
        "SaaS company",
        "mobile app development",
        "custom software development",
        "digital agency",
        "technology company",
        "software development company"
      ];
    }
    return [`${jobRole} company`]; // Final fallback
  }
}

async function getOhioCities(): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a geography expert specializing in Ohio. Return only a JSON array of strings, no other text."
        },
        {
          role: "user",
          content: "Provide a comprehensive list of 30-40 Ohio cities for business searches. Include major cities, mid-size cities, and important suburban areas. Start with the largest cities like Columbus, Cleveland, Cincinnati, Toledo, Akron, Dayton, etc. and include smaller cities that likely have businesses. Format as a JSON array of city names only (no state)."
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{"cities": []}');
    return result.cities || ["Columbus", "Cleveland", "Cincinnati"]; // Fallback
  } catch (error) {
    console.error("Error generating Ohio cities:", error);
    return ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton"]; // Fallback
  }
}

async function getTopCitiesForState(state: string, maxCities: number = 100): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a geography expert. Return only a JSON array of strings, no other text."
        },
        {
          role: "user",
          content: `Provide a comprehensive list of the top ${maxCities} cities in ${state} for business searches. Include major cities, mid-size cities, suburbs, county seats, and regional business centers. Start with the largest cities and include important business areas. Format as a JSON array of city names only (no state abbreviation).`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{"cities": []}');
    return result.cities && result.cities.length > 0 ? result.cities.slice(0, maxCities) : [`${state} cities`]; // Fallback
  } catch (error) {
    console.error(`Error generating top cities for ${state}:`, error);
    return [`${state} major cities`]; // Fallback
  }
}

async function getExpandedOhioCities(): Promise<string[]> {
  return getTopCitiesForState("Ohio", 80);
}

// Helper functions for comparing businesses
function normalizeDomain(url: string): string {
  try {
    if (!url) return '';
    
    // Extract just the main domain (example.com) for comparison
    const domainMatch = url.toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .match(/([a-z0-9-]+\.[a-z0-9-]+)/i);
    
    return domainMatch ? domainMatch[0] : '';
  } catch {
    return url.toLowerCase();
  }
}

function normalizeName(name: string): string {
  if (!name) return '';
  
  // Remove common business suffixes and lowercase
  return name.toLowerCase()
    .replace(/,?\s+(inc|llc|corporation|corp|co|company|ltd|limited)\.?$/i, '')
    .trim();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize MongoDB connection
  try {
    await connectToMongoDB();
    console.log("MongoDB connection established");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }

  // Google Places API endpoint
  const GOOGLE_PLACES_API_URL = "https://maps.googleapis.com/maps/api/place";
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

  // Helper function to convert miles to meters for Google Places API
  const milesToMeters = (miles: number) => Math.round(miles * 1609.34);

  // API caching to reduce repeated calls
  const geocodeCache = new Map<string, any>();
  const businessDetailsCache = new Map<string, any>();
  
  // Authentication routes
  
  // Register a new user
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = userSchema.parse(req.body);
      
      const result = await createUser(userData);
      
      // Don't send password back to client
      const { user } = result;
      const userWithoutPassword = { ...user };
      
      if ('password' in userWithoutPassword) {
        // @ts-ignore
        delete userWithoutPassword.password;
      }
      
      res.status(201).json({ 
        user: userWithoutPassword, 
        token: result.token 
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error registering user:", error);
      
      if (error.message === "Email already registered") {
        return res.status(409).json({ message: "Email already registered" });
      }
      
      res.status(500).json({ message: "An error occurred while registering user" });
    }
  });
  
  // Login user
  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginData = loginSchema.parse(req.body);
      
      const result = await loginUser(loginData.email, loginData.password);
      
      // Don't send password back to client
      const { user } = result;
      const userWithoutPassword = { ...user };
      
      if ('password' in userWithoutPassword) {
        // @ts-ignore
        delete userWithoutPassword.password;
      }
      
      res.json({ 
        user: userWithoutPassword, 
        token: result.token 
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error logging in:", error);
      
      if (error.message === "User not found" || error.message === "Invalid credentials") {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      res.status(500).json({ message: "An error occurred while logging in" });
    }
  });
  
  // Get current user
  app.get("/api/auth/user", authenticate, async (req, res) => {
    try {
      // User is already authenticated via middleware
      res.json({ 
        userId: req.user!.userId,
        email: req.user!.email
      });
    } catch (error) {
      console.error("Error getting user:", error);
      res.status(500).json({ message: "An error occurred while fetching user" });
    }
  });

  // API Keys Management
  
  // Get user's API keys
  app.get("/api/auth/api-keys", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const apiKeys = await getApiKeys(userId);
      
      // Don't send actual keys, just indication if they exist
      res.json({
        hasGooglePlacesKey: !!(apiKeys?.googlePlacesApiKey),
        hasOpenaiKey: !!(apiKeys?.openaiApiKey),
        updatedAt: apiKeys?.updatedAt
      });
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ message: "An error occurred while fetching API keys" });
    }
  });

  // Save/Update user's API keys
  app.post("/api/auth/api-keys", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { googlePlacesApiKey, openaiApiKey } = req.body;
      
      const apiKeys = await saveApiKeys(userId, {
        googlePlacesApiKey: googlePlacesApiKey || undefined,
        openaiApiKey: openaiApiKey || undefined
      });
      
      // Don't send actual keys back
      res.json({
        hasGooglePlacesKey: !!(apiKeys?.googlePlacesApiKey),
        hasOpenaiKey: !!(apiKeys?.openaiApiKey),
        updatedAt: apiKeys.updatedAt
      });
    } catch (error) {
      console.error("Error saving API keys:", error);
      res.status(500).json({ message: "An error occurred while saving API keys" });
    }
  });

  // Delete user's API keys
  app.delete("/api/auth/api-keys", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const deleted = await deleteApiKeys(userId);
      
      if (deleted) {
        res.json({ message: "API keys deleted successfully" });
      } else {
        res.status(404).json({ message: "No API keys found" });
      }
    } catch (error) {
      console.error("Error deleting API keys:", error);
      res.status(500).json({ message: "An error occurred while deleting API keys" });
    }
  });
  
  // User's saved businesses endpoints
  
  // Get user's saved businesses
  app.get("/api/my/businesses", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const businesses = await getSavedBusinesses(userId);
      res.json(businesses);
    } catch (error) {
      console.error("Error fetching saved businesses:", error);
      res.status(500).json({ message: "An error occurred while fetching saved businesses" });
    }
  });
  
  // Save a new business to user's list
  app.post("/api/my/businesses", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const businessData = savedBusinessSchema.parse({
        ...req.body,
        userId
      });
      
      const savedBusiness = await saveBusiness(businessData);
      res.status(201).json(savedBusiness);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error saving business:", error);
      res.status(500).json({ message: "An error occurred while saving business" });
    }
  });
  
  // Update a saved business
  app.patch("/api/my/businesses/:id", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const businessId = req.params.id;
      
      // Make sure business belongs to this user
      // Get user's businesses and find the one with matching ID
      const userBusinesses = await getSavedBusinesses(userId);
      const business = userBusinesses.find(b => b._id === businessId);
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      // Check is redundant now since we filtered by userId, but keeping for clarity
      if (business.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to update this business" });
      }
      
      const updates = req.body;
      const updatedBusiness = await updateSavedBusiness(businessId, updates);
      
      res.json(updatedBusiness);
    } catch (error) {
      console.error("Error updating saved business:", error);
      res.status(500).json({ message: "An error occurred while updating business" });
    }
  });
  
  // Delete all saved businesses for a user - using a completely different endpoint to avoid route conflicts
  app.delete("/api/my/clear-all-businesses", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const deletedCount = await deleteAllSavedBusinesses(userId);
      
      res.json({ 
        message: "All saved businesses deleted successfully", 
        count: deletedCount 
      });
    } catch (error) {
      console.error("Error deleting all saved businesses:", error);
      res.status(500).json({ message: "Failed to delete all saved businesses" });
    }
  });
  
  // Delete a saved business
  app.delete("/api/my/businesses/:id", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const businessId = req.params.id;
      
      // Get user's businesses and find the one with matching ID
      const userBusinesses = await getSavedBusinesses(userId);
      const business = userBusinesses.find(b => b._id === businessId);
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      // Check is redundant now since we filtered by userId, but keeping for clarity
      if (business.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to delete this business" });
      }
      
      const deleted = await deleteSavedBusiness(businessId);
      
      if (deleted) {
        res.json({ message: "Business deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete business" });
      }
    } catch (error) {
      console.error("Error deleting saved business:", error);
      res.status(500).json({ message: "An error occurred while deleting business" });
    }
  });
  
  // Import businesses from search results
  app.post("/api/my/businesses/import-from-search", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      
      // Get the businesses from the search results
      const searchBusinesses = await storage.getBusinesses();
      
      // Convert them to saved businesses format
      const businessesToImport = searchBusinesses
        .filter(b => !b.isBadLead) // Skip bad leads
        .map(b => ({
          name: b.name,
          website: b.website || '',
          location: b.location || '',
          distance: b.distance || '',
          isBadLead: false,
          notes: b.notes || '',
          careerLink: b.careerLink || '',
          userId
        }));
      
      if (businessesToImport.length === 0) {
        return res.status(400).json({ message: "No valid businesses to import" });
      }
      
      const result = await importBusinessesForUser(userId, businessesToImport);
      
      res.status(201).json({ 
        message: `Successfully imported ${result.count} businesses`,
        businesses: result.businesses
      });
    } catch (error) {
      console.error("Error importing businesses:", error);
      res.status(500).json({ message: "An error occurred while importing businesses" });
    }
  });
  

  
  // Import businesses from CSV
  app.post("/api/my/businesses/import-from-csv", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { csvData, skipDuplicates = true, replaceDuplicates = false } = req.body;
      
      if (!csvData) {
        return res.status(400).json({ message: "CSV data is required" });
      }
      
      // Parse CSV data
      const csvBusinesses = parseCSV(csvData);
      
      if (csvBusinesses.length === 0) {
        return res.status(400).json({ message: "No valid businesses found in CSV data" });
      }
      
      // Convert to saved businesses format
      const businessesToImport = csvBusinesses.map(b => ({
        ...b,
        userId
      }));
      
      // Get duplicate handling options
      const importOptions = {
        skipDuplicates,
        replaceDuplicates
      };
      
      const result = await importBusinessesForUser(userId, businessesToImport, {
        skipDuplicates,
        replaceDuplicates
      });
      
      res.status(201).json({ 
        message: `Successfully imported ${result.count} businesses from CSV`,
        businesses: result.businesses
      });
    } catch (error) {
      console.error("Error importing businesses from CSV:", error);
      res.status(500).json({ message: "An error occurred while importing businesses from CSV" });
    }
  });

  // Parse CSV data from string format with intelligent column detection
  // Focusing only on company name, website, and address
  function parseCSV(csvContent: string): ImportBusiness[] {
    const lines = csvContent.split('\n');
    
    // Handle various CSV formats - commas, semicolons, or tabs
    let separator = ',';
    if (lines[0].includes(';')) separator = ';';
    else if (lines[0].includes('\t')) separator = '\t';
    
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Intelligent column detection - focusing only on essential columns
    const columnMap = {
      name: -1,
      website: -1,
      location: -1
    };
    
    // Map column names to their index
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase();

      // Company name detection
      if (columnMap.name === -1 && (
          headerLower.includes('company') || 
          headerLower.includes('name') || 
          headerLower.includes('business') ||
          headerLower === 'organization'
        )) {
        columnMap.name = index;
      }
      
      // Website detection
      if (columnMap.website === -1 && (
          headerLower.includes('website') || 
          headerLower.includes('url') || 
          headerLower.includes('site') ||
          headerLower.includes('web')
        )) {
        columnMap.website = index;
      }
      
      // Location detection
      if (columnMap.location === -1 && (
          headerLower.includes('location') || 
          headerLower.includes('address') || 
          headerLower.includes('street') ||
          headerLower.includes('city') ||
          headerLower.includes('state')
        )) {
        columnMap.location = index;
      }
    });
    
    // If name column wasn't found, try to determine it by examining data
    if (columnMap.name === -1) {
      // If we couldn't find a good header, just use the first column as name
      columnMap.name = 0;
      
      // Unless we already identified that column as something else
      if (Object.values(columnMap).includes(0)) {
        // Try to find an unused column
        for (let i = 0; i < headers.length; i++) {
          if (!Object.values(columnMap).includes(i)) {
            columnMap.name = i;
            break;
          }
        }
      }
    }
    
    // If website column wasn't found but we have URLs in the data, find them
    if (columnMap.website === -1) {
      // Look at a sample row to try to identify website column
      for (let i = 1; i < Math.min(5, lines.length); i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
        for (let j = 0; j < values.length; j++) {
          // Skip columns we've already identified
          if (Object.values(columnMap).includes(j)) continue;
          
          // Check if column contains what looks like a URL
          if (values[j].match(/^https?:\/\//i) || values[j].match(/^www\./i) || values[j].match(/\.(com|org|net|io|co)/i)) {
            columnMap.website = j;
            break;
          }
        }
        if (columnMap.website !== -1) break;
      }
    }
    
    // If location column wasn't found, look for text that might contain address patterns
    if (columnMap.location === -1) {
      // Look at sample rows to find address-like patterns
      const addressRegex = /\b\d+\s+\w+\s+(st|street|ave|avenue|blvd|boulevard|rd|road|drive|dr|lane|ln|way)\b/i;
      const cityStateRegex = /\b(columbus|ohio|oh),?\s+\d{5}(-\d{4})?\b/i;
      
      for (let i = 1; i < Math.min(5, lines.length); i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
        for (let j = 0; j < values.length; j++) {
          // Skip columns we've already identified
          if (Object.values(columnMap).includes(j)) continue;
          
          // Check if column contains what looks like an address
          if (addressRegex.test(values[j]) || cityStateRegex.test(values[j])) {
            columnMap.location = j;
            break;
          }
        }
        if (columnMap.location !== -1) break;
      }
    }
    
    console.log("Column mapping:", columnMap);
    
    const businesses: ImportBusiness[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
      
      // Only add if we can extract a name (columnMap.name should always be valid)
      if (values[columnMap.name]) {
        const business: ImportBusiness = {
          name: values[columnMap.name],
          website: columnMap.website >= 0 ? values[columnMap.website] : undefined,
          location: columnMap.location >= 0 ? values[columnMap.location] : undefined,
          isBadLead: false, // Default values for other fields
          notes: '',
          distance: '',
          careerLink: undefined
        };
        
        businesses.push(business);
      }
    }
    
    return businesses;
  }

  // State-based search with top 100 cities
  app.post("/api/businesses/search/state", authenticate, async (req, res) => {
    try {
      const stateSearchParams = stateSearchParamsSchema.parse(req.body);
      const { businessType, state, maxCities, maxResults } = stateSearchParams;
      
      // Get user's API keys
      const userId = req.user!.userId;
      const userApiKeys = await getApiKeys(userId);
      
      const googleApiKey = userApiKeys?.googlePlacesApiKey || process.env.GOOGLE_PLACES_API_KEY;
      const openaiApiKey = userApiKeys?.openaiApiKey || process.env.OPENAI_API_KEY;
      
      if (!googleApiKey) {
        return res.status(400).json({ 
          message: "Google Places API key is required. Please set up your API keys in the app settings."
        });
      }
      
      if (!openaiApiKey) {
        return res.status(400).json({ 
          message: "OpenAI API key is required for generating state city lists. Please set up your API keys in the app settings."
        });
      }
      
      // Initialize OpenAI with user's key
      const userOpenai = new OpenAI({ apiKey: openaiApiKey });
      
      // Get top cities for the state
      let cities: string[] = [];
      try {
        const response = await userOpenai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a geography expert. Return only a JSON array of strings, no other text."
            },
            {
              role: "user",
              content: `Provide a comprehensive list of the top ${maxCities} cities in ${state} for business searches. Include major cities, mid-size cities, suburbs, county seats, and regional business centers. Start with the largest cities and include important business areas. Format as a JSON array of city names only (no state abbreviation).`
            }
          ],
          response_format: { type: "json_object" },
        });

        const result = JSON.parse(response.choices[0].message.content || '{"cities": []}');
        cities = result.cities && result.cities.length > 0 ? result.cities.slice(0, maxCities) : [`${state} cities`];
      } catch (error) {
        console.error(`Error generating cities for ${state}:`, error);
        return res.status(500).json({ 
          message: `Failed to generate city list for ${state}. Please check your OpenAI API key.`
        });
      }
      
      // Clear existing search results
      await storage.clearAllBusinesses();
      
      const businesses = [];
      let searchedCities = 0;
      
      for (const city of cities) {
        if (businesses.length >= Number(maxResults)) break;
        
        const textQuery = `${businessType} in ${city}, ${state}`;
        
        try {
          const placesResponse = await fetch(
            `${GOOGLE_PLACES_API_URL}/textsearch/json?query=${encodeURIComponent(textQuery)}&key=${googleApiKey}`
          );
          const placesData = await placesResponse.json();
          
          if (placesData.status === "OK" && placesData.results) {
            for (const place of placesData.results.slice(0, 3)) { // Max 3 per city
              if (businesses.length >= Number(maxResults)) break;
              
              // Get details with caching
              let details = businessDetailsCache.get(place.place_id);
              if (!details) {
                const detailsResponse = await fetch(
                  `${GOOGLE_PLACES_API_URL}/details/json?place_id=${place.place_id}&fields=name,website,formatted_address&key=${googleApiKey}`
                );
                const detailsData = await detailsResponse.json();
                
                if (detailsData.status === "OK") {
                  details = detailsData.result;
                  businessDetailsCache.set(place.place_id, details);
                } else {
                  continue;
                }
              }
              
              businesses.push({
                name: details.name || place.name,
                website: details.website || "",
                location: details.formatted_address || place.vicinity || "",
                distance: `${city}, ${state}`,
                isBadLead: false,
                notes: "",
                isDuplicate: false,
                careerLink: details.website ? `${details.website.replace(/\/+$/, '')}/careers` : ""
              });
            }
          }
          
          searchedCities++;
          
          // Small delay to respect rate limits
          if (searchedCities % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (cityError) {
          console.error(`Error searching ${city}:`, cityError);
          continue;
        }
      }
      
      // Store results and check for duplicates with user's saved businesses
      const savedBusinesses = await storage.saveBatchBusinesses(businesses);
      
      res.json({
        businesses: savedBusinesses,
        total: savedBusinesses.length,
        searchedCities,
        totalCities: cities.length
      });
      
    } catch (error) {
      console.error("Error in state search:", error);
      res.status(500).json({ message: "An error occurred during state search" });
    }
  });

  // Regular location-based search
  app.post("/api/businesses/search", optionalAuth, async (req, res) => {
    try {
      // Clear all existing businesses before performing a new search
      await storage.clearAllBusinesses();
      
      const searchParams = searchParamsSchema.parse(req.body);
      const { businessType, location, radius, maxResults } = searchParams;
      
      // Get API key (user's or system default)
      let googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (req.user?.userId) {
        const userApiKeys = await getApiKeys(req.user.userId);
        googleApiKey = userApiKeys?.googlePlacesApiKey || googleApiKey;
      }
      
      if (!googleApiKey) {
        return res.status(500).json({ 
          message: "Google Places API key is not configured"
        });
      }
      
      const maxResultsNum = Number(maxResults);
      const businesses = [];
      let nextPageToken = null;
      
      // Use different search approach for state-wide vs local searches
      const isStateWideSearch = radius === "0";
      
      if (isStateWideSearch) {
        // Use Text Search API for state-wide searches - much better coverage
        const textQuery = `${businessType} in ${location}`;
        
        do {
          let url = `${GOOGLE_PLACES_API_URL}/textsearch/json?query=${encodeURIComponent(textQuery)}&key=${googleApiKey}`;
          
          if (nextPageToken) {
            url += `&pagetoken=${nextPageToken}`;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          const placesResponse = await fetch(url);
          const placesData = await placesResponse.json();
          
          if (placesData.status !== "OK" && placesData.status !== "ZERO_RESULTS") {
            return res.status(400).json({ 
              message: "Failed to search businesses",
              details: placesData.status
            });
          }
          
          nextPageToken = placesData.next_page_token || null;
          const pageResults = placesData.results || [];
          const resultsToProcess = pageResults.slice(0, maxResultsNum - businesses.length);
          
          // Process results for text search
          for (const place of resultsToProcess) {
            const detailsResponse = await fetch(
              `${GOOGLE_PLACES_API_URL}/details/json?place_id=${place.place_id}&fields=name,website,formatted_address&key=${googleApiKey}`
            );
            
            const detailsData = await detailsResponse.json();
            
            if (detailsData.status === "OK") {
              const details = detailsData.result;
              
              businesses.push({
                name: details.name || place.name,
                website: details.website || '',
                location: details.formatted_address || place.formatted_address || '',
                distance: 'State-wide search',
                isBadLead: false,
                notes: '',
                careerLink: undefined
              });
            }
          }
          
        } while (nextPageToken && businesses.length < maxResultsNum);
        
      } else {
        // Use traditional nearby search for local searches
        const geocodeResponse = await fetch(
          `${GOOGLE_PLACES_API_URL}/findplacefromtext/json?input=${encodeURIComponent(location)}&inputtype=textquery&fields=geometry&key=${googleApiKey}`
        );
        
        const geocodeData = await geocodeResponse.json();
        
        if (geocodeData.status !== "OK" || !geocodeData.candidates || geocodeData.candidates.length === 0) {
          return res.status(400).json({ 
            message: "Could not find location coordinates",
            details: geocodeData.status
          });
        }
        
        const { lat, lng } = geocodeData.candidates[0].geometry.location;
        
        do {
          let url = `${GOOGLE_PLACES_API_URL}/nearbysearch/json?location=${lat},${lng}&radius=${milesToMeters(Number(radius))}&keyword=${encodeURIComponent(businessType)}&type=establishment&key=${googleApiKey}`;
        
        if (nextPageToken) {
          // Need to add pagetoken parameter if we have a token
          url += `&pagetoken=${nextPageToken}`;
          
          // Google requires a delay between pagination requests
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const placesResponse = await fetch(url);
        const placesData = await placesResponse.json();
        
        if (placesData.status !== "OK" && placesData.status !== "ZERO_RESULTS") {
          return res.status(400).json({ 
            message: "Failed to search businesses",
            details: placesData.status
          });
        }
        
        // Get the next page token if available
        nextPageToken = placesData.next_page_token || null;
        
        // Get results from this page
        const pageResults = placesData.results || [];
        
        // Only process up to the maximum number of requested results
        const resultsToProcess = pageResults.slice(0, maxResultsNum - businesses.length);
        
        // Process each place result to get additional details and format the response
        for (const place of resultsToProcess) {
          // Check cache first to avoid repeated API calls
          let details;
          if (businessDetailsCache.has(place.place_id)) {
            details = businessDetailsCache.get(place.place_id);
          } else {
            // Get additional details like website (keeping formatted_address since user needs it)
            const detailsResponse = await fetch(
              `${GOOGLE_PLACES_API_URL}/details/json?place_id=${place.place_id}&fields=name,website,formatted_address&key=${googleApiKey}`
            );
            
            const detailsData = await detailsResponse.json();
            
            if (detailsData.status === "OK") {
              details = detailsData.result;
              // Cache the result to avoid repeated calls
              businessDetailsCache.set(place.place_id, details);
            } else {
              continue; // Skip this place if details fail
            }
          }
            
          // Calculate distance (for demo purposes, using a formula based on lat/lng)
          // In a real app, we could use the Google Distance Matrix API
          const distance = calculateDistance(
            lat, lng, 
            place.geometry.location.lat, 
            place.geometry.location.lng
          );
          
          businesses.push({
            name: details.name || place.name,
            website: details.website || "",
            location: details.formatted_address || place.vicinity || "",
            distance: `${distance.toFixed(1)} mi`,
            isBadLead: false,
            notes: "",
            isDuplicate: false,
            careerLink: details.website ? `${details.website.replace(/\/+$/, '')}/careers` : ""
          });
        }
        
        console.log(`Fetched ${businesses.length}/${maxResultsNum} businesses so far, next page token: ${nextPageToken ? 'available' : 'none'}`);
        
        // Stop if we've reached the max results or this is the last page
        if (businesses.length >= maxResultsNum || !nextPageToken) {
          break;
        }
        
      } while (true); // End of do-while loop for pagination
      
      } // End of nearby search block
      
      // Get user's saved businesses if user is logged in
      let userSavedBusinesses: any[] = [];
      if (req.user && req.user.userId) {
        try {
          userSavedBusinesses = await getSavedBusinesses(req.user.userId);
          console.log(`Found ${userSavedBusinesses.length} saved businesses for user ${req.user.userId}`);
        } catch (err) {
          console.error("Error fetching saved businesses for duplicate check:", err);
        }
      }
      
      // Clear ALL previous search results before saving new ones
      await storage.clearAllBusinesses();
      
      // Store the results for later retrieval (this will be the only results in storage)
      const savedBusinesses = await storage.saveBatchBusinesses(businesses);
      
      // For marking duplicates based on user's saved businesses
      if (userSavedBusinesses.length > 0) {
        for (const business of savedBusinesses) {
          const isDuplicate = userSavedBusinesses.some(savedBusiness => {
            // Check website match (normalize domains first)
            if (business.website && savedBusiness.website) {
              const normalizeUrl = (url: string) => {
                return url.toLowerCase()
                  .replace(/^https?:\/\//i, '')
                  .replace(/^www\./i, '')
                  .replace(/\/+$/, '');
              };
              
              const businessDomain = normalizeUrl(business.website);
              const savedDomain = normalizeUrl(savedBusiness.website);
              
              if (businessDomain === savedDomain) return true;
            }
            
            // Check name match (normalize company names)
            if (business.name && savedBusiness.name) {
              const normalizeName = (name: string) => {
                return name.toLowerCase()
                  .replace(/\s*(inc|llc|ltd|corp|corporation)\s*\.?$/i, '')
                  .trim();
              };
              
              const businessName = normalizeName(business.name);
              const savedName = normalizeName(savedBusiness.name);
              
              if (businessName === savedName) return true;
            }
            
            // Check location match (normalize locations)
            if (business.location && savedBusiness.location) {
              const normalizeLocation = (location: string) => {
                return location.toLowerCase()
                  // Remove apartment/suite numbers
                  .replace(/(\s|,)+suite\s+\w+/i, '')
                  .replace(/(\s|,)+ste\.?\s+\w+/i, '')
                  .replace(/(\s|,)+apt\.?\s+\w+/i, '')
                  .replace(/(\s|,)+unit\s+\w+/i, '')
                  .replace(/(\s|,)+#\s*\w+/i, '')
                  // Remove floor indicators
                  .replace(/(\s|,)+floor\s+\w+/i, '')
                  .replace(/(\s|,)+fl\.?\s+\w+/i, '')
                  // Remove room numbers
                  .replace(/(\s|,)+room\s+\w+/i, '')
                  .replace(/(\s|,)+rm\.?\s+\w+/i, '')
                  // Standardize address components
                  .replace(/\bstreet\b/i, 'st')
                  .replace(/\bavenue\b/i, 'ave')
                  .replace(/\bboulevard\b/i, 'blvd')
                  .replace(/\bsuite\b/i, 'ste')
                  .trim();
              };
              
              const businessLocation = normalizeLocation(business.location);
              const savedLocation = normalizeLocation(savedBusiness.location);
              
              // Check if the core address matches
              if (businessLocation === savedLocation) return true;
              
              // Attempt to extract city and state/zip if full match fails
              const extractCityState = (location: string) => {
                // Try to get city, state from address
                const cityStateMatch = location.match(/([^,]+),\s*([^,]+)(?:,\s*([^,]+))?$/);
                if (cityStateMatch) {
                  const city = cityStateMatch[1]?.trim().toLowerCase();
                  const state = cityStateMatch[2]?.trim().toLowerCase();
                  return { city, state };
                }
                return { city: '', state: '' };
              };
              
              const businessAddr = extractCityState(businessLocation);
              const savedAddr = extractCityState(savedLocation);
              
              // If we have both city and state and they match, it's likely the same location
              if (businessAddr.city && businessAddr.state && 
                  businessAddr.city === savedAddr.city && 
                  businessAddr.state === savedAddr.state) {
                return true;
              }
            }
            
            return false;
          });
          
          // Update the business with isDuplicate flag if it's a duplicate
          if (isDuplicate && business.id) {
            await storage.updateBusiness(business.id, { isDuplicate: true });
          }
        }
      } else {
        // Fall back to the regular duplicate check with stored businesses
        await storage.checkForDuplicates(savedBusinesses);
      }
      
      // Get the updated businesses with duplicate flags
      const updatedBusinesses = await storage.getBusinesses();
      const newBusinesses = updatedBusinesses.filter(b => 
        savedBusinesses.some(saved => saved.id === b.id));
      
      res.json({
        businesses: newBusinesses,
        total: newBusinesses.length
      });
      
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error searching businesses:", error);
      res.status(500).json({ message: "An error occurred while searching for businesses" });
    }
  });

  // Generate search suggestions based on current search
  app.post("/api/businesses/suggestions", optionalAuth, async (req, res) => {
    try {
      const { businessType } = req.body;
      
      // Use user's OpenAI key if available, otherwise use system key
      let openaiToUse = openai;
      if (req.user?.userId) {
        const userApiKeys = await getApiKeys(req.user.userId);
        if (userApiKeys?.openaiApiKey) {
          openaiToUse = new OpenAI({ apiKey: userApiKeys.openaiApiKey });
        }
      }
      
      if (!openaiToUse && !process.env.OPENAI_API_KEY) {
        return res.status(400).json({ 
          message: "OpenAI API key is required. Please set up your API keys or configure system-wide keys."
        });
      }

      console.log("Generating search suggestions...");
      
      // Generate job-focused search terms using OpenAI
      const searchTerms = await generateJobFocusedSearchTerms(businessType);
      console.log(`Generated ${searchTerms.length} search suggestions for "${businessType}":`, searchTerms);
      
      // Get expanded list of Ohio cities (beyond top 40)
      const ohioCities = await getExpandedOhioCities();
      console.log(`Available cities: ${ohioCities.length} locations`);
      
      res.json({ 
        suggestions: searchTerms,
        availableCities: ohioCities,
        estimatedCost: {
          perSearch: "$0.049", // Combined Text Search + Details API cost
          perLocation: "$0.049",
          perTerm: `$${(ohioCities.length * 0.049).toFixed(2)}`,
          comprehensive: `$${(searchTerms.length * ohioCities.length * 0.049).toFixed(2)}`
        }
      });
      
    } catch (error) {
      console.error("Error generating suggestions:", error);
      res.status(500).json({ 
        message: "Failed to generate suggestions", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get available cities for a specific state
  app.post("/api/businesses/state-cities", authenticate, async (req, res) => {
    try {
      const { state, maxCities = 100 } = req.body;
      
      if (!state) {
        return res.status(400).json({ message: "State is required" });
      }
      
      // Get user's API keys
      const userId = req.user!.userId;
      const userApiKeys = await getApiKeys(userId);
      const openaiApiKey = userApiKeys?.openaiApiKey || process.env.OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        return res.status(400).json({ 
          message: "OpenAI API key is required. Please set up your API keys in the app settings."
        });
      }
      
      const cities = await getTopCitiesForState(state, maxCities);
      
      res.json({
        cities,
        state,
        count: cities.length,
        estimatedCost: {
          perCity: "$0.049",
          total: `$${(cities.length * 0.049).toFixed(2)}`
        }
      });
    } catch (error) {
      console.error("Error getting state cities:", error);
      res.status(500).json({ 
        message: "Failed to get cities for the specified state." 
      });
    }
  });

  // State-wide business search
  app.post("/api/businesses/search/state", authenticate, async (req, res) => {
    try {
      const { businessType, state, maxCities = 100, maxResults = 200 } = req.body;
      
      if (!businessType || !state) {
        return res.status(400).json({ message: "Business type and state are required" });
      }
      
      // Get user's API keys
      const userId = req.user!.userId;
      const userApiKeys = await getApiKeys(userId);
      const googleApiKey = userApiKeys?.googlePlacesApiKey || process.env.GOOGLE_PLACES_API_KEY;
      
      if (!googleApiKey) {
        return res.status(400).json({ 
          message: "Google Places API key is required. Please set up your API keys."
        });
      }
      
      // Get top cities for the state
      const cities = await getTopCitiesForState(state, maxCities);
      const businesses: Business[] = [];
      let searchedCities = 0;
      
      // Search each city
      for (const city of cities) {
        try {
          searchedCities++;
          
          // Geocode the city
          const geocodeUrl = `${GOOGLE_GEOCODING_API_URL}?address=${encodeURIComponent(`${city}, ${state}`)}&key=${googleApiKey}`;
          const geocodeResponse = await fetch(geocodeUrl);
          const geocodeData = await geocodeResponse.json();
          
          if (geocodeData.status !== "OK" || !geocodeData.results?.[0]) {
            console.warn(`Failed to geocode ${city}, ${state}`);
            continue;
          }
          
          const { lat, lng } = geocodeData.results[0].geometry.location;
          
          // Search for businesses in this city
          const placesUrl = `${GOOGLE_PLACES_API_URL}/nearbysearch/json?location=${lat},${lng}&radius=16093&keyword=${encodeURIComponent(businessType)}&type=establishment&key=${googleApiKey}`;
          const placesResponse = await fetch(placesUrl);
          const placesData = await placesResponse.json();
          
          if (placesData.status === "OK" && placesData.results) {
            // Process results for this city
            for (const place of placesData.results.slice(0, Math.floor(maxResults / cities.length))) {
              // Get business details
              let details;
              if (businessDetailsCache.has(place.place_id)) {
                details = businessDetailsCache.get(place.place_id);
              } else {
                const detailsResponse = await fetch(
                  `${GOOGLE_PLACES_API_URL}/details/json?place_id=${place.place_id}&fields=name,website,formatted_address&key=${googleApiKey}`
                );
                const detailsData = await detailsResponse.json();
                
                if (detailsData.status === "OK") {
                  details = detailsData.result;
                  businessDetailsCache.set(place.place_id, details);
                }
              }
              
              if (details) {
                const distance = calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
                
                businesses.push({
                  name: details.name || place.name,
                  website: details.website || "",
                  location: details.formatted_address || place.vicinity || "",
                  distance: `${distance.toFixed(1)} mi`,
                  isBadLead: false,
                  notes: "",
                  isDuplicate: false,
                  careerLink: details.website ? `${details.website.replace(/\/+$/, '')}/careers` : ""
                });
              }
              
              // Stop if we've reached max results
              if (businesses.length >= maxResults) break;
            }
          }
          
          // Stop if we've reached max results
          if (businesses.length >= maxResults) break;
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (cityError) {
          console.error(`Error searching ${city}, ${state}:`, cityError);
          continue;
        }
      }
      
      // Clear previous search results and save new ones
      await storage.clearAllBusinesses();
      
      if (businesses.length > 0) {
        const insertBusinesses = businesses.map(business => ({
          name: business.name,
          website: business.website,
          location: business.location,
          distance: business.distance,
          isBadLead: business.isBadLead,
          notes: business.notes,
          careerLink: business.careerLink
        }));
        
        await storage.saveBatchBusinesses(insertBusinesses);
      }
      
      res.json({
        businesses,
        total: businesses.length,
        searchedCities,
        totalCities: cities.length
      });
      
    } catch (error) {
      console.error("Error in state search:", error);
      res.status(500).json({ 
        message: "Failed to perform state search. Please try again." 
      });
    }
  });

  // Get all businesses
  app.get("/api/businesses", async (_req, res) => {
    try {
      const businesses = await storage.getBusinesses();
      res.json(businesses);
    } catch (error) {
      console.error("Error fetching businesses:", error);
      res.status(500).json({ message: "An error occurred while fetching businesses" });
    }
  });

  // Update a business (e.g., mark as bad lead)
  app.patch("/api/businesses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid business ID" });
      }

      const updateData = req.body;
      const updatedBusiness = await storage.updateBusiness(id, updateData);
      
      if (!updatedBusiness) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      res.json(updatedBusiness);
    } catch (error) {
      console.error("Error updating business:", error);
      res.status(500).json({ message: "An error occurred while updating the business" });
    }
  });

  // Compare businesses from CSV with existing search results
  app.post("/api/businesses/compare", async (req, res) => {
    try {
      const { csvData } = req.body;
      
      if (!csvData) {
        return res.status(400).json({ message: "CSV data is required" });
      }
      
      // Parse CSV data without storing it
      const csvBusinesses = parseCSV(csvData);
      
      if (csvBusinesses.length === 0) {
        return res.status(400).json({ message: "No valid businesses found in CSV data" });
      }
      
      // Get existing businesses (search results)
      const existingBusinesses = await storage.getBusinesses();
      let updatedCount = 0;
      
      // Check each existing business against the CSV list
      for (const existing of existingBusinesses) {
        if (!existing.id) continue;
        
        // Check if this business exists in the CSV data
        const isDuplicate = csvBusinesses.some(csvBusiness => {
          // Compare by domain if website is available
          if (existing.website && csvBusiness.website) {
            const existingDomain = normalizeDomain(existing.website);
            const csvDomain = normalizeDomain(csvBusiness.website);
            if (existingDomain && csvDomain && existingDomain === csvDomain) {
              return true;
            }
          }
          
          // Fall back to company name comparison
          const existingName = normalizeName(existing.name);
          const csvName = normalizeName(csvBusiness.name);
          return existingName && csvName && existingName === csvName;
        });
        
        // Mark as duplicate if found in CSV
        if (isDuplicate) {
          await storage.updateBusiness(existing.id, { isDuplicate: true });
          updatedCount++;
        }
      }
      
      res.json({ 
        message: `Found ${updatedCount} duplicate businesses`,
        count: updatedCount
      });
      
    } catch (error) {
      console.error("Error comparing businesses:", error);
      res.status(500).json({ message: "An error occurred while comparing businesses" });
    }
  });

  // Clear duplicate flags
  app.post("/api/businesses/clear-duplicates", async (_req, res) => {
    try {
      await storage.clearDuplicateFlags();
      res.json({ message: "Duplicate flags cleared successfully" });
    } catch (error) {
      console.error("Error clearing duplicate flags:", error);
      res.status(500).json({ message: "An error occurred while clearing duplicate flags" });
    }
  });
  
  // Clear all business data (completely removes all businesses from storage)
  app.post("/api/businesses/clear-all", async (_req, res) => {
    try {
      await storage.clearAllBusinesses();
      res.json({ message: "All business data cleared successfully" });
    } catch (error) {
      console.error("Error clearing all business data:", error);
      res.status(500).json({ message: "An error occurred while clearing all business data" });
    }
  });

  // Geocode address to get coordinates using Google Maps API with caching
  app.get("/api/geocode", async (req, res) => {
    try {
      const { address } = req.query;
      
      if (!address) {
        return res.status(400).json({ message: "Address parameter is required" });
      }

      if (!API_KEY) {
        return res.status(500).json({ 
          message: "Google Places API key is not configured"
        });
      }

      const addressKey = (address as string).toLowerCase();
      
      // Check cache first to avoid repeated geocoding calls
      if (geocodeCache.has(addressKey)) {
        const cachedResult = geocodeCache.get(addressKey);
        return res.json(cachedResult);
      }

      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address as string)}&key=${API_KEY}`;
      
      const response = await fetch(geocodeUrl);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const result = {
          coordinates: {
            lat: location.lat,
            lng: location.lng
          },
          formatted_address: data.results[0].formatted_address
        };
        
        // Cache the result to avoid repeated API calls
        geocodeCache.set(addressKey, result);
        
        res.json(result);
      } else {
        res.status(404).json({ message: "Address not found" });
      }
    } catch (error) {
      console.error("Error geocoding address:", error);
      res.status(500).json({ message: "Failed to geocode address" });
    }
  });

  // Helper function to calculate distance using Haversine formula
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  const httpServer = createServer(app);
  return httpServer;
}
