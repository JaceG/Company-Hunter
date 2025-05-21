import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, useLogout } from "../hooks/useAuth";
import { useSavedBusinesses, useUpdateSavedBusiness, useDeleteSavedBusiness, useImportFromSearch, useImportFromCSV, SavedBusiness } from "../hooks/useSavedBusinesses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCSV, exportToCSV } from "../lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, FileUp, ArrowUpRightFromSquare, Trash, Download, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";

export default function AccountPortal() {
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { data: savedBusinesses, isLoading: isBusinessesLoading, error } = useSavedBusinesses();
  const updateBusinessMutation = useUpdateSavedBusiness();
  const deleteBusinessMutation = useDeleteSavedBusiness();
  const importFromSearchMutation = useImportFromSearch();
  const importFromCSVMutation = useImportFromCSV();
  const logout = useLogout();
  const [, setLocation] = useLocation();
  
  // Special mutation for loading Jace's sample data
  const importSampleMutation = useMutation({
    mutationFn: async () => {
      // Fetch the CSV file content directly
      const response = await fetch('/attached_assets/List of Companies - Sheet1.csv');
      const csvData = await response.text();
      
      // Send it to our import endpoint
      return await importFromCSVMutation.mutateAsync(csvData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my/businesses'] });
    },
    onError: (error) => {
      console.error("Error importing sample data:", error);
    }
  });
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBadLeads, setFilterBadLeads] = useState(false);
  const [sortField, setSortField] = useState<keyof SavedBusiness>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  
  useEffect(() => {
    // Redirect to home if not authenticated
    if (!isAuthLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthLoading, isAuthenticated, setLocation]);
  
  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      
      // Read file content
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCsvContent(event.target.result as string);
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  };
  
  // Handle CSV import
  const handleImportCSV = async () => {
    if (csvContent) {
      try {
        await importFromCSVMutation.mutateAsync(csvContent);
        setSelectedFile(null);
        setCsvContent("");
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
  
  // Handle import of sample data for Jace's account
  const handleImportSampleData = async () => {
    try {
      // Create some sample companies directly (this bypasses file loading issues)
      const sampleCompanies = [
        { name: "6IXTH CITY MARKETING", website: "https://www.sixthcitymarketing.com/", careerLink: "https://www.sixthcitymarketing.com/careers/", location: "35 E Gay St, #324, Columbus, OH", isBadLead: false, notes: "" },
        { name: "Smith Commerce", website: "https://smithcommerce.com/", careerLink: "https://smithcommerce.com/about/careers/", location: "555 Edgar Waldo Way Suite 401, Columbus, OH 43215", isBadLead: true, notes: "" },
        { name: "Kow Abundant", website: "https://kowabundant.com/", careerLink: "https://kowabundant.com/columbus-marketing-jobs/", location: "1071 Fishinger Road STE 109, Columbus, Ohio 43221", isBadLead: false, notes: "" },
        { name: "Third Street Digital", website: "https://thirdstreetdigital.com/", careerLink: "https://thirdstreetdigital.com/good-jobs/", location: "15 W Cherry St #401, Columbus, OH 43215", isBadLead: false, notes: "" },
        { name: "Fuego Leads", website: "https://fuegoleads.io/", careerLink: "https://fuegoleads.io/careers-page/", location: "243 N 5th St, Columbus, OH 43215", isBadLead: false, notes: "" },
        { name: "Mindstream Interactive", website: "https://www.fahlgrenmortine.com/", careerLink: "https://www.fahlgrenmortine.com/careers", location: "4030 Easton Station Suite 300, Columbus, OH 43219", isBadLead: false, notes: "" },
        { name: "Postali LLC", website: "https://www.postali.com/", careerLink: "https://www.postali.com/careers/", location: "274 Marconi Blvd, Ste 220, Columbus, OH 43215", isBadLead: false, notes: "" },
        { name: "Post House Creative", website: "https://posthouse.tv/", careerLink: "https://posthouse.tv/careers/", location: "52 E Lynn St, Columbus, OH 43215", isBadLead: false, notes: "" },
        { name: "ZoCo Design", website: "https://zocodesign.com/", careerLink: "https://zocodesign.com/careers", location: "1027 W. 5th Ave, Columbus, OH 43212", isBadLead: false, notes: "" },
        { name: "WillowTree", website: "https://www.willowtreeapps.com/", careerLink: "https://www.willowtreeapps.com/careers/jobs", location: "274 Marconi Blvd #300, Columbus, OH 43215", isBadLead: false, notes: "" }
      ];
      
      // Import each company individually
      for (const company of sampleCompanies) {
        await apiRequest('/api/my/businesses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(company)
        });
      }
      
      // Refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/my/businesses'] });
      
      toast({
        title: "Your company list loaded!",
        description: "Your personal company list has been imported successfully.",
      });
    } catch (error) {
      console.error("Error loading sample data:", error);
      toast({
        title: "Import failed",
        description: "There was a problem loading your company list. Please try again.",
        variant: "destructive"
      });
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
      
      return searchMatch && badLeadMatch;
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
          <div className="flex flex-col mb-6">
            <div className="flex-1 mb-3">
              <p><strong>Email:</strong> {user?.email}</p>
            </div>
            
            {/* Prominent import section */}
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-medium mb-2">Import Companies to Your Account</h3>
              <p className="text-sm text-gray-600 mb-3">
                Your master list is currently empty. Import companies from search results or CSV file to build your personal collection.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="lg"
                  onClick={handleImportFromSearch}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={importFromSearchMutation.isPending}
                >
                  {importFromSearchMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>Import All Search Results</>
                  )}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="lg">
                      <FileUp className="w-4 h-4 mr-2" />
                      Import From CSV
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Import Companies from CSV</AlertDialogTitle>
                      <AlertDialogDescription>
                        Upload a CSV file to import companies to your master list.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="mb-4">
                      <Input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileChange}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleImportCSV} 
                        disabled={!selectedFile}
                      >
                        Import
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                {/* Special Jace Account Features */}
                {user?.email === 'jace.galloway@gmail.com' && (
                  <Button 
                    variant="default" 
                    size="lg"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleImportSampleData}
                    disabled={importSampleMutation.isPending}
                  >
                    {importSampleMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading Your Data...
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4 mr-2" />
                        Load My Company List
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export Current View
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Master Company List</CardTitle>
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
            <div className="flex items-center gap-2">
              <Checkbox 
                id="filter-bad-leads" 
                checked={filterBadLeads}
                onCheckedChange={(checked) => setFilterBadLeads(checked === true)}
              />
              <Label htmlFor="filter-bad-leads">Hide Bad Leads</Label>
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
                      <TableCell className="font-medium">{business.name}</TableCell>
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
    </div>
  );
}