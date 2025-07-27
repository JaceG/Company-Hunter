import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ApiKeysStatus {
	hasGooglePlacesKey: boolean;
	hasOpenaiKey: boolean;
	hasMongodbUri: boolean;
	updatedAt?: string;
	isDemo?: boolean;
	demoMode?: boolean;
	searchesUsed?: number;
	searchesRemaining?: number;
	canSearch?: boolean;
	message?: string;
}

interface SaveApiKeysData {
	googlePlacesApiKey?: string;
	openaiApiKey?: string;
	mongodbUri?: string;
}

export function useApiKeys() {
	return useQuery<ApiKeysStatus>({
		queryKey: ['/api/auth/api-keys'],
		queryFn: ({ queryKey }) => {
			const token = localStorage.getItem('authToken');
			const headers: HeadersInit = token
				? {
						Authorization: `Bearer ${token}`,
				  }
				: {};

			return fetch(queryKey[0] as string, {
				credentials: 'include',
				headers,
			}).then(async (res) => {
				if (res.status === 401) {
					// For unauthenticated users, return demo mode status
					return res.json();
				}
				if (!res.ok) {
					throw new Error(`HTTP error! status: ${res.status}`);
				}
				return res.json();
			});
		},
		retry: false,
	});
}

export function useSaveApiKeys() {
	return useMutation({
		mutationFn: async (data: SaveApiKeysData) => {
			return await apiRequest('POST', '/api/auth/api-keys', data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/auth/api-keys'] });
		},
	});
}

export function useDeleteApiKeys() {
	return useMutation({
		mutationFn: async () => {
			return await apiRequest('DELETE', '/api/auth/api-keys');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/auth/api-keys'] });
		},
	});
}
