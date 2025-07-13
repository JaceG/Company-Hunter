# Business Search & CSV Generator Application

## Overview

This application allows users to search for businesses using the Google Places API based on various criteria (business type, location, radius), display the results, and export them to CSV format. The application marks and filters "bad leads" and provides a clean interface for managing business search results.

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- Built with React (client-side rendering)
- Uses Shadcn UI components (based on Radix UI primitives)
- TanStack React Query for data fetching and state management
- Tailwind CSS for styling
- Vite as the build tool and development server

### Backend
- Node.js with Express.js for API endpoints
- Integration with Google Places API for business search functionality
- MongoDB Atlas for user data and saved companies
- TypeScript for type safety across the stack

### Data Storage
- MongoDB Atlas for user accounts and saved business lists (persistent)
- In-memory storage for temporary search results (fast and efficient)
- No PostgreSQL dependency - simplified architecture

## Key Components

### Backend Components
- `server/index.ts`: Entry point for the Express server
- `server/routes.ts`: API route definitions for business search and management
- `server/storage.ts`: In-memory storage for temporary search results
- `server/mongodb.ts`: MongoDB Atlas connection and user/business operations
- `shared/schema.ts`: Schema definitions for data validation

### Frontend Components
- `client/src/App.tsx`: Main application component with routing
- `client/src/pages/Home.tsx`: Main page component combining search and results
- `client/src/components/SearchPanel.tsx`: Form for entering search criteria
- `client/src/components/ResultsPanel.tsx`: Displays search results in a table
- `client/src/hooks/useBusiness.ts`: Custom hooks for business data operations
- UI components from Shadcn UI library for consistent design

## Data Flow

1. **User Search Flow**:
   - User enters search criteria (business type, location, radius) in the SearchPanel
   - Frontend sends a POST request to `/api/businesses/search` with search parameters
   - Backend validates the input and calls the Google Places API
   - Results are processed and stored in the database
   - Frontend receives and displays the results in the ResultsTable component

2. **Data Management Flow**:
   - Users can mark businesses as "bad leads" through the UI
   - Updates are sent to the backend via PUT/PATCH requests
   - Data can be exported as CSV or copied to the clipboard

## External Dependencies

### Frontend Dependencies
- React and React DOM for UI
- TanStack React Query for data fetching
- Radix UI components for accessible UI elements
- Tailwind CSS for styling
- Wouter for routing
- Lucide React for icons

### Backend Dependencies
- Express.js for API server
- Drizzle ORM for database interactions
- Zod for validation
- Google Places API for business search

### Development Dependencies
- TypeScript for type checking
- Vite for building and development
- ESBuild for production builds
- TSX for running TypeScript files directly

## Deployment Strategy

The application is configured to run on Replit with:

1. **Development Mode**:
   - `npm run dev` command starts both frontend and backend
   - Vite handles hot module replacement for the frontend
   - Backend uses the `tsx` runner for TypeScript execution

2. **Production Build**:
   - Frontend is built using Vite
   - Backend is bundled using ESBuild
   - Combined into a single deployment package

3. **Database Strategy**:
   - MongoDB Atlas handles user accounts and saved company lists
   - In-memory storage for fast search result processing

## Getting Started

1. Ensure MongoDB Atlas connection string is configured
2. Run `npm install` to install all dependencies
3. Set up the Google Places API key as an environment variable (`GOOGLE_PLACES_API_KEY`)
4. Set up OpenAI API key for AI-powered job search features
5. Start the application with `npm run dev`

## Recent Cost Reduction Improvements (July 2025)

**Problem**: Application was generating $200+ Google API charges from automatic AI-enhanced searches.

**Solution Implemented**:
- **Suggestion System**: Replaced automatic 720-search AI feature with cost-effective suggestion box
- **API Caching**: Added comprehensive caching for geocoding and business details to prevent repeated calls
- **Field Optimization**: Removed unnecessary fields from Details API calls (kept name, website, formatted_address)
- **Expanded Coverage**: Increased from 40 to 60-80 Ohio cities for more comprehensive manual searches
- **Cost Transparency**: Added cost estimates and guidance in the UI

**Estimated Cost Reduction**: From $200+ per AI search to ~$0.049 per manual search location.

## Development Workflow

1. Backend API endpoint changes should be made in `server/routes.ts`
2. Frontend components are in `client/src/components/`
3. MongoDB operations are handled in `server/mongodb.ts`
4. Schema validation changes should be made in `shared/schema.ts`
5. Use React Query hooks in `client/src/hooks/` for data fetching

## Troubleshooting

- If MongoDB connection fails, check the MongoDB Atlas connection string
- For Google Places API issues, verify the API key is correctly set
- For OpenAI features, ensure the OpenAI API key is configured
- Frontend build issues can often be resolved by clearing the Vite cache