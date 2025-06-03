import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, useLogout } from "../hooks/useAuth";
import { useSavedBusinesses, useUpdateSavedBusiness, useDeleteSavedBusiness, useImportFromSearch, useImportFromCSV, useClearAllSavedBusinesses, SavedBusiness } from "../hooks/useSavedBusinesses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { downloadCSV, exportToCSV } from "../lib/utils";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, FileUp, Download, AlertCircle, Trash2 } from "lucide-react";

export default function AccountPortal() {
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { data: savedBusinesses, isLoading: isBusinessesLoading, error } = useSavedBusinesses();
  const updateBusinessMutation = useUpdateSavedBusiness();
  const deleteBusinessMutation = useDeleteSavedBusiness();
  const importFromSearchMutation = useImportFromSearch();
  const importFromCSVMutation = useImportFromCSV();
  const clearAllBusinessesMutation = useClearAllSavedBusinesses();
  const logout = useLogout();
  const [, setLocation] = useLocation();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBadLeads, setFilterBadLeads] = useState(false);
  const [filterRecentOnly, setFilterRecentOnly] = useState(false);
  const [filterColumbus20Miles, setFilterColumbus20Miles] = useState(false);
  const [columbusCoords, setColumbusCoords] = useState<{lat: number, lng: number} | null>(null);
  const [businessCoords, setBusinessCoords] = useState<Map<string, {lat: number, lng: number}>>(new Map());
  const [geocodingInProgress, setGeocodingInProgress] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<keyof SavedBusiness>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  useEffect(() => {
    // Redirect to home if not authenticated
    if (!isAuthLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthLoading, isAuthenticated, setLocation]);

  // Get Columbus, Ohio coordinates when location filter is enabled
  useEffect(() => {
    if (filterColumbus20Miles && !columbusCoords) {
      getColumbusCoordinates();
    }
  }, [filterColumbus20Miles, columbusCoords]);

  const getColumbusCoordinates = async () => {
    try {
      const response = await fetch(`/api/geocode?address=Columbus,OH`);
      if (response.ok) {
        const data = await response.json();
        setColumbusCoords(data.coordinates);
      }
    } catch (error) {
      console.error('Failed to get Columbus coordinates:', error);
    }
  };

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Get coordinates from address using backend geocoding
  const getCoordinatesFromAddress = async (address: string): Promise<{lat: number, lng: number} | null> => {
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      if (response.ok) {
        const data = await response.json();
        return data.coordinates;
      } else {
        console.error('Geocoding failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to geocode address:', error);
    }
    return null;
  };

  // Geocode a business address and cache the result
  const geocodeBusiness = async (business: SavedBusiness) => {
    if (!business.location || !business._id) return null;
    
    // Check if we already have coordinates for this business
    if (businessCoords.has(business._id)) {
      return businessCoords.get(business._id)!;
    }
    
    // Check if geocoding is already in progress for this business
    if (geocodingInProgress.has(business._id)) {
      return null;
    }
    
    // Start geocoding
    setGeocodingInProgress(prev => new Set(prev).add(business._id!));
    
    try {
      const coords = await getCoordinatesFromAddress(business.location);
      if (coords) {
        setBusinessCoords(prev => new Map(prev).set(business._id!, coords));
        return coords;
      }
    } catch (error) {
      console.error(`Failed to geocode business ${business.name}:`, error);
    } finally {
      setGeocodingInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(business._id!);
        return newSet;
      });
    }
    
    return null;
  };

  // Helper function to check if a business was added recently (last 24 hours)
  const isRecentlyAdded = (business: SavedBusiness) => {
    if (!business.createdAt) return false;
    
    const createdDate = new Date(business.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffHours = diffTime / (1000 * 60 * 60);
    
    return diffHours <= 24;
  };
  
  // Filter and sort businesses
  const filteredBusinesses = savedBusinesses ? savedBusinesses
    .filter(business => {
      // Apply text search filter
      const searchMatch = searchTerm === "" || 
        business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (business.website && business.website.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (business.location && business.location.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Apply bad lead filter
      const badLeadMatch = !filterBadLeads || !business.isBadLead;
      
      // Apply recent only filter
      const recentMatch = !filterRecentOnly || isRecentlyAdded(business);
      
      // Apply Columbus 20-mile radius filter using coordinates
      let columbusMatch = true;
      if (filterColumbus20Miles) {
        if (!business._id || !business.location) {
          columbusMatch = false;
        } else if (businessCoords.has(business._id)) {
          // We have coordinates, calculate distance
          const coords = businessCoords.get(business._id)!;
          if (columbusCoords) {
            const distance = calculateDistance(
              columbusCoords.lat,
              columbusCoords.lng,
              coords.lat,
              coords.lng
            );
            columbusMatch = distance <= 20;
          } else {
            columbusMatch = false;
          }
        } else {
          // No coordinates yet - trigger geocoding for this business
          if (!geocodingInProgress.has(business._id)) {
            geocodeBusiness(business).catch(error => {
              console.error('Geocoding error:', error);
            });
          }
          // For now, show the business while geocoding is in progress
          columbusMatch = true;
        }
      }
      
      return searchMatch && badLeadMatch && recentMatch && columbusMatch;
    })
    .sort((a, b) => {
      // Apply sorting
      const aValue = a[sortField] || "";
      const bValue = b[sortField] || "";
      
      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    }) : [];

  const handleSort = (field: keyof SavedBusiness) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleToggleBadLead = (business: SavedBusiness) => {
    if (business._id) {
      updateBusinessMutation.mutate({
        id: business._id,
        updates: { isBadLead: !business.isBadLead }
      });
    }
  };

  const exportCSV = () => {
    if (filteredBusinesses.length > 0) {
      const csvContent = exportToCSV(filteredBusinesses.map(b => ({
        id: b._id,
        name: b.name,
        website: b.website || "",
        location: b.location || "",
        distance: "",
        isBadLead: b.isBadLead,
        notes: b.notes || "",
        careerLink: b.careerLink || ""
      })));
      
      downloadCSV(csvContent, "master_business_list.csv");
    }
  };
  
  if (isAuthLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>;
  }
  
  if (!isAuthenticated) {
    return null; // Will redirect to home
  }
  
  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl font-bold">Account Portal</CardTitle>
              <CardDescription>Manage your saved companies and master list</CardDescription>
            </div>
            <Button variant="outline" onClick={logout}>Log Out</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <p><strong>Email:</strong> {(user as any)?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company List */}
      <Card>
        <CardHeader>
          <CardTitle>My Company List</CardTitle>
          <CardDescription>
            Total: {filteredBusinesses.length} companies
            {savedBusinesses && ` (${savedBusinesses.length} total)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="filter-bad-leads" 
                  checked={filterBadLeads}
                  onCheckedChange={(checked) => setFilterBadLeads(checked === true)}
                />
                <Label htmlFor="filter-bad-leads">Hide Bad Leads</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="filter-recent-only" 
                  checked={filterRecentOnly}
                  onCheckedChange={(checked) => setFilterRecentOnly(checked === true)}
                />
                <Label htmlFor="filter-recent-only">Show Recent Only (24h)</Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="filter-columbus-20miles" 
                  checked={filterColumbus20Miles}
                  onCheckedChange={(checked) => setFilterColumbus20Miles(checked === true)}
                />
                <Label htmlFor="filter-columbus-20miles" className="flex items-center gap-2">
                  Within 20 miles of Columbus, OH
                  {filterColumbus20Miles && geocodingInProgress.size > 0 && (
                    <span className="text-xs text-muted-foreground">
                      (Calculating distances... {geocodingInProgress.size} remaining)
                    </span>
                  )}
                </Label>
              </div>
            </div>
          </div>

          {isBusinessesLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              Loading companies...
            </div>
          ) : error ? (
            <div className="text-center p-8">
              <p className="text-red-600 mb-4">Error loading companies: {error.message}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <div className="text-center p-8">
              <p className="text-muted-foreground mb-4">
                {savedBusinesses?.length === 0 
                  ? "No companies in your list yet. Import some companies to get started." 
                  : "No companies match your current filters."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={exportCSV}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Showing {filteredBusinesses.length} of {savedBusinesses?.length || 0} companies
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Bad Lead</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                        Company Name {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("website")}>
                        Website {sortField === "website" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("location")}>
                        Location {sortField === "location" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort("createdAt")}>
                        Date Added {sortField === "createdAt" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBusinesses.map((business) => (
                      <TableRow 
                        key={business._id} 
                        className={business.isBadLead ? "bg-red-50" : ""}
                      >
                        <TableCell>
                          <Checkbox 
                            checked={business.isBadLead}
                            onCheckedChange={() => handleToggleBadLead(business)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {business.name}
                            {isRecentlyAdded(business) && (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                New
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {business.website ? (
                            <a 
                              href={business.website.startsWith('http') ? business.website : `https://${business.website}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {business.website}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">No website</span>
                          )}
                        </TableCell>
                        <TableCell>{business.location || 'N/A'}</TableCell>
                        <TableCell>
                          {business.createdAt ? new Date(business.createdAt).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>{business.notes || ''}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (business._id) {
                                deleteBusinessMutation.mutate(business._id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}