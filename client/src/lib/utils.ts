import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Business } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Export business data as CSV
export function exportToCSV(businesses: Business[]): string {
  const headers = ["Bad Lead", "Company Name", "Website", "Location", "Distance", "Notes"];
  
  const rows = businesses.map(business => [
    business.isBadLead ? "TRUE" : "FALSE",
    business.name,
    business.website,
    business.location,
    business.distance,
    business.notes
  ]);
  
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  
  return csvContent;
}

// Download CSV file
export function downloadCSV(csvContent: string, filename: string = "business_results.csv"): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Copy content to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}
