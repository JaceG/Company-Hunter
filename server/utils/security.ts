import crypto from 'crypto';

// Security utilities for CompanyHunter application

/**
 * Validates Google Places API key format
 */
export function validateGooglePlacesApiKey(apiKey: string): boolean {
	// Google API keys are typically 39 characters long and contain alphanumeric characters, hyphens, and underscores
	const googleApiKeyPattern = /^[A-Za-z0-9_-]{35,45}$/;
	return googleApiKeyPattern.test(apiKey);
}

/**
 * Validates OpenAI API key format
 */
export function validateOpenAIApiKey(apiKey: string): boolean {
	// OpenAI API keys start with 'sk-' followed by alphanumeric characters
	const openaiApiKeyPattern = /^sk-[A-Za-z0-9]{48,}$/;
	return openaiApiKeyPattern.test(apiKey);
}

/**
 * Validates MongoDB URI format
 */
export function validateMongoDBUri(uri: string): boolean {
	try {
		// Basic MongoDB URI validation
		const mongoUriPattern = /^mongodb(\+srv)?:\/\/[^\s]+$/;
		if (!mongoUriPattern.test(uri)) {
			return false;
		}

		// Additional security checks
		if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
			return false; // Don't allow local connections for security
		}

		// Check for suspicious patterns
		const suspiciousPatterns = [
			/javascript:/i,
			/<script/i,
			/eval\(/i,
			/expression\(/i,
		];

		return !suspiciousPatterns.some((pattern) => pattern.test(uri));
	} catch {
		return false;
	}
}

/**
 * Sanitizes user input by removing potentially dangerous content
 */
export function sanitizeInput(input: string): string {
	if (typeof input !== 'string') {
		return '';
	}

	return (
		input
			.trim()
			// Remove null bytes
			.replace(/\x00/g, '')
			// Remove control characters except newline and tab
			.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
			// Limit length to prevent DoS
			.substring(0, 10000)
	);
}

/**
 * Sanitizes search terms for external API calls
 */
export function sanitizeSearchTerm(searchTerm: string): string {
	return (
		sanitizeInput(searchTerm)
			// Remove special characters that could interfere with API calls
			.replace(/[<>\"'%;()&+]/g, '')
			// Normalize whitespace
			.replace(/\s+/g, ' ')
			.trim()
	);
}

/**
 * API Key Encryption utilities
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = crypto.scryptSync(
	process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production',
	'salt',
	32
);

/**
 * Encrypts an API key for storage
 */
export function encryptApiKey(apiKey: string): string {
	try {
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipher(
			ENCRYPTION_ALGORITHM,
			ENCRYPTION_KEY
		);

		let encrypted = cipher.update(apiKey, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		const authTag = cipher.getAuthTag();

		// Combine IV, auth tag, and encrypted data
		return (
			iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
		);
	} catch (error) {
		console.error('Encryption error:', error);
		// Fallback to base64 encoding if encryption fails
		return Buffer.from(apiKey).toString('base64');
	}
}

/**
 * Decrypts an API key from storage
 */
export function decryptApiKey(encryptedApiKey: string): string {
	try {
		const parts = encryptedApiKey.split(':');

		// If it's not in the expected format, assume it's base64 encoded (fallback)
		if (parts.length !== 3) {
			return Buffer.from(encryptedApiKey, 'base64').toString('utf8');
		}

		const [ivHex, authTagHex, encrypted] = parts;
		const iv = Buffer.from(ivHex, 'hex');
		const authTag = Buffer.from(authTagHex, 'hex');

		const decipher = crypto.createDecipher(
			ENCRYPTION_ALGORITHM,
			ENCRYPTION_KEY
		);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encrypted, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		return decrypted;
	} catch (error) {
		console.error('Decryption error:', error);
		// If decryption fails, try base64 decode as fallback
		try {
			return Buffer.from(encryptedApiKey, 'base64').toString('utf8');
		} catch {
			return encryptedApiKey; // Return as-is if all else fails
		}
	}
}

/**
 * Validates and sanitizes API key input
 */
export function validateAndSanitizeApiKeys(apiKeys: {
	googlePlacesApiKey?: string;
	openaiApiKey?: string;
	mongodbUri?: string;
}): {
	isValid: boolean;
	errors: string[];
	sanitized: {
		googlePlacesApiKey?: string;
		openaiApiKey?: string;
		mongodbUri?: string;
	};
} {
	const errors: string[] = [];
	const sanitized: any = {};

	// Validate Google Places API Key
	if (apiKeys.googlePlacesApiKey) {
		const sanitizedGoogleKey = sanitizeInput(apiKeys.googlePlacesApiKey);
		if (!validateGooglePlacesApiKey(sanitizedGoogleKey)) {
			errors.push('Invalid Google Places API key format');
		} else {
			sanitized.googlePlacesApiKey = sanitizedGoogleKey;
		}
	}

	// Validate OpenAI API Key
	if (apiKeys.openaiApiKey) {
		const sanitizedOpenAIKey = sanitizeInput(apiKeys.openaiApiKey);
		if (!validateOpenAIApiKey(sanitizedOpenAIKey)) {
			errors.push('Invalid OpenAI API key format');
		} else {
			sanitized.openaiApiKey = sanitizedOpenAIKey;
		}
	}

	// Validate MongoDB URI
	if (apiKeys.mongodbUri) {
		const sanitizedMongoUri = sanitizeInput(apiKeys.mongodbUri);
		if (!validateMongoDBUri(sanitizedMongoUri)) {
			errors.push(
				'Invalid MongoDB URI format or contains suspicious content'
			);
		} else {
			sanitized.mongodbUri = sanitizedMongoUri;
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		sanitized,
	};
}

/**
 * Rate limiting helper - tracks request counts per IP
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
	ip: string,
	maxRequests: number = 100,
	windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
	const now = Date.now();
	const windowStart = now - windowMs;

	// Clean up old entries
	const keysToDelete: string[] = [];
	requestCounts.forEach((value, key) => {
		if (value.resetTime < windowStart) {
			keysToDelete.push(key);
		}
	});
	keysToDelete.forEach((key) => requestCounts.delete(key));

	const current = requestCounts.get(ip) || {
		count: 0,
		resetTime: now + windowMs,
	};

	if (current.resetTime < now) {
		// Window has expired, reset
		current.count = 1;
		current.resetTime = now + windowMs;
	} else {
		// Within current window
		current.count++;
	}

	requestCounts.set(ip, current);

	return {
		allowed: current.count <= maxRequests,
		remaining: Math.max(0, maxRequests - current.count),
		resetTime: current.resetTime,
	};
}
