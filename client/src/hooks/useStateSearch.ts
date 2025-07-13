import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Business } from "@/lib/types";

interface StateSearchParams {
  businessType: string;
  state: string;
  maxCities: number;
  maxResults: number;
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
}

interface StateCitiesResult {
  cities: string[];
  state: string;
  count: number;
  estimatedCost: {
    perCity: string;
    total: string;
  };
}

export function useStateSearch() {
  return useMutation({
    mutationFn: async (params: StateSearchParams): Promise<StateSearchResult> => {
      return await apiRequest("/api/businesses/search/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
    },
  });
}

export function useStateCities() {
  return useMutation({
    mutationFn: async (params: StateCitiesParams): Promise<StateCitiesResult> => {
      return await apiRequest("/api/businesses/state-cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
    },
  });
}