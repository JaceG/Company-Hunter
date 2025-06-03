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
import { downloadCSV } from "../lib/utils";
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [replaceDuplicates, setReplaceDuplicates] = useState<boolean>(false);
  const [csvPreviewData, setCsvPreviewData] = useState<SavedBusiness[]>([]);
  const [duplicatesFound, setDuplicatesFound] = useState<SavedBusiness[]>([]);
  const [existingDuplicates, setExistingDuplicates] = useState<SavedBusiness[]>([]);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState<boolean>(false);
  const [cleanupResults, setCleanupResults] = useState<{fixed: number, issues: string[]}>({fixed: 0, issues: []});
  const [showCleanupDialog, setShowCleanupDialog] = useState<boolean>(false);
  
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
            geocodeBusiness(business);
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

  const exportToCSVData = () => {
    if (filteredBusinesses.length > 0) {
      const csvData = filteredBusinesses.map(b => ({
        id: b._id,
        name: b.name,
        website: b.website || "",
        location: b.location || "",
        distance: "",
        isBadLead: b.isBadLead,
        notes: b.notes || "",
        careerLink: b.careerLink || ""
      }));
      
      const headers = ['Company Name', 'Website', 'Location', 'Bad Lead', 'Notes'];
      const csvRows = [
        headers.join(','),
        ...csvData.map(row => [
          `"${row.name}"`,
          `"${row.website}"`,
          `"${row.location}"`,
          row.isBadLead ? 'Yes' : 'No',
          `"${row.notes}"`
        ].join(','))
      ];
      
      const csvContent = csvRows.join('\n');
      downloadCSV(csvContent, "master_business_list.csv");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvContent(content);
        parseCSVContent(content);
      };
      reader.readAsText(file);
    }
  };

  const parseCSVContent = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return;

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIndex = headers.findIndex(h => h.includes('name') || h.includes('company'));
    const websiteIndex = headers.findIndex(h => h.includes('website') || h.includes('url'));
    const locationIndex = headers.findIndex(h => h.includes('location') || h.includes('address') || h.includes('city'));

    const businesses: SavedBusiness[] = [];
    const userId = (user as any)?.userId;

    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split(',').map(f => f.trim());
      
      if (nameIndex !== -1 && fields[nameIndex]) {
        const business: SavedBusiness = {
          userId: userId,
          name: fields[nameIndex] || '',
          website: websiteIndex !== -1 ? fields[websiteIndex] || '' : '',
          location: locationIndex !== -1 ? fields[locationIndex] || '' : '',
          isBadLead: false,
          notes: '',
          tags: []
        };
        businesses.push(business);
      }
    }

    setCsvPreviewData(businesses);
    
    // Check for duplicates
    if (savedBusinesses) {
      const duplicates = businesses.filter(csvBusiness => {
        return savedBusinesses.some(existing => {
          const nameMatch = csvBusiness.name.toLowerCase() === existing.name.toLowerCase();
          const websiteMatch = csvBusiness.website && existing.website && 
            csvBusiness.website.toLowerCase() === existing.website.toLowerCase();
          return nameMatch || websiteMatch;
        });
      });
      setDuplicatesFound(duplicates);
    }
  };

  const handleImportFromCSV = () => {
    if (csvPreviewData.length > 0) {
      importFromCSVMutation.mutate({ 
        businesses: csvPreviewData, 
        skipDuplicates, 
        replaceDuplicates 
      });
      
      setSelectedFile(null);
      setCsvContent("");
      setCsvPreviewData([]);
      setDuplicatesFound([]);
    }
  };

  const checkForExistingDuplicates = async () => {
    if (!savedBusinesses || savedBusinesses.length === 0) return;

    console.log(`Checking ${savedBusinesses.length} companies for duplicates...`);
    const duplicates: SavedBusiness[] = [];
    const seen = new Map<string, SavedBusiness>();

    // Helper functions for normalization
    const normalizeUrl = (url: string) => {
      if (!url || url === 'null' || url === 'undefined') return '';
      
      // Skip if it's clearly not a URL (like "LLC", "Inc.", etc.)
      if (/^(llc|inc\.?|corp\.?|ltd\.?|corporation)$/i.test(url.trim())) {
        return '';
      }
      
      const normalized = url.toLowerCase()
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .replace(/\/+$/, '');
      return normalized;
    };

    const normalizeName = (name: string) => {
      if (!name || name === 'null' || name === 'undefined') return '';
      const normalized = name.toLowerCase()
        .replace(/\s*(inc|llc|ltd|corp|corporation)\s*\.?$/i, '')
        .trim();
      return normalized;
    };

    savedBusinesses.forEach((business, index) => {
      const normalizedWebsite = normalizeUrl(business.website || '');
      const normalizedName = normalizeName(business.name);
      
      // Check for website duplicates
      if (normalizedWebsite && normalizedWebsite !== '') {
        const existingByWebsite = seen.get(`website:${normalizedWebsite}`);
        if (existingByWebsite) {
          console.log(`Website duplicate found:`, {
            original: { name: existingByWebsite.name, website: existingByWebsite.website },
            duplicate: { name: business.name, website: business.website },
            normalizedWebsite
          });
          // Mark both as duplicates
          if (!duplicates.find(d => d._id === existingByWebsite._id)) {
            duplicates.push(existingByWebsite);
          }
          if (!duplicates.find(d => d._id === business._id)) {
            duplicates.push(business);
          }
        } else {
          seen.set(`website:${normalizedWebsite}`, business);
        }
      }

      // Check for name duplicates
      if (normalizedName && normalizedName !== '') {
        const existingByName = seen.get(`name:${normalizedName}`);
        if (existingByName) {
          console.log(`Name duplicate found:`, {
            original: { name: existingByName.name, website: existingByName.website },
            duplicate: { name: business.name, website: business.website },
            normalizedName
          });
          // Mark both as duplicates
          if (!duplicates.find(d => d._id === existingByName._id)) {
            duplicates.push(existingByName);
          }
          if (!duplicates.find(d => d._id === business._id)) {
            duplicates.push(business);
          }
        } else {
          seen.set(`name:${normalizedName}`, business);
        }
      }
    });

    console.log(`Found ${duplicates.length} total duplicates`);
    setExistingDuplicates(duplicates);
    setShowDuplicatesDialog(true);
  };

  // Clean up data quality issues
  const cleanUpData = async () => {
    if (!savedBusinesses || savedBusinesses.length === 0) return;

    console.log(`Cleaning up data for ${savedBusinesses.length} companies...`);
    const fixes: string[] = [];
    let fixedCount = 0;

    for (const business of savedBusinesses) {
      let needsUpdate = false;
      const updates: Partial<SavedBusiness> = {};

      // Check if website field contains company suffixes instead of URLs
      if (business.website && /^(llc\.?|inc\.?|corp\.?|ltd\.?|corporation\.?)$/i.test(business.website.trim())) {
        const suffix = business.website.trim();
        updates.name = business.name + (business.name.endsWith('.') ? '' : ' ') + suffix;
        updates.website = '';
        fixes.push(`Fixed "${business.name}": Moved "${suffix}" from website to company name`);
        needsUpdate = true;
      }

      // Check if location field contains URLs
      if (business.location && /^https?:\/\//.test(business.location.trim())) {
        if (!business.website || business.website.trim() === '' || business.website === 'null') {
          updates.website = business.location.trim();
          updates.location = '';
          fixes.push(`Fixed "${business.name}": Moved URL from location to website field`);
          needsUpdate = true;
        }
      }

      // Check if website field contains "null" or similar placeholder values
      if (business.website && /^(null|undefined|n\/a|none|-)$/i.test(business.website.trim())) {
        updates.website = '';
        fixes.push(`Fixed "${business.name}": Cleared placeholder website value`);
        needsUpdate = true;
      }

      // Apply updates if needed
      if (needsUpdate && business._id) {
        try {
          await updateBusinessMutation.mutateAsync({
            id: business._id,
            updates
          });
          fixedCount++;
        } catch (error) {
          fixes.push(`Error updating "${business.name}": ${error}`);
        }
      }
    }

    setCleanupResults({ fixed: fixedCount, issues: fixes });
    setShowCleanupDialog(true);
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={checkForExistingDuplicates}>
                <AlertCircle className="w-4 h-4 mr-2" />
                Check for Duplicates
              </Button>
              <Button variant="outline" onClick={cleanUpData}>
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
                Clean Up Data
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <FileUp className="w-4 h-4 mr-2" />
                    Import From CSV
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Import Companies from CSV</AlertDialogTitle>
                    <AlertDialogDescription>
                      Upload a CSV file to import companies to your company list.
                      {csvPreviewData.length > 0 && (
                        <span className="block font-medium text-primary mt-1">
                          Found {csvPreviewData.length} companies in CSV file
                          {duplicatesFound.length > 0 && (
                            <span className="text-destructive ml-1">
                              ({duplicatesFound.length} potential duplicates detected)
                            </span>
                          )}
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  
                  {/* File Upload Section */}
                  <div className="grid w-full max-w-sm items-center gap-1.5 mb-4">
                    <Label htmlFor="csv-file">CSV File</Label>
                    <Input 
                      id="csv-file" 
                      type="file" 
                      accept=".csv"
                      onChange={handleFileUpload}
                    />
                  </div>

                  {/* Import Options */}
                  {csvPreviewData.length > 0 && (
                    <div className="mb-4 p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Import Options</h4>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="skip-duplicates" 
                            checked={skipDuplicates}
                            onCheckedChange={(checked) => setSkipDuplicates(checked === true)}
                          />
                          <Label htmlFor="skip-duplicates">Skip duplicate companies</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="replace-duplicates" 
                            checked={replaceDuplicates}
                            onCheckedChange={(checked) => setReplaceDuplicates(checked === true)}
                          />
                          <Label htmlFor="replace-duplicates">Replace duplicate companies with CSV data</Label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CSV Preview */}
                  {csvPreviewData.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Preview ({csvPreviewData.length} companies)</h4>
                      <div className="max-h-60 overflow-y-auto border rounded">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Company Name</TableHead>
                              <TableHead>Website</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvPreviewData.slice(0, 10).map((business, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{business.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{business.website || 'N/A'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{business.location || 'N/A'}</TableCell>
                                <TableCell>
                                  {duplicatesFound.some(dup => 
                                    dup.name.toLowerCase() === business.name.toLowerCase() ||
                                    (business.website && dup.website && business.website.toLowerCase() === dup.website.toLowerCase())
                                  ) ? (
                                    <Badge variant="destructive">Duplicate</Badge>
                                  ) : (
                                    <Badge variant="secondary">New</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                            {csvPreviewData.length > 10 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                  ... and {csvPreviewData.length - 10} more companies
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => {
                      setSelectedFile(null);
                      setCsvContent("");
                      setCsvPreviewData([]);
                      setDuplicatesFound([]);
                    }}>Cancel</AlertDialogCancel>
                    <Button
                      onClick={handleImportFromCSV}
                      disabled={!selectedFile || importFromCSVMutation.isPending}
                    >
                      {importFromCSVMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Import {csvPreviewData.length} Companies
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Companies</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {savedBusinesses?.length || 0} companies from your saved list. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                      variant="destructive"
                      onClick={() => clearAllBusinessesMutation.mutate()}
                      disabled={clearAllBusinessesMutation.isPending}
                    >
                      {clearAllBusinessesMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Clear All Companies
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
              {savedBusinesses?.length === 0 && (
                <Button variant="outline">
                  <FileUp className="w-4 h-4 mr-2" />
                  Import From CSV
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={exportToCSVData}
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

      {/* Duplicates Dialog */}
      <AlertDialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Companies Found</AlertDialogTitle>
            <AlertDialogDescription>
              Found {existingDuplicates.length} duplicate companies in your list. Review and manage them below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {existingDuplicates.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingDuplicates.map((business) => (
                    <TableRow key={business._id}>
                      <TableCell className="font-medium">{business.name}</TableCell>
                      <TableCell>{business.website || 'N/A'}</TableCell>
                      <TableCell>{business.location || 'N/A'}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (business._id) {
                              deleteBusinessMutation.mutate(business._id);
                              setExistingDuplicates(prev => prev.filter(b => b._id !== business._id));
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Data Cleanup Results Dialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Data Cleanup Results</AlertDialogTitle>
            <AlertDialogDescription>
              Fixed {cleanupResults.fixed} data quality issues in your company list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {cleanupResults.issues.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {cleanupResults.issues.map((issue, index) => (
                <div key={index} className="text-sm p-2 bg-muted rounded">
                  {issue}
                </div>
              ))}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}