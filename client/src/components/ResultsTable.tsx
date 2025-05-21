import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Business } from "@/lib/types";
import { useUpdateBusiness } from "@/hooks/useBusiness";

interface ResultsTableProps {
  businesses: Business[];
  isLoading: boolean;
}

export default function ResultsTable({ businesses, isLoading }: ResultsTableProps) {
  const [selectAll, setSelectAll] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const updateBusiness = useUpdateBusiness();
  
  // Calculate pagination
  const totalPages = Math.ceil(businesses.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBusinesses = businesses.slice(startIndex, endIndex);
  
  // Handle select all checkbox
  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    
    // Update all businesses in the current page
    currentBusinesses.forEach(business => {
      if (business.id && business.isBadLead !== newSelectAll) {
        updateBusiness.mutate({
          id: business.id,
          data: { isBadLead: newSelectAll }
        });
      }
    });
  };
  
  // Handle individual checkbox
  const handleCheckboxChange = (business: Business) => {
    if (business.id) {
      updateBusiness.mutate({
        id: business.id,
        data: { isBadLead: !business.isBadLead }
      });
    }
  };
  
  // Empty state
  if (!isLoading && businesses.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col items-center justify-center py-10">
          <svg className="w-16 h-16 text-gray-300 mb-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p className="text-lg font-medium text-gray-900">No results yet</p>
          <p className="text-sm max-w-md mt-2 text-center text-gray-500">Enter your search criteria and click "Search Businesses" to find companies.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">
                <div className="flex items-center">
                  <Checkbox 
                    id="selectAll" 
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                    className="mr-2"
                  />
                  <span>Bad Lead</span>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  Company Name
                  <button className="ml-1 text-gray-400 hover:text-gray-500">
                    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 15l5 5 5-5"></path>
                      <path d="M7 9l5-5 5 5"></path>
                    </svg>
                  </button>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  Website
                  <button className="ml-1 text-gray-400 hover:text-gray-500">
                    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 15l5 5 5-5"></path>
                      <path d="M7 9l5-5 5 5"></path>
                    </svg>
                  </button>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  Location
                  <button className="ml-1 text-gray-400 hover:text-gray-500">
                    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 15l5 5 5-5"></path>
                      <path d="M7 9l5-5 5 5"></path>
                    </svg>
                  </button>
                </div>
              </TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentBusinesses.map((business) => (
              <TableRow 
                key={business.id}
                className={business.isDuplicate ? "bg-amber-50 relative" : "relative"}
              >
                <TableCell>
                  <Checkbox 
                    checked={business.isBadLead}
                    onCheckedChange={() => handleCheckboxChange(business)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {business.name}
                  {business.isDuplicate && (
                    <>
                      <span className="ml-2 inline-flex items-center">
                        <svg 
                          className="w-4 h-4 text-amber-500" 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                          <line x1="12" y1="9" x2="12" y2="13"></line>
                          <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                      </span>
                      {/* Mobile duplicate indicator */}
                      <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-800 border-amber-200 sm:hidden">
                        Duplicate
                      </Badge>
                    </>
                  )}
                </TableCell>
                <TableCell>
                  {business.website ? (
                    <a 
                      href={business.website} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-primary hover:underline"
                    >
                      {business.website.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  ) : (
                    <span className="text-gray-400">No website</span>
                  )}
                </TableCell>
                <TableCell className="text-gray-500">{business.location}</TableCell>
                <TableCell className="text-gray-500">{business.distance}</TableCell>
                <TableCell>
                  {business.isDuplicate && (
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 hidden sm:inline-flex">
                      Duplicate
                    </Badge>
                  )}
                  {business.careerLink && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 ml-1">
                      Has Career
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      {businesses.length > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          {/* Mobile pagination */}
          <div className="flex flex-1 justify-between items-center sm:hidden">
            <p className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md
                  ${page === 1 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"}`}
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md
                  ${page === totalPages 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"}`}
              >
                Next
              </button>
            </div>
          </div>
          
          {/* Desktop pagination */}
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                <span className="font-medium">{Math.min(endIndex, businesses.length)}</span> of{" "}
                <span className="font-medium">{businesses.length}</span> results
              </p>
            </div>
            
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        onClick={() => setPage(p)}
                        isActive={page === p}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
