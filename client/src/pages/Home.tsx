import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SearchPanel from '@/components/SearchPanel';
import ResultsPanel from '@/components/ResultsPanel';
import QuotaExhaustedModal from '@/components/QuotaExhaustedModal';
import { useBusinessSearch, useBusinesses } from '@/hooks/useBusiness';
import { SearchParams } from '@/lib/types';

export default function Home() {
	const [searchError, setSearchError] = useState<Error | null>(null);
	const [showQuotaModal, setShowQuotaModal] = useState(false);
	const businessSearch = useBusinessSearch();
	const businessesQuery = useBusinesses();

	const handleSearch = async (params: SearchParams) => {
		setSearchError(null);
		try {
			await businessSearch.mutateAsync(params);
		} catch (error) {
			// Check if this is a quota exhaustion error
			if (error instanceof Error && error.message.includes('429:')) {
				try {
					// Parse the error message to check for quota exhaustion
					const errorMatch = error.message.match(/429:\s*(.+)/);
					if (errorMatch) {
						const errorResponse = JSON.parse(errorMatch[1]);
						if (errorResponse.quotaExhausted) {
							setShowQuotaModal(true);
							return; // Don't set as search error
						}
					}
				} catch (parseError) {
					// If parsing fails, treat as regular error
				}
			}

			setSearchError(
				error instanceof Error
					? error
					: new Error('Failed to search businesses')
			);
		}
	};

	const handleRetry = () => {
		// Retry the last search if any
		if (businessSearch.variables) {
			handleSearch(businessSearch.variables);
		}
	};

	return (
		<div className='min-h-screen flex flex-col'>
			<AppHeader />

			<main className='container mx-auto px-4 py-8 flex-grow'>
				<div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
					<div className='lg:col-span-4'>
						<SearchPanel
							onSearch={handleSearch}
							isLoading={businessSearch.isPending}
						/>
					</div>

					<div className='lg:col-span-8'>
						<ResultsPanel
							businesses={businessesQuery.data || []}
							isLoading={
								businessSearch.isPending ||
								businessesQuery.isLoading
							}
							error={searchError}
							onRetry={handleRetry}
						/>
					</div>
				</div>
			</main>

			<AppFooter />

			{/* Quota Exhausted Modal */}
			<QuotaExhaustedModal
				isOpen={showQuotaModal}
				onClose={() => setShowQuotaModal(false)}
			/>
		</div>
	);
}
