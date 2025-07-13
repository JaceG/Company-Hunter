import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import SearchPanel from "@/components/SearchPanel";
import ResultsPanel from "@/components/ResultsPanel";
import { useBusinessSearch, useBusinesses } from "@/hooks/useBusiness";
import { SearchParams } from "@/lib/types";

export default function Home() {
  const [searchError, setSearchError] = useState<Error | null>(null);
  const businessSearch = useBusinessSearch();
  const businessesQuery = useBusinesses();
  
  const handleSearch = async (params: SearchParams) => {
    setSearchError(null);
    try {
      await businessSearch.mutateAsync(params);
    } catch (error) {
      setSearchError(error instanceof Error ? error : new Error("Failed to search businesses"));
    }
  };
  
  const handleRetry = () => {
    // Retry the last search if any
    if (businessSearch.variables) {
      handleSearch(businessSearch.variables);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <SearchPanel 
              onSearch={handleSearch} 
              isLoading={businessSearch.isPending}
            />
          </div>
          
          <div className="lg:col-span-8">
            <ResultsPanel 
              businesses={businessesQuery.data || []}
              isLoading={businessSearch.isPending || businessesQuery.isLoading}
              error={searchError} 
              onRetry={handleRetry}
            />
          </div>
        </div>
      </main>
      
      <AppFooter />
    </div>
  );
}
