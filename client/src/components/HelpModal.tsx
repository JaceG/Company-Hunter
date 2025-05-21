interface HelpModalProps {
  onClose: () => void;
}

export default function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-secondary">How to Use This Tool</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-medium text-secondary mb-2">Getting Started</h3>
            <p className="text-sm text-gray-600">This tool uses the Google Places API to search for businesses based on your criteria and generate a CSV file with the results.</p>
          </div>
          
          <div>
            <h3 className="font-medium text-secondary mb-2">Search Options</h3>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li><strong>Business Type:</strong> Enter the type of business (e.g., "Software Company", "Tech Agency")</li>
              <li><strong>Location:</strong> Specify city, state, or address to center your search</li>
              <li><strong>Search Radius:</strong> Set how far from the location to search</li>
              <li><strong>Max Results:</strong> Limit the number of results returned</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-secondary mb-2">Using the Results</h3>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Review the table of businesses matching your criteria</li>
              <li>Mark any entries as "Bad Lead" if not relevant</li>
              <li>Download as CSV to use in spreadsheet software</li>
              <li>Copy results to clipboard for quick pasting</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-secondary mb-2">Google Places API</h3>
            <p className="text-sm text-gray-600">This application uses the Google Places API to search for business information. Your API key is securely stored and used for these requests.</p>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-opacity-90 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
