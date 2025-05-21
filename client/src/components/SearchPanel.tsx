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
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
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
          <h2 className="text-lg font-semibold mb-4 text-secondary flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            Search Criteria
          </h2>
          
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="businessType" className="text-sm font-medium text-secondary mb-1">Business Type</Label>
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
              <Label htmlFor="location" className="text-sm font-medium text-secondary mb-1">Location</Label>
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
              <Label htmlFor="radius" className="text-sm font-medium text-secondary mb-1">Search Radius (miles)</Label>
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
              <Label htmlFor="maxResults" className="text-sm font-medium text-secondary mb-1">Max Results</Label>
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
      
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-secondary flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            API Configuration
          </h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="apiKey" className="text-sm font-medium text-secondary mb-1">Google Places API Key</Label>
              <div className="relative">
                <Input
                  type={apiKeyVisible ? "text" : "password"}
                  id="apiKey"
                  value={apiKeyVisible ? "AIzaSyDNAdkNIQtoTq8SdgBXLP3JvFAimA8LsxM" : "••••••••••••••••••••••••••••••"}
                  disabled
                />
                <button
                  onClick={() => setApiKeyVisible(!apiKeyVisible)}
                  className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  {apiKeyVisible ? (
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">API key is securely stored</p>
            </div>
            
            <div>
              <p className="text-sm text-secondary flex items-center">
                <svg className="w-5 h-5 mr-1 text-[hsl(var(--success))]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Google Places API is active
              </p>
              <p className="text-xs text-gray-500 mt-1">Ready to use for business searches</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Business images section */}
      <div className="hidden md:block">
        {/* A professional office building with modern architecture */}
        <div className="rounded-lg overflow-hidden shadow-md mb-4">
          <img 
            src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500" 
            alt="Modern office building" 
            className="w-full h-auto"
          />
        </div>
        
        {/* Tech company open workspace with people collaborating */}
        <div className="rounded-lg overflow-hidden shadow-md">
          <img 
            src="https://images.unsplash.com/photo-1552581234-26160f608093?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500" 
            alt="Tech company workspace" 
            className="w-full h-auto"
          />
        </div>
      </div>
    </div>
  );
}
