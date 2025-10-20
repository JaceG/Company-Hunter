import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { Business } from '../lib/types';

// Interface for saved businesses with MongoDB IDs
export interface SavedBusiness extends Omit<Business, 'id'> {
	_id?: string;
	userId: string;
	tags?: string[];
	createdAt?: Date;
	updatedAt?: Date;
}

// Get all saved businesses for the current user with pagination and search
export function useSavedBusinesses(
	page: number = 1,
	limit: number = 50,
	searchTerm?: string,
	recentOnly?: boolean
) {
	return useQuery({
		queryKey: ['/api/my/businesses', page, limit, searchTerm, recentOnly],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: page.toString(),
				limit: limit.toString(),
			});
			if (searchTerm && searchTerm.trim()) {
				params.append('search', searchTerm.trim());
			}
			if (recentOnly) {
				params.append('recentOnly', 'true');
			}
			return await apiRequest('GET', `/api/my/businesses?${params}`);
		},
	});
}

// Save a single business to the user's list
export function useSaveBusiness() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (
			business: Omit<SavedBusiness, 'userId' | 'createdAt' | 'updatedAt'>
		) => {
			return await apiRequest('POST', '/api/my/businesses', business);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/my/businesses'] });
		},
	});
}

// Import businesses from search results
export function useImportFromSearch() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (businessIds?: number[]) => {
			return await apiRequest(
				'POST',
				'/api/my/businesses/import-from-search',
				businessIds ? { businessIds } : {}
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/my/businesses'] });
		},
	});
}

// Import businesses from CSV
export function useImportFromCSV() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (options: {
			csvData: string;
			skipDuplicates?: boolean;
			replaceDuplicates?: boolean;
		}) => {
			return await apiRequest(
				'POST',
				'/api/my/businesses/import-from-csv',
				options
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/my/businesses'] });
		},
	});
}

// Update a saved business
export function useUpdateSavedBusiness() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			updates,
		}: {
			id: string;
			updates: Partial<SavedBusiness>;
		}) => {
			return await apiRequest(
				'PATCH',
				`/api/my/businesses/${id}`,
				updates
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/my/businesses'] });
		},
	});
}

// Delete a saved business
export function useDeleteSavedBusiness() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			return await apiRequest('DELETE', `/api/my/businesses/${id}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/my/businesses'] });
		},
	});
}

// Clear all saved businesses
export function useClearAllSavedBusinesses() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			return await apiRequest('DELETE', '/api/my/clear-all-businesses');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/my/businesses'] });
		},
	});
}

// Search saved businesses
export function useSearchSavedBusinesses(query: string) {
	return useQuery({
		queryKey: ['/api/my/businesses/search', query],
		queryFn: async () => {
			if (!query.trim())
				return { businesses: [], total: 0, searchQuery: query };
			return await apiRequest(
				'GET',
				`/api/my/businesses/search?q=${encodeURIComponent(query)}`
			);
		},
		enabled: !!query.trim(),
	});
}

// Get guest businesses for duplicate detection (no authentication required)
export function useGuestBusinesses() {
	return useQuery({
		queryKey: ['/api/guest/businesses'],
		queryFn: async () => {
			return await apiRequest('GET', '/api/guest/businesses');
		},
		retry: false,
	});
}
