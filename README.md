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
# MongoDB Configuration for User Management (Required)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/businessSearchApp?retryWrites=true&w=majority

# Alternative (if using DATABASE_URL instead)
# DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/businessSearchApp

# JWT Secret (Optional - will use default if not provided)
JWT_SECRET=your-custom-jwt-secret-here

# Note: API keys are no longer supported as environment variables
# All users must provide their own Google Places, OpenAI, and MongoDB Atlas keys
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

The application will start on **http://localhost:3000** (port is fixed)

### 3. Production Build & Deploy
```bash
npm run build
npm start
```

## API Key Management System

The application requires users to provide ALL their own API keys with **no fallbacks** to environment variables:

### Required User API Keys
- **Google Places API Key** - Required for all business searches
- **OpenAI API Key** - Required for AI-powered search features  
- **MongoDB Atlas URI** - Required for data storage (users provide their own database)

### No Environment Variable Fallbacks
- The application will **NOT** use any server-level API keys as fallbacks
- All users must configure their own complete set of API keys
- If any required API key is missing, the respective features will not work
- Authentication is required - users must register/login to use any search features

### User-Level Keys (Required)
- All users must provide their own API keys through the Account Portal
- All three API keys are mandatory for the application to function
- Users manage their own API costs and usage limits
- Each user's data is stored in their own MongoDB Atlas database
- Complete privacy and individual usage control

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

**Current Security Status**: ✅ **PRODUCTION READY** - Comprehensive security measures implemented.

### **✅ Security Features Implemented**
- **JWT Authentication**: 7-day tokens with proper verification and strong secret validation
- **Password Security**: bcrypt hashing with 10 salt rounds  
- **Input Validation**: Zod schemas + custom validation for all API endpoints
- **User Data Isolation**: Proper userId-based access control
- **API Key Privacy**: Keys never returned in responses
- **NoSQL Injection Protection**: Proper ObjectId usage
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Security Headers**: Comprehensive helmet.js protection
- **CORS Protection**: Proper origin validation
- **Request Size Limits**: 10MB limit to prevent DoS attacks
- **API Key Validation**: Format validation for Google Places, OpenAI, and MongoDB URIs
- **Input Sanitization**: Comprehensive sanitization of all user inputs
- **API Key Encryption**: AES-256-GCM encryption for stored API keys

### **🔐 Security Middleware Stack**

#### **Rate Limiting**
```typescript
// 100 requests per 15 minutes per IP
app.use('/api/', rateLimiter);
```

#### **Security Headers (Helmet.js)**
```typescript
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: false,
  // ... full CSP configuration
}));
```

#### **CORS Protection**
```typescript
app.use(cors({
  origin: production ? ['https://yourdomain.com'] : ['http://localhost:*'],
  credentials: true
}));
```

#### **Input Validation & Sanitization**
```typescript
// API keys validated for correct format
// Search terms sanitized for external API calls
// MongoDB URIs validated for security patterns
```

### **🔒 API Key Security**

#### **Encryption at Rest**
- **Algorithm**: AES-256-GCM with random IV
- **Key Management**: Derived from ENCRYPTION_KEY environment variable
- **Fallback**: Base64 encoding if encryption fails

#### **Format Validation**
- **Google Places**: 35-45 character alphanumeric pattern
- **OpenAI**: `sk-` prefix with 48+ character suffix
- **MongoDB**: URI pattern validation with suspicious content detection

#### **Storage Security**
- Plain text API keys are immediately encrypted before database storage
- Decryption only occurs during API calls
- Database compromise does not expose usable API keys

### **🛡️ Production Security Checklist**

**✅ COMPLETED:**
- [x] **Security Packages Installed**: helmet, cors, express-rate-limit, express-validator
- [x] **Rate Limiting**: Comprehensive DoS protection
- [x] **Security Headers**: XSS, clickjacking, MIME-type protection
- [x] **CORS Configuration**: Origin validation and preflight handling
- [x] **Input Validation**: API key format validation and sanitization
- [x] **API Key Encryption**: AES-256-GCM encryption at rest
- [x] **JWT Security**: Strong secret validation in production
- [x] **Request Limits**: DoS protection via request size limits

**⚠️ RECOMMENDED FOR PRODUCTION:**
- [ ] **Set Strong Environment Variables**
  ```bash
  JWT_SECRET=generate-strong-random-secret-here  # Required in production
  ENCRYPTION_KEY=generate-encryption-key-here    # For API key encryption
  CLIENT_URL=https://yourdomain.com              # For CORS
  NODE_ENV=production                             # Enables security checks
  ```

- [ ] **MongoDB Security Configuration**
  - Restrict network access to specific IP addresses
  - Use strong database passwords (minimum 16 characters)
  - Enable MongoDB Atlas encryption at rest
  - Configure database user with minimal required permissions

- [ ] **SSL/TLS Configuration**
  - Deploy with HTTPS certificates
  - Configure secure cookie settings
  - Set up HTTP to HTTPS redirects

- [ ] **Monitoring & Logging**
  - Set up security event logging
  - Monitor failed login attempts
  - Track unusual API usage patterns
  - Configure alerts for security events

### **🚨 Current Risk Assessment**

**Overall Risk Level**: **LOW** ✅

**RESOLVED RISKS:**
- ✅ **DoS Attacks**: Rate limiting and request size limits implemented
- ✅ **CSRF Attacks**: CORS properly configured with origin validation
- ✅ **XSS Attacks**: Security headers and CSP implemented
- ✅ **API Key Exposure**: Encryption at rest implemented
- ✅ **Input Injection**: Comprehensive validation and sanitization
- ✅ **Weak Authentication**: JWT secret validation enforced

**REMAINING LOW-LEVEL CONSIDERATIONS:**
- **Social Engineering**: User education on API key security
- **Third-party Dependencies**: Regular security audits (`npm audit`)
- **Database Access**: MongoDB Atlas access controls

### **🧪 Security Testing**

#### **Automated Testing**
```bash
# Check for vulnerabilities
npm audit

# Security linting
npm install --save-dev eslint-plugin-security
```

#### **Manual Security Checks**
- Test rate limiting with burst requests
- Verify CORS with different origins
- Test API key validation with malformed inputs
- Verify encryption/decryption of stored API keys

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

### **Additional Security Best Practices**

- **Never commit sensitive data**: All API keys and connection strings must be in environment variables only
- **Use strong passwords**: For both user accounts and MongoDB Atlas (minimum 12 characters)  
- **Rotate credentials regularly**: Change API keys and database passwords every 90 days
- **Monitor access**: Regularly review MongoDB Atlas access logs and API usage patterns
- **Backup security**: Ensure MongoDB Atlas backups are encrypted and access-controlled
- **Update dependencies**: Run `npm audit` regularly and keep dependencies updated