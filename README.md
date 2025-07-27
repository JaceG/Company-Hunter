# CompanyHunter - Business Search Application
![License](https://img.shields.io/badge/License-MIT-blue.svg)

## Overview
CompanyHunter is a comprehensive business search application that helps users find potential business leads using Google Places API. It supports multi-user environments with individual API key management, intelligent search caching, and comprehensive business management capabilities.

**Key Features:**
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

## Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

```bash
# MongoDB Configuration (Required)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/businessSearchApp?retryWrites=true&w=majority

# Alternative (if using DATABASE_URL instead)
# DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/businessSearchApp

# JWT Secret (Optional - will use default if not provided)
JWT_SECRET=your-custom-jwt-secret-here

# Server-level API Keys (Optional - users can provide their own)
GOOGLE_PLACES_API_KEY=your-google-places-api-key
OPENAI_API_KEY=your-openai-api-key
```

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

The application will start on **http://localhost:5000** (port is fixed)

### 3. Production Build & Deploy
```bash
npm run build
npm start
```

## API Key Management System

The application supports a flexible two-level API key configuration:

### Server-Level Keys (Optional)
- Set `GOOGLE_PLACES_API_KEY` and `OPENAI_API_KEY` in environment variables
- All users will see these APIs as "configured" and can use them immediately
- Good for hosted deployments where you want to provide API access to all users
- System keys are used as fallback when users don't provide their own

### User-Level Keys (Recommended)
- Individual users can add their own API keys through the Account Portal
- **User keys take priority over server keys**
- Users can manage their keys independently in the application
- Provides better privacy and individual usage control
- Allows users to monitor their own API costs

### No API Keys Configured
- Users will see setup instructions and cannot use search features
- The app provides guided setup instructions for both Google and OpenAI APIs
- Clear cost estimates are shown during setup

## Features

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

## Deployment

### Replit Deployment (Recommended)
1. Fork this repository to Replit
2. Set environment variables in Replit Secrets:
   - `MONGODB_URI` (required)
   - `GOOGLE_PLACES_API_KEY` (optional)
   - `OPENAI_API_KEY` (optional)
3. Run the application - it will automatically install dependencies

### Other Cloud Platforms
- Ensure environment variables are properly set
- MongoDB Atlas should be accessible from your deployment platform
- The application serves on port 5000 (not configurable)
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

## Troubleshooting

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
- "Google Places API key is required" → Configure API keys in Account Portal or environment
- "Authentication required" → User needs to log in or register

## Security Considerations

- **Never commit sensitive data**: API keys and connection strings should only be in environment variables
- **Use strong passwords**: For both user accounts and MongoDB Atlas
- **Rotate credentials regularly**: Change API keys and database passwords periodically
- **Rate limiting**: Consider implementing additional rate limiting for production deployments
- **HTTPS in production**: Always use HTTPS for production deployments
- **IP restrictions**: Configure Google API key restrictions and MongoDB network access appropriately

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

**Note**: This application is designed for business lead generation and research purposes. Please ensure compliance with Google Places API terms of service and applicable data protection regulations in your jurisdiction.