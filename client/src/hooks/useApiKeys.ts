import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ApiKeysStatus {
  hasGooglePlacesKey: boolean;
  hasOpenaiKey: boolean;
  hasMongodbUri: boolean;
  updatedAt?: string;
}

interface SaveApiKeysData {
  googlePlacesApiKey?: string;
  openaiApiKey?: string;
  mongodbUri?: string;
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
      return await apiRequest("POST", "/api/auth/api-keys", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/api-keys"] });
    },
  });
}

export function useDeleteApiKeys() {
  return useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/auth/api-keys");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/api-keys"] });
    },
  });
}