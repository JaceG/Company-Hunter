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
