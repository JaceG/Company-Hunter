import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

interface AuthUser {
	userId: string;
	email: string;
}

interface RegisterData {
	email: string;
	password: string;
	name?: string;
}

interface LoginData {
	email: string;
	password: string;
}

interface AuthResponse {
	user: AuthUser;
	token: string;
}

export function useAuth() {
	const { data: user, isLoading } = useQuery({
		queryKey: ['/api/auth/user'],
		retry: false,
		// Keep data between browser sessions
		staleTime: Infinity,
	});

	return {
		user,
		isLoading,
		isAuthenticated: !!user,
	};
}

export function useRegister() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (userData: RegisterData): Promise<AuthResponse> => {
			const response = await apiRequest(
				'POST',
				'/api/auth/register',
				userData
			);

			// Save auth token to localStorage for persistent sessions
			if (response.token) {
				localStorage.setItem('authToken', response.token);
			}

			return response;
		},
		onSuccess: () => {
			// Invalidate user query to refresh authentication state
			queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
			// Invalidate API keys query to show correct status for new user
			queryClient.invalidateQueries({ queryKey: ['/api/auth/api-keys'] });
			// Invalidate saved businesses to show migrated guest data
			queryClient.invalidateQueries({ queryKey: ['/api/my/businesses'] });
		},
	});
}

export function useLogin() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (loginData: LoginData): Promise<AuthResponse> => {
			const response = await apiRequest(
				'POST',
				'/api/auth/login',
				loginData
			);

			// Save auth token to localStorage for persistent sessions
			if (response.token) {
				localStorage.setItem('authToken', response.token);
			}

			return response;
		},
		onSuccess: () => {
			// Invalidate user query to refresh authentication state
			queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
		},
	});
}

export function useLogout() {
	const queryClient = useQueryClient();

	return () => {
		// Remove auth token from localStorage
		localStorage.removeItem('authToken');

		// Reset user query cache to reflect logged out state
		queryClient.setQueryData(['/api/auth/user'], null);

		// Invalidate all queries to ensure fresh data on login
		queryClient.invalidateQueries();
	};
}
