export default function AppFooter() {
  return (
    <footer className="bg-white mt-12 py-6 border-t border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-500">
            &copy; 2025 Business Search & CSV Generator
          </p>
          <div className="mt-4 md:mt-0 flex gap-x-4">
            <a href="#" className="text-sm text-gray-500 hover:text-primary">Help</a>
            <a href="https://developers.google.com/maps/documentation/places/web-service/overview" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-primary">API Documentation</a>
            <a href="#" className="text-sm text-gray-500 hover:text-primary">Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
