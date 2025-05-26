import { useState } from "react";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchParams } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface SearchPanelProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

export default function SearchPanel({ onSearch, isLoading }: SearchPanelProps) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useState<SearchParams>({
    businessType: "",
    location: "Columbus, OH",
    radius: "20",
    maxResults: "100"
  });
  
  const [searchEntireState, setSearchEntireState] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setSearchParams(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!searchParams.businessType.trim()) {
      toast({
        title: "Business type is required",
        description: "Please enter a business type to search for",
        variant: "destructive"
      });
      return;
    }
    
    if (!searchParams.location.trim() && !searchEntireState) {
      toast({
        title: "Location is required",
        description: "Please enter a location or select state-wide search",
        variant: "destructive"
      });
      return;
    }
    
    // Modify search parameters for state-wide search
    const finalSearchParams = searchEntireState 
      ? { ...searchParams, location: "Ohio, USA", radius: "0" }
      : searchParams;
    
    onSearch(finalSearchParams);
  };

  const handleEnhancedSearch = async () => {
    if (!searchParams.businessType.trim()) {
      toast({
        title: "Job role is required",
        description: "Please enter your job role for the AI-powered company search",
        variant: "destructive"
      });
      return;
    }

    try {
      // Call the enhanced search endpoint
      const response = await fetch('/api/businesses/ai-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessType: searchParams.businessType, // This now represents the job role
          location: "Ohio, USA",
          radius: "0",
          maxResults: "500" // Higher limit for enhanced search
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Enhanced search failed');
      }
      
      toast({
        title: "AI Job Search Complete!",
        description: `Found ${data.total} companies that hire "${searchParams.businessType}" using ${data.searchTermsUsed} smart search terms across ${data.citiesSearched} Ohio cities`,
      });

      // Trigger a refresh of the results by calling onSearch with empty params
      // This will fetch the newly saved businesses from storage
      onSearch({ businessType: "", location: "", radius: "20", maxResults: "100" });
      
    } catch (error) {
      console.error("Enhanced search error:", error);
      toast({
        title: "Search Error",
        description: error instanceof Error ? error.message : "Failed to perform enhanced search. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="lg:col-span-4 space-y-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center text-[#0c0a09]">
            <svg className="w-5 h-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            Find Companies That Would Hire You
          </h2>
          
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="businessType" className="text-sm font-medium mb-1 text-[#0c0a09]">Your Job Role</Label>
              <Input
                id="businessType"
                placeholder="e.g., Web Developer, Graphic Designer, Marketing Manager, Accountant"
                value={searchParams.businessType}
                onChange={handleInputChange}
                required
              />
              <p className="mt-1 text-xs text-gray-500">Enter your job role to find companies that would hire you</p>
            </div>
            
            <div>
              <Label htmlFor="location" className="text-sm font-medium mb-1 text-[#0c0a09]">Location</Label>
              <Input
                id="location"
                placeholder="Columbus, OH"
                value={searchParams.location}
                onChange={handleInputChange}
                required={!searchEntireState}
                disabled={searchEntireState}
              />
              <div className="mt-2 flex items-center space-x-2">
                <Checkbox 
                  id="search-entire-state" 
                  checked={searchEntireState}
                  onCheckedChange={(checked) => setSearchEntireState(checked === true)}
                />
                <Label htmlFor="search-entire-state" className="text-sm">
                  Search entire state of Ohio (ignores location and radius)
                </Label>
              </div>
              {!searchEntireState && (
                <p className="mt-1 text-xs text-gray-500">City, state, or address</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="radius" className="text-sm font-medium mb-1 text-[#0c0a09]">Search Radius (miles)</Label>
              <Select
                value={searchParams.radius}
                onValueChange={(value) => handleSelectChange(value, "radius")}
                disabled={searchEntireState}
              >
                <SelectTrigger id="radius">
                  <SelectValue placeholder={searchEntireState ? "Not applicable for state-wide search" : "Search radius"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 miles</SelectItem>
                  <SelectItem value="10">10 miles</SelectItem>
                  <SelectItem value="15">15 miles</SelectItem>
                  <SelectItem value="20">20 miles</SelectItem>
                  <SelectItem value="50">50 miles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="maxResults" className="text-sm font-medium mb-1 text-[#0c0a09]">Max Results</Label>
              <Select
                value={searchParams.maxResults}
                onValueChange={(value) => handleSelectChange(value, "maxResults")}
              >
                <SelectTrigger id="maxResults">
                  <SelectValue placeholder="Max results" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 results</SelectItem>
                  <SelectItem value="50">50 results</SelectItem>
                  <SelectItem value="100">100 results</SelectItem>
                  <SelectItem value="200">200 results</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-2 space-y-2">
              <Button 
                type="submit" 
                className="w-full bg-primary text-white" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    Quick Search
                  </div>
                )}
              </Button>
              
              <Button 
                type="button"
                variant="outline"
                className="w-full border-green-500 text-green-700 hover:bg-green-50" 
                disabled={isLoading || !searchParams.businessType.trim()}
                onClick={() => handleEnhancedSearch()}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                  AI Job Search - All Ohio Companies
                </div>
              </Button>
              
              <p className="text-xs text-gray-500 text-center">
                AI finds companies that would hire your role across all Ohio cities using smart business type variations
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
      {/* API Configuration and images have been removed as requested */}
    </div>
  );
}
