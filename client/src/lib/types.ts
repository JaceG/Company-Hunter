export interface Business {
  id?: number;
  name: string;
  website: string;
  location: string;
  distance: string;
  isBadLead: boolean;
  notes: string;
  isDuplicate?: boolean;
  careerLink?: string;
}

export interface SearchParams {
  businessType: string;
  location: string;
  radius: string;
  maxResults: string;
}

export interface SearchResult {
  businesses: Business[];
  total: number;
}
