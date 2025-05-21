import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { SearchParams, Business, SearchResult } from "@/lib/types";

// Hook for searching businesses
export function useBusinessSearch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (searchParams: SearchParams): Promise<SearchResult> => {
      const res = await apiRequest("POST", "/api/businesses/search", searchParams);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
    }
  });
}

// Hook for fetching businesses
export function useBusinesses() {
  return useQuery<Business[]>({
    queryKey: ["/api/businesses"],
  });
}

// Hook for updating a business (e.g., marking as bad lead)
export function useUpdateBusiness() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Business> }): Promise<Business> => {
      const res = await apiRequest("PATCH", `/api/businesses/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
    },
  });
}

// Hook for importing businesses from CSV for comparison only
export function useImportBusinesses() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (csvData: string): Promise<{ message: string; count: number }> => {
      const res = await apiRequest("POST", "/api/businesses/compare", { csvData });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
    },
  });
}

// Hook for clearing duplicate flags
export function useClearDuplicates() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (): Promise<{ message: string }> => {
      const res = await apiRequest("POST", "/api/businesses/clear-duplicates", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
    },
  });
}
