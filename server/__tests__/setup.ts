// Load environment variables for testing
import dotenv from 'dotenv';
dotenv.config();

// Set test-specific environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
	process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
process.env.MONGODB_URI =
	process.env.MONGODB_URI || 'mongodb://localhost:27017/companyhunter-test';
