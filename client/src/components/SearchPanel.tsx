import { useState } from "react";
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchParams } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useStateSearch, useStateCities } from "@/hooks/useStateSearch";
import { useApiKeys } from "@/hooks/useApiKeys";
import { MapPin, Key, Sparkles, AlertCircle } from "lucide-react";

interface SearchPanelProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

interface StateSearchParams {
  businessType: string;
  state: string;
  maxCities: number;
  maxResults: number;
}

export default function SearchPanel({ onSearch, isLoading }: SearchPanelProps) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useState<SearchParams>({
    businessType: "",
    location: "Columbus, OH",
    radius: "20",
    maxResults: "100"
  });
  
  const [stateParams, setStateParams] = useState<StateSearchParams>({
    businessType: "",
    state: "Ohio",
    maxCities: 100,
    maxResults: 200
  });
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  const { data: apiKeysStatus } = useApiKeys();
  const stateSearch = useStateSearch();
  const stateCities = useStateCities();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setSearchParams(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  const handleStateInputChange = (field: keyof StateSearchParams, value: string | number) => {
    setStateParams(prev => ({ ...prev, [field]: value }));
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
        description: "Please enter a location to search",
        variant: "destructive"
      });
      return;
    }
    
    onSearch(searchParams);
  };

  const handleStateSearch = async () => {
    if (!stateParams.businessType.trim()) {
      toast({
        title: "Business type is required",
        description: "Please enter a business type to search for",
        variant: "destructive"
      });
      return;
    }

    if (!apiKeysStatus?.hasGooglePlacesKey) {
      toast({
        title: "Google Places API key required",
        description: "Please set up your API keys first",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await stateSearch.mutateAsync(stateParams);
      
      toast({
        title: "State search completed",
        description: `Found ${result.total} businesses across ${result.searchedCities} cities`,
      });
      
      // Convert state search result to regular search format for display
      onSearch({
        businessType: stateParams.businessType,
        location: `${stateParams.state} (${result.searchedCities} cities)`,
        radius: "statewide",
        maxResults: result.total.toString()
      });
    } catch (error) {
      console.error("State search error:", error);
      toast({
        title: "Search failed",
        description: "Failed to search state. Please check your API keys and try again.",
        variant: "destructive"
      });
    }
  };

  const handleGetSuggestions = async () => {
    if (!searchParams.businessType.trim()) {
      toast({
        title: "Job role is required",
        description: "Please enter your job role to get search suggestions",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoadingSuggestions(true);
      const response = await fetch('/api/businesses/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessType: searchParams.businessType
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }
      
      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setAvailableCities(data.availableCities || []);
      setShowSuggestions(true);
      
      toast({
        title: "Suggestions generated",
        description: `Generated ${data.suggestions?.length || 0} search terms for ${data.availableCities?.length || 0} cities`,
      });
    } catch (error) {
      console.error('Error getting suggestions:', error);
      toast({
        title: "Failed to generate suggestions",
        description: "Please check your OpenAI API key setup",
        variant: "destructive"
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const getCitiesForState = async (state: string) => {
    try {
      const result = await stateCities.mutateAsync({ state, maxCities: 100 });
      toast({
        title: "Cities loaded",
        description: `Found ${result.count} cities in ${state}. Estimated cost: ${result.estimatedCost.total}`,
      });
    } catch (error) {
      console.error("Error getting cities:", error);
      toast({
        title: "Failed to load cities",
        description: "Please check your API key setup",
        variant: "destructive"
      });
    }
  };

  const US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", 
    "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", 
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", 
    "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", 
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", 
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", 
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", 
    "Wisconsin", "Wyoming"
  ];

  return (
    <Card className="w-full h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" />
          Business Search
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!apiKeysStatus?.hasGooglePlacesKey && (
          <Alert className="mb-4">
            <Key className="h-4 w-4" />
            <AlertDescription className="text-sm break-words">
              Google Places API key required for searching. Please set up your API keys in Account Portal.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-3 text-xs">
            <TabsTrigger value="single" className="text-xs">Single</TabsTrigger>
            <TabsTrigger value="state" className="text-xs">State</TabsTrigger>
            <TabsTrigger value="suggestions" className="text-xs">AI</TabsTrigger>
          </TabsList>
          
          <TabsContent value="single" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type / Job Role</Label>
                <Input
                  id="businessType"
                  value={searchParams.businessType}
                  onChange={handleInputChange}
                  placeholder="e.g., software engineer, marketing manager, dentist"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={searchParams.location}
                  onChange={handleInputChange}
                  placeholder="e.g., Columbus, OH"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="radius">Search Radius</Label>
                  <Select value={searchParams.radius} onValueChange={(value) => handleSelectChange(value, 'radius')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 miles</SelectItem>
                      <SelectItem value="10">10 miles</SelectItem>
                      <SelectItem value="20">20 miles</SelectItem>
                      <SelectItem value="50">50 miles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxResults">Max Results</Label>
                  <Select value={searchParams.maxResults} onValueChange={(value) => handleSelectChange(value, 'maxResults')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 results</SelectItem>
                      <SelectItem value="50">50 results</SelectItem>
                      <SelectItem value="100">100 results</SelectItem>
                      <SelectItem value="200">200 results</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button type="submit" disabled={isLoading || !apiKeysStatus?.hasGooglePlacesKey} className="w-full">
                {isLoading ? "Searching..." : "Search Businesses"}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="state" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="state-business-type">Business Type / Job Role</Label>
                <Input
                  id="state-business-type"
                  value={stateParams.businessType}
                  onChange={(e) => handleStateInputChange('businessType', e.target.value)}
                  placeholder="e.g., software engineer, marketing manager, dentist"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select value={stateParams.state} onValueChange={(value) => handleStateInputChange('state', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-cities">Max Cities</Label>
                  <Select 
                    value={stateParams.maxCities.toString()} 
                    onValueChange={(value) => handleStateInputChange('maxCities', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">Top 25 cities</SelectItem>
                      <SelectItem value="50">Top 50 cities</SelectItem>
                      <SelectItem value="100">Top 100 cities</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="state-max-results">Max Results</Label>
                  <Select 
                    value={stateParams.maxResults.toString()} 
                    onValueChange={(value) => handleStateInputChange('maxResults', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 results</SelectItem>
                      <SelectItem value="200">200 results</SelectItem>
                      <SelectItem value="500">500 results</SelectItem>
                      <SelectItem value="1000">1000 results</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Estimated cost: ${(stateParams.maxCities * 0.049).toFixed(2)} for {stateParams.maxCities} cities
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={handleStateSearch}
                disabled={stateSearch.isPending || !apiKeysStatus?.hasGooglePlacesKey} 
                className="w-full"
              >
                {stateSearch.isPending ? "Searching State..." : `Search ${stateParams.state}`}
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => getCitiesForState(stateParams.state)}
                disabled={stateCities.isPending}
                className="w-full"
              >
                {stateCities.isPending ? "Loading..." : `Preview Cities for ${stateParams.state}`}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="suggestions" className="space-y-4">
            {!apiKeysStatus?.hasOpenaiKey && (
              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  OpenAI API key required for AI suggestions. Please set up your API keys.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="suggestion-job">Job Role</Label>
                <Input
                  id="suggestion-job"
                  value={searchParams.businessType}
                  onChange={handleInputChange}
                  placeholder="e.g., software engineer, marketing manager"
                />
              </div>
              
              <Button 
                onClick={handleGetSuggestions}
                disabled={loadingSuggestions || !apiKeysStatus?.hasOpenaiKey}
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {loadingSuggestions ? "Generating..." : "Generate AI Suggestions"}
              </Button>
              
              {showSuggestions && suggestions.length > 0 && (
                <div className="space-y-2">
                  <Label>Suggested Search Terms</Label>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchParams(prev => ({ ...prev, businessType: suggestion }))}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {availableCities.length > 0 && (
                <div className="space-y-2">
                  <Label>Available Cities ({availableCities.length})</Label>
                  <div className="text-sm text-gray-600 max-h-32 overflow-y-auto">
                    {availableCities.slice(0, 20).join(", ")}
                    {availableCities.length > 20 && "..."}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}