import { businesses, type Business, type InsertBusiness, type ImportBusiness } from "@shared/schema";

export interface IStorage {
  getBusinesses(): Promise<Business[]>;
  getBusinessById(id: number): Promise<Business | undefined>;
  createBusiness(business: InsertBusiness): Promise<Business>;
  updateBusiness(id: number, business: Partial<InsertBusiness>): Promise<Business | undefined>;
  deleteBusiness(id: number): Promise<boolean>;
  saveBatchBusinesses(businessList: InsertBusiness[]): Promise<Business[]>;
  importBusinessesFromCSV(businessList: ImportBusiness[]): Promise<number>;
  clearDuplicateFlags(): Promise<void>;
  clearAllBusinesses(): Promise<void>; // Added method to clear all businesses
  checkForDuplicates(newBusinesses: Business[]): Promise<Business[]>;
}

export class MemStorage implements IStorage {
  private businesses: Map<number, Business>;
  private currentId: number;

  constructor() {
    this.businesses = new Map();
    this.currentId = 1;
  }

  async getBusinesses(): Promise<Business[]> {
    return Array.from(this.businesses.values());
  }

  async getBusinessById(id: number): Promise<Business | undefined> {
    return this.businesses.get(id);
  }

  async createBusiness(insertBusiness: InsertBusiness): Promise<Business> {
    const id = this.currentId++;
    const business: Business = { 
      id,
      name: insertBusiness.name,
      website: insertBusiness.website || null,
      location: insertBusiness.location || null,
      distance: insertBusiness.distance || null,
      isBadLead: insertBusiness.isBadLead || false,
      notes: insertBusiness.notes || null,
      isDuplicate: insertBusiness.isDuplicate || false,
      careerLink: insertBusiness.careerLink || null
    };
    this.businesses.set(id, business);
    return business;
  }

  async updateBusiness(id: number, partialBusiness: Partial<InsertBusiness>): Promise<Business | undefined> {
    const business = this.businesses.get(id);
    if (!business) return undefined;
    
    const updatedBusiness = { ...business, ...partialBusiness };
    this.businesses.set(id, updatedBusiness);
    return updatedBusiness;
  }

  async deleteBusiness(id: number): Promise<boolean> {
    return this.businesses.delete(id);
  }

  async saveBatchBusinesses(businessList: InsertBusiness[]): Promise<Business[]> {
    const savedBusinesses: Business[] = [];
    
    for (const business of businessList) {
      const saved = await this.createBusiness(business);
      savedBusinesses.push(saved);
    }
    
    return savedBusinesses;
  }

  async importBusinessesFromCSV(businessList: ImportBusiness[]): Promise<number> {
    let importedCount = 0;
    
    for (const csvBusiness of businessList) {
      // Convert CSV business to InsertBusiness format
      const insertBusiness: InsertBusiness = {
        name: csvBusiness.name,
        website: csvBusiness.website || '',
        location: csvBusiness.location || '',
        distance: csvBusiness.distance || '',
        isBadLead: csvBusiness.isBadLead || false,
        notes: csvBusiness.notes || '',
        isDuplicate: false,
        careerLink: csvBusiness.careerLink || ''
      };
      
      await this.createBusiness(insertBusiness);
      importedCount++;
    }
    
    return importedCount;
  }

  async clearDuplicateFlags(): Promise<void> {
    // Reset all duplicate flags
    const businessEntries = Array.from(this.businesses.entries());
    for (const [id, business] of businessEntries) {
      if (business.isDuplicate) {
        business.isDuplicate = false;
        this.businesses.set(id, business);
      }
    }
  }
  
  async clearAllBusinesses(): Promise<void> {
    // Clear all businesses and reset the ID counter
    this.businesses.clear();
    this.currentId = 1;
  }

  async checkForDuplicates(newBusinesses: Business[]): Promise<Business[]> {
    // Get existing businesses for comparison
    const existingBusinesses = await this.getBusinesses();
    const markedBusinesses: Business[] = [];

    for (const newBusiness of newBusinesses) {
      let isDuplicate = false;
      
      // Only compare against businesses that aren't from this current batch
      const existingBusinessesForComparison = existingBusinesses.filter(
        existing => !newBusinesses.some(nb => nb.id === existing.id)
      );
      
      // First, try to match based on domain name only
      if (newBusiness.website) {
        const newDomain = normalizeDomain(newBusiness.website);
        
        if (newDomain) {
          isDuplicate = existingBusinessesForComparison.some(existing => 
            existing.website && normalizeDomain(existing.website) === newDomain
          );
        }
      }
      
      // If no domain match was found, try exact name match as fallback
      if (!isDuplicate && newBusiness.name) {
        const normalizedNewName = normalizeName(newBusiness.name);
        
        if (normalizedNewName) {
          isDuplicate = existingBusinessesForComparison.some(existing =>
            normalizeName(existing.name) === normalizedNewName
          );
        }
      }
      
      if (isDuplicate && newBusiness.id) {
        // Update the business marking it as a duplicate
        const updated = await this.updateBusiness(newBusiness.id, { isDuplicate: true });
        if (updated) {
          markedBusinesses.push(updated);
        }
      }
    }
    
    return markedBusinesses;
  }
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

export const storage = new MemStorage();
