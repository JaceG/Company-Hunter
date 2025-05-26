import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, useLogout } from "../hooks/useAuth";
import { useSavedBusinesses, useUpdateSavedBusiness, useDeleteSavedBusiness, useImportFromSearch, useImportFromCSV, useClearAllSavedBusinesses, SavedBusiness } from "../hooks/useSavedBusinesses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCSV, exportToCSV } from "../lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, FileUp, ArrowUpRightFromSquare, Trash, Download, AlertCircle } from "lucide-react";

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
  const [sortField, setSortField] = useState<keyof SavedBusiness>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [replaceDuplicates, setReplaceDuplicates] = useState<boolean>(false);
  const [csvPreviewData, setCsvPreviewData] = useState<SavedBusiness[]>([]);
  const [duplicatesFound, setDuplicatesFound] = useState<SavedBusiness[]>([]);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [existingDuplicates, setExistingDuplicates] = useState<SavedBusiness[]>([]);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState<boolean>(false);
  
  useEffect(() => {
    // Redirect to home if not authenticated
    if (!isAuthLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthLoading, isAuthenticated, setLocation]);
  
  // Parse CSV content into business objects
  const parseCSVContent = (content: string) => {
    // Split by lines
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length === 0) return [];
    
    // Get headers (first line)
    let headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // If no headers found, use default headers
    if (headers.length === 0) {
      headers = ['name', 'website', 'location', 'distance', 'notes'];
    }
    
    // Map to business objects
    const businesses: SavedBusiness[] = [];
    
    // Start from index 1 (skip headers) unless there's only one line
    const startIndex = lines.length === 1 ? 0 : 1;
    
    for (let i = startIndex; i < lines.length; i++) {
      // Handle CSV with quotes and commas inside quotes
      let values: string[] = [];
      const line = lines[i];
      let inQuotes = false;
      let currentValue = '';
      
      // Parse CSV values properly (handling quotes)
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      
      // Add the last value
      values.push(currentValue.trim());
      
      // If simple split didn't work, try again with basic split
      if (values.length <= 1) {
        values = line.split(',').map(v => v.trim());
      }
      
      // Skip if not enough values (at least name)
      if (values.length === 0) continue;
      
      const business: any = {
        userId: user?.userId || '',
        isBadLead: false,
        notes: '',
      };
      
      // Try to automatically detect columns if headers don't match expected ones
      let nameIndex = headers.findIndex(h => h === 'name' || h.includes('company') || h.includes('business'));
      let websiteIndex = headers.findIndex(h => h === 'website' || h.includes('site') || h.includes('url'));
      let locationIndex = headers.findIndex(h => h === 'location' || h.includes('address') || h.includes('city'));
      
      // If columns aren't found, make an educated guess based on content
      if (nameIndex === -1 && websiteIndex === -1) {
        // Guess: first column is usually name, second is usually website
        nameIndex = 0;
        websiteIndex = 1; 
        locationIndex = 2;
      }
      
      // Try to set the business name
      if (nameIndex >= 0 && values[nameIndex]) {
        business.name = values[nameIndex];
      } else if (values[0]) {
        // Fallback: Use first column as name
        business.name = values[0];
      }
      
      // Try to set the website
      if (websiteIndex >= 0 && values[websiteIndex]) {
        business.website = values[websiteIndex];
      } else if (values[1] && (values[1].includes('.com') || values[1].includes('http'))) {
        // Fallback: Second column might be website if it looks like a URL
        business.website = values[1];
      }
      
      // Try to set the location
      if (locationIndex >= 0 && values[locationIndex]) {
        business.location = values[locationIndex];
      }
      
      // Map any remaining values based on headers
      headers.forEach((header, index) => {
        if (values[index]) {
          if (header === 'distance') {
            business.distance = values[index];
          } else if (header === 'career link' || header.includes('career')) {
            business.careerLink = values[index];
          } else if (header === 'notes') {
            business.notes = values[index];
          }
        }
      });
      
      // Only add if it has at least a name
      if (business.name) {
        businesses.push(business);
      }
    }
    
    console.log('Parsed businesses:', businesses); // Debug log
    return businesses;
  };

  // Function to identify potential duplicates
  const findDuplicates = (newBusinesses: SavedBusiness[]) => {
    if (!savedBusinesses) return [];
    
    const duplicates: SavedBusiness[] = [];
    
    newBusinesses.forEach(newBusiness => {
      // Check if business is a duplicate based on website or name
      const isDuplicate = savedBusinesses.some(existing => {
        // Check website match (normalize domain)
        if (existing.website && newBusiness.website) {
          const normalizeUrl = (url: string) => {
            return url.toLowerCase()
                     .replace(/^https?:\/\//i, '')
                     .replace(/^www\./i, '')
                     .replace(/\/+$/, '');
          };
          
          const existingDomain = normalizeUrl(existing.website);
          const newDomain = normalizeUrl(newBusiness.website);
          
          if (existingDomain === newDomain) return true;
        }
        
        // Check name match (normalize company names)
        if (existing.name && newBusiness.name) {
          const normalizeName = (name: string) => {
            return name.toLowerCase()
                      .replace(/\s*(inc|llc|ltd|corp|corporation)\s*\.?$/i, '')
                      .trim();
          };
          
          const existingName = normalizeName(existing.name);
          const newName = normalizeName(newBusiness.name);
          
          if (existingName === newName) return true;
        }
        
        return false;
      });
      
      if (isDuplicate) {
        duplicates.push(newBusiness);
      }
    });
    
    return duplicates;
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      
      // Reset preview states
      setShowPreview(false);
      setCsvPreviewData([]);
      setDuplicatesFound([]);
      
      // Read file content
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const content = event.target.result as string;
          setCsvContent(content);
          
          // Parse and preview the CSV data
          const parsedData = parseCSVContent(content);
          setCsvPreviewData(parsedData);
          
          // Find duplicates
          const duplicates = findDuplicates(parsedData);
          setDuplicatesFound(duplicates);
          
          // Show preview if there's data to show
          if (parsedData.length > 0) {
            setShowPreview(true);
          }
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  };
  
  // Preview the CSV data before importing
  const handlePreviewCSV = () => {
    setShowPreview(true);
  };
  
  // Handle CSV import
  const handleImportCSV = async () => {
    if (csvContent) {
      try {
        await importFromCSVMutation.mutateAsync({
          csvData: csvContent,
          skipDuplicates,
          replaceDuplicates
        });
        
        // Reset states
        setSelectedFile(null);
        setCsvContent("");
        setCsvPreviewData([]);
        setDuplicatesFound([]);
        setShowPreview(false);
      } catch (error) {
        console.error("Error importing CSV:", error);
      }
    }
  };
  
  // Handle import from search results
  const handleImportFromSearch = async () => {
    try {
      await importFromSearchMutation.mutateAsync();
    } catch (error) {
      console.error("Error importing from search:", error);
    }
  };
  
  // Handle updating a business
  const handleUpdateBusiness = async (id: string, updates: Partial<SavedBusiness>) => {
    try {
      await updateBusinessMutation.mutateAsync({ id, updates });
    } catch (error) {
      console.error("Error updating business:", error);
    }
  };
  
  // Handle deleting a business
  const handleDeleteBusiness = async (id: string) => {
    try {
      await deleteBusinessMutation.mutateAsync(id);
    } catch (error) {
      console.error("Error deleting business:", error);
    }
  };
  
  // Handle toggling bad lead status
  const handleToggleBadLead = (business: SavedBusiness) => {
    if (business._id) {
      handleUpdateBusiness(business._id, { isBadLead: !business.isBadLead });
    }
  };
  
  // Handle export to CSV
  const handleExportCSV = () => {
    if (filteredBusinesses.length > 0) {
      const csvContent = exportToCSV(filteredBusinesses.map(b => ({
        name: b.name,
        website: b.website || "",
        location: b.location || "",
        distance: b.distance || "",
        isBadLead: b.isBadLead,
        notes: b.notes || "",
        careerLink: b.careerLink || ""
      })));
      
      downloadCSV(csvContent, "master_business_list.csv");
    }
  };
  
  // Helper function to check if a business was added recently (last 24 hours)
  const isRecentlyAdded = (business: SavedBusiness) => {
    if (!business.createdAt) return false;
    
    const createdDate = new Date(business.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffHours = diffTime / (1000 * 60 * 60);
    
    return diffHours <= 24; // Within the last 24 hours
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
      
      return searchMatch && badLeadMatch && recentMatch;
    })
    .sort((a, b) => {
      // Apply sorting
      const aValue = a[sortField] || "";
      const bValue = b[sortField] || "";
      
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return sortDirection === "asc" ? 
          (aValue === bValue ? 0 : aValue ? 1 : -1) : 
          (aValue === bValue ? 0 : aValue ? -1 : 1);
      }
      
      const compareResult = String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? compareResult : -compareResult;
    }) : [];
  
  // Handle sort changes
  const handleSort = (field: keyof SavedBusiness) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Check for duplicates in existing saved companies
  const checkForExistingDuplicates = () => {
    if (!savedBusinesses || savedBusinesses.length === 0) {
      console.log('No saved businesses to check');
      return;
    }

    console.log(`Checking ${savedBusinesses.length} companies for duplicates...`);
    const duplicates: SavedBusiness[] = [];
    const seen = new Map<string, SavedBusiness>();

    // Helper functions for normalization
    const normalizeUrl = (url: string) => {
      if (!url) return '';
      const normalized = url.toLowerCase()
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .replace(/\/+$/, '');
      return normalized;
    };

    const normalizeName = (name: string) => {
      if (!name) return '';
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
  
  if (isAuthLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin" />
      <span className="ml-2">Loading...</span>
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
              <p><strong>Email:</strong> {user?.email}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={checkForExistingDuplicates}>
                <AlertCircle className="w-4 h-4 mr-2" />
                Check for Duplicates
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
                  
                  <div className="mb-4">
                    <Label htmlFor="csv-file" className="mb-2 block">Select CSV File</Label>
                    <Input 
                      id="csv-file"
                      type="file" 
                      accept=".csv" 
                      onChange={handleFileChange}
                    />
                  </div>
                  
                  {showPreview && csvPreviewData.length > 0 && (
                    <div className="border rounded-md mb-4 overflow-hidden">
                      <div className="bg-muted p-2 font-medium flex items-center justify-between">
                        <span>CSV Preview</span>
                        {duplicatesFound.length > 0 && (
                          <span className="text-sm text-destructive flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {duplicatesFound.length} duplicates found
                          </span>
                        )}
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Company</TableHead>
                              <TableHead>Website</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead className="w-[100px] text-right">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvPreviewData.slice(0, 10).map((business, index) => {
                              const isDuplicate = duplicatesFound.some(d => 
                                d.name === business.name || d.website === business.website
                              );
                              
                              return (
                                <TableRow key={index} className={isDuplicate ? "bg-destructive/10" : ""}>
                                  <TableCell className="font-medium">{business.name}</TableCell>
                                  <TableCell>{business.website || "-"}</TableCell>
                                  <TableCell>{business.location || "-"}</TableCell>
                                  <TableCell className="text-right">
                                    {isDuplicate ? (
                                      <span className="text-destructive font-medium">Duplicate</span>
                                    ) : (
                                      <span className="text-primary">New</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {csvPreviewData.length > 10 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                  + {csvPreviewData.length - 10} more entries
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  
                  {duplicatesFound.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-medium mb-2 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1 text-destructive" />
                        Duplicate Handling Options
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Checkbox 
                          id="ignore-duplicates" 
                          checked={skipDuplicates}
                          onCheckedChange={(checked) => {
                            setSkipDuplicates(checked === true);
                            // If skipping, can't replace
                            if (checked === true) {
                              setReplaceDuplicates(false);
                            }
                          }}
                        />
                        <Label htmlFor="ignore-duplicates">
                          Skip duplicate entries ({duplicatesFound.length})
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="replace-duplicates" 
                          checked={replaceDuplicates}
                          disabled={skipDuplicates}
                          onCheckedChange={(checked) => {
                            setReplaceDuplicates(checked === true);
                          }}
                        />
                        <Label htmlFor="replace-duplicates">
                          Replace existing duplicates with new data
                        </Label>
                      </div>
                    </div>
                  )}
                  
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleImportCSV} 
                      disabled={!selectedFile}
                    >
                      Import Companies
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export Current View
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive border-destructive hover:bg-destructive/10">
                    <Trash className="w-4 h-4 mr-2" />
                    Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will permanently delete all your saved companies and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        clearAllBusinessesMutation.mutate(undefined, {
                          onSuccess: (result) => {
                            console.log(`Deleted ${result.count} companies`);
                          }
                        });
                      }} 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

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
            </div>
          </div>

          {isBusinessesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-2">Loading your companies...</span>
            </div>
          ) : error ? (
            <div className="text-red-500 py-4">
              Error loading saved businesses. Please try again.
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No companies found. Import some companies or adjust your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Status</TableHead>
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
                            className="flex items-center text-blue-600 hover:underline"
                          >
                            {business.website}
                            <ArrowUpRightFromSquare className="w-3 h-3 ml-1" />
                          </a>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{business.location || "-"}</TableCell>
                      <TableCell>
                        {business.createdAt ? (
                          <div className="flex flex-col">
                            <span>{new Date(business.createdAt).toLocaleDateString()}</span>
                            <span className="text-xs text-gray-500">{new Date(business.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{business.notes || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => business._id && handleDeleteBusiness(business._id)}
                        >
                          <Trash className="w-4 h-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duplicates Check Dialog */}
      <AlertDialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Companies Found</AlertDialogTitle>
            <AlertDialogDescription>
              {existingDuplicates.length === 0 ? (
                "Great news! No duplicates were found in your company list."
              ) : (
                `Found ${existingDuplicates.length} duplicate companies in your saved list. Review and remove duplicates as needed.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {existingDuplicates.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted p-2 font-medium">
                Duplicate Companies
              </div>
              <div className="max-h-64 overflow-y-auto">
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
                        <TableCell>
                          {business.website && (
                            <a 
                              href={business.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center"
                            >
                              {business.website}
                              <ArrowUpRightFromSquare className="w-3 h-3 ml-1" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell>{business.location}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (business._id) {
                                deleteBusinessMutation.mutate(business._id);
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDuplicatesDialog(false)}>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}