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
- Drizzle ORM for database interactions (prepared for PostgreSQL)
- TypeScript for type safety across the stack

### Data Storage
- PostgreSQL database (setup in the Replit configuration but not fully implemented)
- Schema defined with Drizzle ORM for storing business information
- In-memory storage fallback implementation for development

## Key Components

### Backend Components
- `server/index.ts`: Entry point for the Express server
- `server/routes.ts`: API route definitions for business search and management
- `server/storage.ts`: Data storage abstraction for accessing business data
- `shared/schema.ts`: Database schema definitions using Drizzle ORM

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
   - PostgreSQL is configured in the Replit environment
   - Drizzle migrations will be used for schema changes

## Getting Started

1. Ensure the PostgreSQL database is properly set up in your Replit environment
2. Run `npm install` to install all dependencies
3. Set up the Google Places API key as an environment variable (`GOOGLE_PLACES_API_KEY`)
4. Run `npm run db:push` to initialize the database schema
5. Start the application with `npm run dev`

## Development Workflow

1. Backend API endpoint changes should be made in `server/routes.ts`
2. Frontend components are in `client/src/components/`
3. Database schema changes should be made in `shared/schema.ts`
4. After schema changes, run `npm run db:push` to update the database
5. Use React Query hooks in `client/src/hooks/` for data fetching

## Troubleshooting

- If the database connection fails, check the `DATABASE_URL` environment variable
- For Google Places API issues, verify the API key is correctly set
- Frontend build issues can often be resolved by clearing the Vite cache