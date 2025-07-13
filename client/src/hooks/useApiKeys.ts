import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ApiKeysStatus {
  hasGooglePlacesKey: boolean;
  hasOpenaiKey: boolean;
  updatedAt?: string;
}

interface SaveApiKeysData {
  googlePlacesApiKey?: string;
  openaiApiKey?: string;
}

export function useApiKeys() {
  return useQuery<ApiKeysStatus>({
    queryKey: ["/api/auth/api-keys"],
    retry: false,
  });
}

export function useSaveApiKeys() {
  return useMutation({
    mutationFn: async (data: SaveApiKeysData) => {
      return await apiRequest("/api/auth/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/api-keys"] });
    },
  });
}

export function useDeleteApiKeys() {
  return useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/auth/api-keys", {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/api-keys"] });
    },
  });
}