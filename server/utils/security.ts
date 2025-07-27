import crypto from 'crypto';

// Security utilities for CompanyHunter application

/**
 * Validates Google Places API key format
 */
export function validateGooglePlacesApiKey(apiKey: string): boolean {
	// Google API keys can vary in format, be more flexible
	// They are typically 35-45 characters but can be longer
	// Allow more characters including dots and other special chars
	if (apiKey.length < 30 || apiKey.length > 50) {
		return false;
	}

	// Basic validation - should not contain whitespace or obvious malicious content
	if (/\s/.test(apiKey) || /<script|javascript:|eval\(/.test(apiKey)) {
		return false;
	}

	return true;
}

/**
 * Validates OpenAI API key format
 */
export function validateOpenAIApiKey(apiKey: string): boolean {
	// OpenAI API keys typically start with 'sk-' but be more flexible
	// Accept keys that start with sk- or other prefixes OpenAI might use
	if (apiKey.length < 20) {
		return false;
	}

	// Basic validation - should not contain whitespace or obvious malicious content
	if (/\s/.test(apiKey) || /<script|javascript:|eval\(/.test(apiKey)) {
		return false;
	}

	return true;
}

/**
 * Validates MongoDB URI format
 */
export function validateMongoDBUri(uri: string): boolean {
	try {
		// Basic MongoDB URI validation - be more flexible
		const mongoUriPattern = /^mongodb(\+srv)?:\/\//;
		if (!mongoUriPattern.test(uri)) {
			return false;
		}

		// Allow localhost connections for development
		// But warn about them in production
		if (
			(uri.includes('localhost') || uri.includes('127.0.0.1')) &&
			process.env.NODE_ENV === 'production'
		) {
			console.warn(
				'Warning: localhost MongoDB URI detected in production'
			);
		}

		// Check for suspicious patterns that could indicate injection attacks
		const suspiciousPatterns = [
			/<script/i,
			/javascript:/i,
			/eval\(/i,
			/expression\(/i,
			/data:text\/html/i,
		];

		if (suspiciousPatterns.some((pattern) => pattern.test(uri))) {
			return false;
		}

		// Basic length check
		if (uri.length < 10 || uri.length > 2000) {
			return false;
		}

		return true;
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
			errors.push(
				`Invalid Google Places API key format. Expected: 30-50 characters without whitespace. Received length: ${sanitizedGoogleKey.length}`
			);
		} else {
			sanitized.googlePlacesApiKey = sanitizedGoogleKey;
		}
	}

	// Validate OpenAI API Key
	if (apiKeys.openaiApiKey) {
		const sanitizedOpenAIKey = sanitizeInput(apiKeys.openaiApiKey);
		if (!validateOpenAIApiKey(sanitizedOpenAIKey)) {
			errors.push(
				`Invalid OpenAI API key format. Expected: at least 20 characters without whitespace. Received length: ${sanitizedOpenAIKey.length}`
			);
		} else {
			sanitized.openaiApiKey = sanitizedOpenAIKey;
		}
	}

	// Validate MongoDB URI
	if (apiKeys.mongodbUri) {
		const sanitizedMongoUri = sanitizeInput(apiKeys.mongodbUri);
		if (!validateMongoDBUri(sanitizedMongoUri)) {
			errors.push(
				`Invalid MongoDB URI format. Expected: mongodb:// or mongodb+srv:// protocol, 10-2000 characters. Received length: ${sanitizedMongoUri.length}`
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
