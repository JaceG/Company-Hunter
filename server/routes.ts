import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBusinessSchema, searchParamsSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Google Places API endpoint
  const GOOGLE_PLACES_API_URL = "https://maps.googleapis.com/maps/api/place";
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "AIzaSyDNAdkNIQtoTq8SdgBXLP3JvFAimA8LsxM";

  // Helper function to convert miles to meters for Google Places API
  const milesToMeters = (miles: number) => Math.round(miles * 1609.34);

  // Search for businesses
  app.post("/api/businesses/search", async (req, res) => {
    try {
      const searchParams = searchParamsSchema.parse(req.body);
      const { businessType, location, radius, maxResults } = searchParams;
      
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
            notes: ""
          });
        }
      }
      
      // Store the results for later retrieval
      await storage.saveBatchBusinesses(businesses);
      
      res.json({
        businesses,
        total: businesses.length
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
