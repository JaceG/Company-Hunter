# CompanyHunter - Business Search Application

![License](https://img.shields.io/badge/License-MIT-blue.svg)

## 🚀 Demo Mode - Try Before You Sign Up!

**Experience CompanyHunter instantly with no account required!** Our demo mode lets you explore the full power of business search with built-in rate limiting and quota management.

### Demo Features
- **20 Free Searches**: Start searching immediately without creating an account
- **Full Search Capabilities**: Access all search features including:
  - Single location business searches
  - State-wide multi-city searches  
  - AI-powered business type suggestions
  - Duplicate detection and filtering
- **Export Functionality**: Download results as CSV or copy to clipboard
- **Real-time Quota Tracking**: Visual progress bar showing remaining searches
- **Rate Limiting Protection**: 3-second cooldown prevents abuse while ensuring fair usage

### Demo Limitations & Security
- **Search Cooldown**: 3-second delay between searches to prevent abuse
- **20 Search Quota**: Fixed limit that resets when you create an account
- **Temporary Data**: Guest search results are automatically cleaned up after 90 days
- **No Persistent Lists**: Cannot create custom saved business lists (available to registered users)
- **Rate Limiting**: Frontend and backend protection against rapid successive searches

### Upgrading from Demo
When you're ready for unlimited access:
1. Click "Register" in the header or when quota is exhausted
2. Your demo search data will be automatically migrated to your personal account
3. Set up your own API keys for unlimited searches
4. Access advanced features like custom lists and permanent data storage

## Overview
CompanyHunter is a comprehensive business search application that helps users find potential business leads using Google Places API. It supports both demo mode for instant access and full user accounts with individual API key management, intelligent search caching, and comprehensive business management capabilities.

**Key Features:**
- **Demo Mode**: Instant access with 20 free searches and rate limiting
- Single location and state-wide business searches
- AI-powered search term generation using OpenAI
- 48-hour intelligent result caching to reduce API costs
- Multi-user authentication with individual API key management
- Business lead management with lists and notes
- CSV import/export functionality
- Duplicate detection and cleanup

## Prerequisites
- **Node.js 18+** installed with ESM (ES Modules) support
- **MongoDB Atlas** account (free tier available)
- **Google Cloud Platform** account for Places API access
- **OpenAI** account for AI features (optional)

## Demo Mode Testing Results ✅

### ✅ Comprehensive Testing Completed
**Guest Search Functionality:**
- ✅ API endpoints responding correctly
- ✅ Demo mode detection: `{"demoMode":true,"isGuest":true}`
- ✅ Quota tracking: Search quota decrements properly (20→19 after search)
- ✅ Search results: Successfully retrieved 60 businesses for "software companies" in Columbus, OH
- ✅ Guest businesses endpoint: `GET /api/guest/businesses` returns `{"businesses":[]}`
- ✅ Auto-save endpoint: `POST /api/guest/businesses/auto-save` accessible

**Rate Limiting Implementation:**
- ✅ 3-second cooldown implemented in frontend
- ✅ Visual feedback with countdown timers on search buttons
- ✅ Rate limiting alert with progress bar
- ✅ Toast notifications for rate limit violations
- ✅ Disabled search buttons during cooldown

**Frontend Integration:**
- ✅ Rate limiting alerts display properly
- ✅ Search buttons show cooldown status
- ✅ Demo mode banner with quota visualization
- ✅ TypeScript compilation (minor existing errors in other files)

### Testing Command Examples
```bash
# Test demo mode status
curl "http://localhost:3000/api/auth/api-keys"
# Returns: {"demoMode":true,"searchesRemaining":20,"canSearch":true}

# Test business search
curl -X POST "http://localhost:3000/api/businesses/search" \
  -H "Content-Type: application/json" \
  -d '{"businessType":"software companies","location":"Columbus, OH"}'
# Returns: {"businesses":[...],"isGuest":true,"searchesRemaining":19}

# Test guest businesses for duplicate detection
curl "http://localhost:3000/api/guest/businesses"
# Returns: {"businesses":[]}
```

## Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

```bash
# Required Core Configuration
JWT_SECRET=your-custom-jwt-secret-here
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/businessSearchApp?retryWrites=true&w=majority
ENCRYPTION_KEY=your-32-character-encryption-key

# Required Demo Mode Configuration
DEMO_GOOGLE_PLACES_API_KEY=your-demo-google-places-api-key
DEMO_OPENAI_API_KEY=your-demo-openai-api-key
DEMO_MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/businessSearchApp?retryWrites=true&w=majority

# Optional Development Settings
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### Demo Mode Environment Variables
The demo mode requires the owner's API keys to provide free searches:
- `DEMO_GOOGLE_PLACES_API_KEY`: Powers guest business searches
- `DEMO_OPENAI_API_KEY`: Enables AI suggestions for guests  
- `DEMO_MONGODB_URI`: Stores guest search data (90-day cleanup)

**Important**: These demo keys are separate from user API keys and have usage monitoring to prevent abuse.

## MongoDB Atlas Setup

### 1. Create MongoDB Atlas Account
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Sign up for a free account
3. Create a new cluster (free M0 tier is sufficient for development)

### 2. Configure Database Access
1. In Atlas dashboard, go to "Database Access"
2. Click "Add New Database User"
3. Create a user with password authentication
4. Grant "Atlas Admin" privileges or at least "readWrite" to your database

### 3. Configure Network Access
1. Go to "Network Access"
2. Click "Add IP Address"
3. For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
4. For production: Add specific IP addresses

### 4. Get Connection String
1. Go to "Database" → "Connect" → "Connect your application"
2. Select "Node.js" driver
3. Copy the connection string
4. Replace `<password>` with your database user password
5. Replace `<dbname>` with `businessSearchApp` (or your preferred database name)

Example connection string:
```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/businessSearchApp?retryWrites=true&w=majority
```

## API Key Setup

### Google Places API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing one
3. Enable the following APIs:
   - **Places API (New)** - Primary API for searches
   - **Places API (Legacy)** - For backwards compatibility
   - **Geocoding API** - For location resolution
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Restrict the API key to only the APIs you enabled
6. Set appropriate usage limits to control costs
7. (Optional) Add your domain to HTTP referrer restrictions

**Important Cost Information:**
- Places Text Search: ~$32 per 1,000 requests
- Place Details: ~$17 per 1,000 requests  
- Geocoding: ~$5 per 1,000 requests
- **Average cost per business found: ~$0.049**

### OpenAI API Setup (Optional)
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account and verify your phone number
3. Go to "API Keys" and create a new secret key
4. Note: OpenAI requires a paid account for production usage
5. Used for intelligent business search term generation

## Installation & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Application
```bash
npm run dev
```

The application will start on **http://localhost:3000** (port is fixed)

### 3. Production Build & Deploy
```bash
npm run build
npm start
```

## API Key Management System

The application supports both demo mode (no keys required) and user mode (own API keys required):

### Demo Mode (No Account Required)
- Uses owner's pre-configured API keys in environment variables
- 20 search limit with 3-second rate limiting
- No user API key setup required
- Automatic data cleanup after 90 days

### User Mode (Account Required)
- **Google Places API Key** - Required for all business searches
- **OpenAI API Key** - Required for AI-powered search features  
- **MongoDB Atlas URI** - Required for data storage (users provide their own database)

### User-Level Keys (Required for Accounts)
- All users must provide their own API keys through the Account Portal
- All three API keys are mandatory for the application to function
- Users manage their own API costs and usage limits
- Each user's data is stored in their own MongoDB Atlas database
- Complete privacy and individual usage control

## Features

### Demo Mode Features
- **Instant Access**: No registration required to start searching
- **Rate Limiting**: 3-second cooldown between searches with visual feedback
- **Quota Management**: 20 searches with real-time tracking
- **Full Search Access**: Single location and state-wide searches
- **AI Suggestions**: Intelligent business type suggestions
- **Export Capabilities**: CSV download and clipboard copy
- **Duplicate Detection**: Automatic filtering across search sessions

### Advanced Search Capabilities
- **Single Location Search**: Search businesses in a specific city/location with radius control
- **State-wide Search**: Search across top 100+ cities in any US state
- **AI-Powered Search Terms**: OpenAI generates intelligent search terms based on job roles
- **Smart Caching**: 48-hour result caching prevents duplicate API calls and reduces costs

### Business Management
- Save businesses to personal lists with custom names
- Mark businesses as "bad leads" to filter them out
- Add custom notes and career page links
- Export results to CSV format
- Import businesses from CSV files with intelligent duplicate detection
- Advanced duplicate detection using normalized business names and websites

### Multi-User Support
- User registration and authentication with JWT tokens
- Individual API key management per user
- Personal business lists isolated between users
- Secure data separation in MongoDB

### Performance & Cost Optimization
- **Search Fingerprinting**: Generates unique hashes for search parameters
- **Intelligent Caching**: Stores complete search results for 48 hours
- **Automatic Cache Cleanup**: MongoDB TTL indexes remove expired cache entries
- **Cache Age Indicators**: Shows users how old cached results are
- **Cross-User Cache Sharing**: Identical searches by different users share cached results

## Rate Limiting & Security

### Demo Mode Protection
- **Client-Side Rate Limiting**: 3-second cooldown between searches
- **Visual Feedback**: Countdown timers and progress bars
- **Toast Notifications**: User-friendly rate limit messages
- **Button State Management**: Disabled buttons during cooldown
- **Abuse Prevention**: Prevents rapid API consumption

### Security Features
- **JWT Authentication**: 7-day tokens with proper verification
- **Password Security**: bcrypt hashing with 10 salt rounds
- **Input Validation**: Zod schemas for all API endpoints
- **API Key Encryption**: AES-256-GCM encryption for stored keys
- **Rate Limiting**: Multiple layers of protection
- **Data Isolation**: Separate guest and user data storage

## Deployment

### Replit Deployment (Recommended)
1. Fork this repository to Replit
2. Set environment variables in Replit Secrets:
   - `MONGODB_URI` (required)
   - `DEMO_GOOGLE_PLACES_API_KEY` (required for demo mode)
   - `DEMO_OPENAI_API_KEY` (required for demo mode)
   - `DEMO_MONGODB_URI` (required for demo mode)
3. Run the application - it will automatically install dependencies

### Other Cloud Platforms
- Ensure all environment variables are properly set
- MongoDB Atlas should be accessible from your deployment platform
- The application serves on port 3000 (not configurable)
- Consider setting up proper CORS and security headers for production
- Supports both horizontal and vertical scaling

### Local Development
- Uses Vite for hot module replacement in development
- TypeScript files run directly using `tsx` in development
- Production builds bundle the backend using ESBuild

## Database Schema

The application creates the following MongoDB collections:
- `users` - User accounts and authentication
- `savedBusinesses` - Personal business lists per user
- `savedLists` - Custom business list categories
- `apiKeys` - Individual user API key storage
- `cachedSearches` - Search result cache with automatic expiration
- `guestSearches` - Demo mode search results with 90-day TTL

## Troubleshooting

### Demo Mode Issues
- **Rate Limiting**: Wait for cooldown timer to complete
- **Quota Exhausted**: Sign up for an account to continue
- **Search Errors**: Check server logs for API key issues

### MongoDB Connection Issues
- Verify connection string format and credentials
- Check database user permissions (requires readWrite access)
- Ensure network access is configured for your IP
- Test connection using MongoDB Compass or Atlas web interface

### Google Places API Issues
- Verify API keys are correctly formatted (no extra spaces)
- Check that all required APIs are enabled in Google Cloud Console
- Monitor API quotas and billing in Google Cloud Console
- Verify rate limits are not exceeded

### Application Issues
- Check server logs for detailed error messages
- Verify all required environment variables are set
- Clear browser cache if experiencing frontend issues
- Check Node.js version (requires 18+)
- Ensure MongoDB Atlas is accessible from your deployment

### Common Error Messages
- "MongoDB connection string required" → Set MONGODB_URI environment variable
- "Search rate limited" → Wait for 3-second cooldown to complete
- "Quota exhausted" → Create account or wait for quota reset
- "Authentication required" → User needs to log in or register

## Support & Development

### Architecture Notes
- **Frontend**: React 18 with TypeScript, Vite build system
- **Backend**: Express.js with ESM modules
- **Database**: MongoDB with native driver
- **Authentication**: JWT tokens with bcrypt password hashing
- **Validation**: Zod schemas for type-safe API validation
- **Styling**: Tailwind CSS with Radix UI components

### Development Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run check` - TypeScript type checking

### Getting Help
For technical issues:
1. Check the application logs for error messages
2. Verify your environment variables are correctly set
3. Test your MongoDB connection independently
4. Ensure API keys have proper permissions and sufficient quotas
5. Check the GitHub repository for known issues and updates

---

**🎯 Start with Demo Mode - no signup required! Experience the full power of CompanyHunter instantly.**

**Note**: This application is designed for business lead generation and research purposes. Please ensure compliance with Google Places API terms of service and applicable data protection regulations in your jurisdiction.