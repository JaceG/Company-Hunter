# Business Search Application - Setup Guide

## Overview
This application helps users search for businesses using Google Places API and manage their results. It supports multi-user environments with individual API key management and comprehensive business search capabilities.

## Prerequisites
- Node.js 18+ installed
- MongoDB Atlas account (free tier available)
- Google Cloud Platform account for Places API
- OpenAI account for AI features (optional)

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
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Places API
   - Geocoding API
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Restrict the API key to only the APIs you enabled
6. (Optional) Add your domain to HTTP referrer restrictions

### OpenAI API Setup (Optional)
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account and verify your phone number
3. Go to "API Keys" and create a new secret key
4. Note: OpenAI requires a paid account for production usage

## Installation & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Application
```bash
npm run dev
```

The application will start on `http://localhost:5000`

## User API Key Management

The application supports two levels of API key configuration:

### Server-Level Keys (Optional)
- Set `GOOGLE_PLACES_API_KEY` and `OPENAI_API_KEY` in environment variables
- All users will see these as "configured" and can use them immediately
- Good for hosted deployments where you want to provide API access to all users

### User-Level Keys
- Individual users can add their own API keys through the Account Portal
- User keys take priority over server keys
- Users can manage their keys independently
- Good for privacy and individual usage control

### No API Keys
- Users will see setup instructions and cannot use search features until keys are configured
- The app will guide them through the setup process

## Features

### Search Capabilities
- **Single Location Search**: Search businesses in a specific city/location
- **State-wide Search**: Search across top 100 cities in any US state
- **AI Suggestions**: Generate intelligent search terms using OpenAI

### Business Management
- Save businesses to personal lists
- Mark businesses as "bad leads"
- Export results to CSV
- Import businesses from CSV files
- Duplicate detection and cleanup

### Multi-User Support
- User registration and authentication
- Individual API key management
- Personal business lists
- Secure data isolation

## Deployment

### Replit Deployment
1. Fork this repository to Replit
2. Set environment variables in Replit Secrets:
   - `MONGODB_URI`
   - `GOOGLE_PLACES_API_KEY` (optional)
   - `OPENAI_API_KEY` (optional)
3. Run the application

### Other Platforms
- Ensure environment variables are properly set
- MongoDB Atlas should be accessible from your deployment platform
- Consider setting up proper CORS and security headers for production

## Troubleshooting

### MongoDB Connection Issues
- Verify connection string format
- Check database user permissions
- Ensure network access is configured for your IP
- Test connection using MongoDB Compass

### API Key Issues
- Verify API keys are correctly formatted
- Check API quotas and billing in respective platforms
- Ensure APIs are enabled in Google Cloud Console

### Application Issues
- Check server logs for detailed error messages
- Verify all required environment variables are set
- Clear browser cache if experiencing frontend issues

## Support

For technical issues:
1. Check the application logs for error messages
2. Verify your environment variables are correctly set
3. Test your MongoDB connection independently
4. Ensure API keys have proper permissions and quotas

## Security Notes

- Never commit API keys or connection strings to version control
- Use environment variables for all sensitive configuration
- Consider implementing rate limiting for production deployments
- Regularly rotate API keys and database passwords
- Use strong, unique passwords for database users