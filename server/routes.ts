import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBusinessSchema, searchParamsSchema, importBusinessSchema, type ImportBusiness } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Google Places API endpoint
  const GOOGLE_PLACES_API_URL = "https://maps.googleapis.com/maps/api/place";
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

  // Helper function to convert miles to meters for Google Places API
  const milesToMeters = (miles: number) => Math.round(miles * 1609.34);

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

  // Search for businesses
  app.post("/api/businesses/search", async (req, res) => {
    try {
      const searchParams = searchParamsSchema.parse(req.body);
      const { businessType, location, radius, maxResults } = searchParams;
      
      if (!API_KEY) {
        return res.status(500).json({ 
          message: "Google Places API key is not configured"
        });
      }
      
      // First we need to geocode the location to get coordinates
      const geocodeResponse = await fetch(
        `${GOOGLE_PLACES_API_URL}/findplacefromtext/json?input=${encodeURIComponent(location)}&inputtype=textquery&fields=geometry&key=${API_KEY}`
      );
      
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.status !== "OK" || !geocodeData.candidates || geocodeData.candidates.length === 0) {
        return res.status(400).json({ 
          message: "Could not find location coordinates",
          details: geocodeData.status
        });
      }
      
      const { lat, lng } = geocodeData.candidates[0].geometry.location;
      
      // Now search for businesses using the coordinates
      const placesResponse = await fetch(
        `${GOOGLE_PLACES_API_URL}/nearbysearch/json?location=${lat},${lng}&radius=${milesToMeters(Number(radius))}&keyword=${encodeURIComponent(businessType)}&type=establishment&key=${API_KEY}`
      );
      
      const placesData = await placesResponse.json();
      
      if (placesData.status !== "OK" && placesData.status !== "ZERO_RESULTS") {
        return res.status(400).json({ 
          message: "Failed to search businesses",
          details: placesData.status
        });
      }
      
      const businesses = [];
      const maxResultsNum = Number(maxResults);
      const resultsToProcess = placesData.results?.slice(0, maxResultsNum) || [];
      
      // Process each place result to get additional details and format the response
      for (const place of resultsToProcess) {
        // Get additional details like website
        const detailsResponse = await fetch(
          `${GOOGLE_PLACES_API_URL}/details/json?place_id=${place.place_id}&fields=name,website,formatted_address,url&key=${API_KEY}`
        );
        
        const detailsData = await detailsResponse.json();
        
        if (detailsData.status === "OK") {
          const details = detailsData.result;
          
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
            careerLink: ""
          });
        }
      }
      
      // Store the results for later retrieval
      const savedBusinesses = await storage.saveBatchBusinesses(businesses);
      
      // Check for duplicates in the new results
      await storage.checkForDuplicates(savedBusinesses);
      
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

  // Import businesses from CSV
  app.post("/api/businesses/import", async (req, res) => {
    try {
      const { csvData } = req.body;
      
      if (!csvData) {
        return res.status(400).json({ message: "CSV data is required" });
      }
      
      // Parse CSV data
      const businesses = parseCSV(csvData);
      
      if (businesses.length === 0) {
        return res.status(400).json({ message: "No valid businesses found in CSV data" });
      }
      
      // Import businesses to storage
      const importedCount = await storage.importBusinessesFromCSV(businesses);
      
      res.json({ 
        message: `Successfully imported ${importedCount} businesses`,
        count: importedCount
      });
      
    } catch (error) {
      console.error("Error importing businesses:", error);
      res.status(500).json({ message: "An error occurred while importing businesses" });
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
