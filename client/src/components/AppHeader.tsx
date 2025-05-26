import { useState } from "react";
import HelpModal from "./HelpModal";

export default function AppHeader() {
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  return (
    <>
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-primary mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <h1 className="text-xl font-semibold text-[0c0a09]">Business Search & CSV Generator</h1>
          </div>
          <div>
            <button 
              onClick={() => setShowHelpModal(true)}
              className="text-primary hover:text-opacity-80 transition"
            >
              <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>
      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </>
  );
}
