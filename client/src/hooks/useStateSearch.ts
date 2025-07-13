import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Business } from "@/lib/types";

interface StateSearchParams {
  businessType: string;
  state: string;
  maxCities: number;
  selectedCities?: string[];
}

interface StateSearchResult {
  businesses: Business[];
  total: number;
  searchedCities: number;
  totalCities: number;
}

interface StateCitiesParams {
  state: string;
  maxCities?: number;
  sortBy?: "size" | "alphabetical";
}

interface StateCitiesResult {
  cities: string[];
  state: string;
  count: number;
  sortBy: "size" | "alphabetical";
  estimatedCost: {
    perCity: string;
    total: string;
  };
}

export function useStateSearch() {
  return useMutation({
    mutationFn: async (params: StateSearchParams): Promise<StateSearchResult> => {
      return await apiRequest("POST", "/api/businesses/search/state", params);
    },
  });
}

export function useStateCities() {
  return useMutation({
    mutationFn: async (params: StateCitiesParams): Promise<StateCitiesResult> => {
      return await apiRequest("POST", "/api/businesses/state-cities", params);
    },
  });
}