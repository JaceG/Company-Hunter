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

### For Users Setting Up Their Own Instance:
1. **MongoDB Setup**: Create a MongoDB Atlas account and cluster (see SETUP.md for detailed instructions)
2. **Environment Variables**: Configure `MONGODB_URI` with your MongoDB Atlas connection string
3. **Dependencies**: Run `npm install` to install all dependencies
4. **API Keys**: Set up `GOOGLE_PLACES_API_KEY` and `OPENAI_API_KEY` as environment variables (optional - users can provide their own)
5. **Start**: Run `npm run dev` to start the application

### Environment Variable Priority:
- The app checks for server-level API keys first (GOOGLE_PLACES_API_KEY, OPENAI_API_KEY)
- If server keys exist, all users see APIs as "configured" 
- Users can still provide their own keys which take priority over server keys
- If no server keys exist, users must configure their own through the Account Portal

### MongoDB Configuration:
- No hardcoded connection strings - uses environment variables only
- Supports both `MONGODB_URI` and `DATABASE_URL` environment variables
- Shows clear error messages if MongoDB connection is not configured
- See SETUP.md for complete MongoDB Atlas setup instructions

## Recent Updates (July 2025)

### AI Job Role Search Integration ✅
**Completed**: Successfully integrated AI-powered job role search into both Single Search and State Search tabs.

**Features Added**:
- **Job Role Input Field**: Separate field for entering job roles (e.g., "software engineer", "marketing manager")
- **AI Business Suggestions**: OpenAI generates 12-18 relevant business types for job seekers
- **Click-to-Use Interface**: Generated suggestions can be clicked to auto-fill business type field
- **Smart API Key Management**: Uses user's OpenAI key or falls back to system key
- **Consolidated Interface**: Reduced from 3 tabs to 2 (Single Search, State Search) with AI integrated

**User Flow**:
1. User enters their job role (e.g., "web developer")
2. Clicks "Get AI Suggestions" button
3. AI generates relevant company types ("software company", "web development agency", "tech startup", etc.)
4. User clicks suggestions to populate business search field
5. Performs normal search with AI-enhanced terms

### API Optimization Updates

**Problem**: Previous state-wide search was making 300+ API calls per search, causing performance issues and high costs.

**Optimization Solution Implemented**:
- **Performance Limits**: Reduced max cities from 100 to 5, max results from 200 to 50 for optimal performance
- **Dynamic City Generation**: Replaced hardcoded city lists with OpenAI-generated cities (cached for 24 hours)
- **Smart Storage**: Results stored for duplicate detection and export functionality
- **Aggressive Caching**: 24-hour geocoding cache, 1-hour places cache to prevent repeated calls
- **Rate Limiting**: Staggered requests with delays, batch processing of max 2 cities concurrently
- **Optimized API Calls**: Streamlined API usage while maintaining full functionality

**Performance Features**:
- Maximum 5 cities per search for optimal speed and cost efficiency
- Search completes in under 2 minutes with proper rate limiting
- Full duplicate detection and export capabilities maintained
- Fallback city lists for reliable operation

**Estimated API Usage**: Reduced from 300+ calls per search to maximum 15 calls (5 cities × 3 API calls max) while maintaining all core features.

### MongoDB URI Management ✅
**Completed**: Added MongoDB URI configuration interface in Account Portal.

**Features**:
- Users can now configure custom MongoDB Atlas connection strings
- Environment variable fallback support maintained
- Secure storage with other API keys
- Status indicator shows "Custom URI configured" vs "Using environment variable"

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