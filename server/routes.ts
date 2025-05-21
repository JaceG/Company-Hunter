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

  // Parse CSV data from string format
  function parseCSV(csvContent: string): ImportBusiness[] {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Find the column indices
    const nameIndex = headers.findIndex(h => h.toLowerCase().includes('company') || h.toLowerCase().includes('name'));
    const websiteIndex = headers.findIndex(h => h.toLowerCase().includes('website'));
    const locationIndex = headers.findIndex(h => h.toLowerCase().includes('location'));
    const badLeadIndex = headers.findIndex(h => h.toLowerCase().includes('bad') && h.toLowerCase().includes('lead'));
    const distanceIndex = headers.findIndex(h => h.toLowerCase().includes('distance') || h.toLowerCase().includes('driving'));
    const notesIndex = headers.findIndex(h => h.toLowerCase().includes('notes'));
    const careerLinkIndex = headers.findIndex(h => h.toLowerCase().includes('career'));

    const businesses: ImportBusiness[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      // Only add if we have a company name
      if (nameIndex >= 0 && values[nameIndex]) {
        const business: ImportBusiness = {
          name: values[nameIndex],
          website: websiteIndex >= 0 ? values[websiteIndex] : undefined,
          location: locationIndex >= 0 ? values[locationIndex] : undefined,
          isBadLead: badLeadIndex >= 0 ? values[badLeadIndex].toUpperCase() === 'TRUE' : false,
          distance: distanceIndex >= 0 ? values[distanceIndex] : undefined,
          notes: notesIndex >= 0 ? values[notesIndex] : undefined,
          careerLink: careerLinkIndex >= 0 ? values[careerLinkIndex] : undefined,
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
