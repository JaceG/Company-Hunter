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
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <p><strong>Email:</strong> {user?.email}</p>
            </div>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <FileUp className="w-4 h-4 mr-2" />
                    Import From CSV
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Import Companies from CSV</AlertDialogTitle>
                    <AlertDialogDescription>
                      Upload a CSV file to import companies to your company list.
                      Duplicates will be handled based on your preference.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="mb-4">
                    <Input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleFileChange}
                    />
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Checkbox id="ignore-duplicates" />
                      <Label htmlFor="ignore-duplicates">Skip duplicate entries</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="replace-duplicates" />
                      <Label htmlFor="replace-duplicates">Replace existing duplicates</Label>
                    </div>
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
                        // Clear all data
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