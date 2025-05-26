import { useState } from "react";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
    
    if (!searchParams.location.trim()) {
      toast({
        title: "Location is required",
        description: "Please enter a location to search in",
        variant: "destructive"
      });
      return;
    }
    
    onSearch(searchParams);
  };

  return (
    <div className="lg:col-span-4 space-y-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center text-[#0c0a09]">
            <svg className="w-5 h-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            Search Criteria
          </h2>
          
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="businessType" className="text-sm font-medium mb-1 text-[#0c0a09]">Business Type</Label>
              <Input
                id="businessType"
                placeholder="Software Company, Tech Agency, etc."
                value={searchParams.businessType}
                onChange={handleInputChange}
                required
              />
              <p className="mt-1 text-xs text-gray-500">Enter the type of business you're looking for</p>
            </div>
            
            <div>
              <Label htmlFor="location" className="text-sm font-medium mb-1 text-[#0c0a09]">Location</Label>
              <Input
                id="location"
                placeholder="Columbus, OH"
                value={searchParams.location}
                onChange={handleInputChange}
                required
              />
              <p className="mt-1 text-xs text-gray-500">City, state, or address</p>
            </div>
            
            <div>
              <Label htmlFor="radius" className="text-sm font-medium mb-1 text-[#0c0a09]">Search Radius (miles)</Label>
              <Select
                value={searchParams.radius}
                onValueChange={(value) => handleSelectChange(value, "radius")}
              >
                <SelectTrigger id="radius">
                  <SelectValue placeholder="Search radius" />
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
            
            <div className="pt-2">
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
                    Search Businesses
                  </div>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {/* API Configuration and images have been removed as requested */}
    </div>
  );
}
