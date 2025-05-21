import { businesses, type Business, type InsertBusiness } from "@shared/schema";

export interface IStorage {
  getBusinesses(): Promise<Business[]>;
  getBusinessById(id: number): Promise<Business | undefined>;
  createBusiness(business: InsertBusiness): Promise<Business>;
  updateBusiness(id: number, business: Partial<InsertBusiness>): Promise<Business | undefined>;
  deleteBusiness(id: number): Promise<boolean>;
  saveBatchBusinesses(businessList: InsertBusiness[]): Promise<Business[]>;
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
    const business: Business = { ...insertBusiness, id };
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
}

export const storage = new MemStorage();
