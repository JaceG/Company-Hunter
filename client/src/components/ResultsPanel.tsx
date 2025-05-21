import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ResultsTable from "./ResultsTable";
import { Business } from "@/lib/types";
import { exportToCSV, downloadCSV, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useImportBusinesses, useClearDuplicates } from "@/hooks/useBusiness";

interface ResultsPanelProps {
  businesses: Business[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export default function ResultsPanel({ businesses, isLoading, error, onRetry }: ResultsPanelProps) {
  const { toast } = useToast();
  const [copyButtonText, setCopyButtonText] = useState("Copy Data");
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importBusinesses = useImportBusinesses();
  const clearDuplicates = useClearDuplicates();
  
  // Count duplicates
  const duplicateCount = businesses.filter(b => b.isDuplicate).length;
  
  // Filter businesses if needed
  const filteredBusinesses = hideDuplicates 
    ? businesses.filter(b => !b.isDuplicate)
    : businesses;
  
  const handleDownloadCSV = () => {
    const csvContent = exportToCSV(filteredBusinesses);
    downloadCSV(csvContent);
    
    toast({
      title: "CSV Downloaded",
      description: "Business data has been downloaded as a CSV file.",
    });
  };
  
  const handleCopyData = async () => {
    const csvContent = exportToCSV(filteredBusinesses);
    const success = await copyToClipboard(csvContent);
    
    if (success) {
      setCopyButtonText("Copied!");
      toast({
        title: "Copied to Clipboard",
        description: "Business data has been copied to your clipboard.",
      });
      
      setTimeout(() => {
        setCopyButtonText("Copy Data");
      }, 2000);
    } else {
      toast({
        title: "Copy Failed",
        description: "Could not copy data to clipboard. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        if (csvData) {
          const result = await importBusinesses.mutateAsync(csvData);
          toast({
            title: "Import Successful",
            description: `${result.count} businesses imported from CSV.`,
          });
        }
      } catch (error) {
        toast({
          title: "Import Failed",
          description: error instanceof Error ? error.message : "Failed to import CSV data",
          variant: "destructive",
        });
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    
    reader.readAsText(file);
  };
  
  const handleClearDuplicateFlags = async () => {
    try {
      await clearDuplicates.mutateAsync();
      toast({
        title: "Duplicates Reset",
        description: "All duplicate flags have been cleared.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear duplicate flags.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="lg:col-span-8 space-y-6">
      {/* Results Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
              <div>
                <h2 className="text-lg font-semibold text-secondary flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                  Business Results
                </h2>
                <p className="text-sm text-gray-500">
                  {filteredBusinesses.length} businesses found
                  {duplicateCount > 0 && ` (${duplicateCount} duplicates${hideDuplicates ? ' hidden' : ''})`}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
                <Button
                  onClick={handleDownloadCSV}
                  className="inline-flex items-center justify-center bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))] hover:opacity-90"
                  disabled={businesses.length === 0 || isLoading}
                >
                  <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download CSV
                </Button>
                
                <Button
                  onClick={handleCopyData}
                  variant="outline"
                  className="inline-flex items-center justify-center"
                  disabled={businesses.length === 0 || isLoading}
                >
                  <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  {copyButtonText}
                </Button>
              </div>
            </div>

            {/* Duplicate Controls */}
            {duplicateCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="hide-duplicates" 
                    checked={hideDuplicates} 
                    onCheckedChange={setHideDuplicates} 
                  />
                  <Label htmlFor="hide-duplicates">Hide duplicate businesses</Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearDuplicateFlags}
                  className="mt-2 sm:mt-0"
                >
                  <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h18v18H3z"></path>
                    <path d="M21 3l-9 9"></path>
                    <path d="M12 12l-9 9"></path>
                  </svg>
                  Reset Duplicate Flags
                </Button>
              </div>
            )}
            
            {/* Import Controls */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-4 border-t border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">Import Existing Businesses</p>
                <p className="text-xs text-gray-500">Upload a CSV file with company data to compare with search results</p>
              </div>
              
              <div className="mt-2 sm:mt-0">
                <input 
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImportClick}
                  disabled={importBusinesses.isPending}
                >
                  {importBusinesses.isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      Import CSV
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
              <h3 className="text-lg font-medium text-secondary mb-2">Searching Businesses</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Searching for businesses matching your criteria. This may take a moment...
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-l-4 border-[hsl(var(--destructive))]">
          <CardContent className="p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-[hsl(var(--destructive))]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-[hsl(var(--destructive))]">Error occurred during search</h3>
                <div className="mt-2 text-sm text-gray-500">
                  <p>{error.message || "Unable to complete your search. Please try again."}</p>
                </div>
                <div className="mt-4">
                  <Button variant="link" className="text-primary p-0" onClick={onRetry}>
                    <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 4v6h-6"></path>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Results Table */}
      {!isLoading && !error && (
        <ResultsTable 
          businesses={filteredBusinesses} 
          isLoading={isLoading} 
        />
      )}
    </div>
  );
}
