import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { SearchParams, Business, SearchResult } from "@/lib/types";

// Hook for searching businesses
export function useBusinessSearch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (searchParams: SearchParams): Promise<SearchResult> => {
      return await apiRequest("POST", "/api/businesses/search", searchParams);
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
      return await apiRequest("PATCH", `/api/businesses/${id}`, data);
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
      return await apiRequest("POST", "/api/businesses/compare", { csvData });
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
      return await apiRequest("POST", "/api/businesses/clear-duplicates", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
    },
  });
}

// Hook for clearing all business data
export function useClearAllBusinesses() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (): Promise<{ message: string }> => {
      return await apiRequest("POST", "/api/businesses/clear-all", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
    },
  });
}
