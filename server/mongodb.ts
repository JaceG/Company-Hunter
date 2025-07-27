// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, Db, ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
	User,
	UserCreate,
	SavedBusiness,
	SavedList,
	ApiKeys,
	CachedSearchResult,
	DemoSearch,
	GuestResult,
} from '@shared/schema';
import crypto from 'crypto';

// MongoDB connection string - REQUIRED for application to function
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

// JWT Secret configuration with enhanced security
const JWT_SECRET = (() => {
	const envSecret = process.env.JWT_SECRET;
	const defaultSecret = 'business-search-token-secret-2025';

	// In production, require a proper JWT secret
	if (process.env.NODE_ENV === 'production') {
		if (!envSecret || envSecret === defaultSecret) {
			console.error(
				'SECURITY ERROR: JWT_SECRET must be set to a strong, unique value in production!'
			);
			console.error(
				'Generate a secure secret with: openssl rand -base64 32'
			);
			process.exit(1);
		}
		if (envSecret.length < 32) {
			console.error(
				'SECURITY ERROR: JWT_SECRET must be at least 32 characters long in production!'
			);
			process.exit(1);
		}
	}

	return envSecret || defaultSecret;
})();

if (!MONGODB_URI) {
	console.error('MongoDB connection string not found.');
	console.error(
		'Please set MONGODB_URI or DATABASE_URL environment variable.'
	);
	console.error(
		'Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database'
	);
	throw new Error('MongoDB connection string required');
}

// Database and collection names
const DB_NAME = 'businessSearchApp';
const COLLECTIONS = {
	USERS: 'users',
	SAVED_BUSINESSES: 'savedBusinesses',
	SAVED_LISTS: 'savedLists',
	API_KEYS: 'apiKeys',
	CACHED_SEARCHES: 'cachedSearches',
	DEMO_SEARCHES: 'demoSearches',
	GUEST_RESULTS: 'guestResults',
};

// MongoDB connection client
let client: MongoClient | null = null;
let db: Db | null = null;

// Initialize MongoDB connection
export async function connectToMongoDB(): Promise<Db> {
	if (db) return db;

	try {
		client = await MongoClient.connect(MONGODB_URI);
		db = client.db(DB_NAME);
		console.log('Connected to MongoDB Atlas');

		// Create indexes for better performance
		await db
			.collection(COLLECTIONS.USERS)
			.createIndex({ email: 1 }, { unique: true });
		await db
			.collection(COLLECTIONS.SAVED_BUSINESSES)
			.createIndex({ userId: 1 });
		await db.collection(COLLECTIONS.SAVED_LISTS).createIndex({ userId: 1 });
		await db
			.collection(COLLECTIONS.API_KEYS)
			.createIndex({ userId: 1 }, { unique: true });
		await db
			.collection(COLLECTIONS.CACHED_SEARCHES)
			.createIndex({ searchFingerprint: 1 }, { unique: true });
		await db
			.collection(COLLECTIONS.CACHED_SEARCHES)
			.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
		await db
			.collection(COLLECTIONS.DEMO_SEARCHES)
			.createIndex({ guestId: 1 }, { unique: true });
		await db
			.collection(COLLECTIONS.DEMO_SEARCHES)
			.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
		await db
			.collection(COLLECTIONS.GUEST_RESULTS)
			.createIndex(
				{ guestId: 1, searchFingerprint: 1 },
				{ unique: true }
			);
		await db
			.collection(COLLECTIONS.GUEST_RESULTS)
			.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

		return db;
	} catch (error) {
		console.error('MongoDB connection error:', error);
		throw error;
	}
}

// Close MongoDB connection
export async function closeMongoDBConnection() {
	if (client) {
		await client.close();
		console.log('MongoDB connection closed');
		client = null;
		db = null;
	}
}

// User Management Functions
export async function createUser(
	userData: UserCreate
): Promise<{ user: User; token: string }> {
	const database = await connectToMongoDB();
	const usersCollection = database.collection<User>(COLLECTIONS.USERS);

	// Check if user already exists
	const existingUser = await usersCollection.findOne({
		email: userData.email,
	});
	if (existingUser) {
		throw new Error('Email already registered');
	}

	// Hash the password
	const saltRounds = 10;
	const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

	// Create new user
	const newUser: User = {
		email: userData.email,
		password: hashedPassword,
		name: userData.name || '',
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	// Insert user into database
	const result = await usersCollection.insertOne(newUser);

	// Create JWT token
	const token = jwt.sign(
		{ userId: result.insertedId.toString(), email: newUser.email },
		JWT_SECRET,
		{ expiresIn: '7d' }
	);

	// Return user (excluding password) and token
	const { password, ...userWithoutPassword } = newUser;
	return {
		user: {
			...userWithoutPassword,
			_id: result.insertedId.toString(),
		} as User,
		token,
	};
}

export async function loginUser(
	email: string,
	password: string
): Promise<{ user: User; token: string }> {
	const database = await connectToMongoDB();
	const usersCollection = database.collection<User>(COLLECTIONS.USERS);

	// Find user by email
	const user = await usersCollection.findOne({ email });
	if (!user) {
		throw new Error('User not found');
	}

	// Compare passwords
	const isPasswordValid = await bcrypt.compare(password, user.password);
	if (!isPasswordValid) {
		throw new Error('Invalid credentials');
	}

	// Create JWT token
	const token = jwt.sign(
		{ userId: user._id!.toString(), email: user.email },
		JWT_SECRET,
		{ expiresIn: '7d' }
	);

	// Return user (excluding password) and token
	const { password: _, ...userWithoutPassword } = user;
	return { user: userWithoutPassword as User, token };
}

export function verifyToken(token: string): { userId: string; email: string } {
	try {
		return jwt.verify(token, JWT_SECRET) as {
			userId: string;
			email: string;
		};
	} catch (error) {
		throw new Error('Invalid or expired token');
	}
}

// Guest JWT Functions for demo functionality
export function generateGuestToken(): string {
	// Generate a unique guest ID using crypto
	const guestId = crypto.randomUUID();

	// Create JWT token for guest with 24 hour expiration
	const token = jwt.sign(
		{
			guestId,
			isGuest: true,
			// Guests get shorter expiration than registered users
		},
		JWT_SECRET,
		{ expiresIn: '24h' }
	);

	return token;
}

export function verifyGuestToken(token: string): {
	guestId: string;
	isGuest: boolean;
	exp: number;
	iat: number;
} {
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as {
			guestId: string;
			isGuest: boolean;
			exp: number;
			iat: number;
		};

		// Verify it's actually a guest token
		if (!decoded.isGuest || !decoded.guestId) {
			throw new Error('Invalid guest token format');
		}

		return decoded;
	} catch (error) {
		throw new Error('Invalid or expired guest token');
	}
}

// Saved Business Functions
export async function saveBusiness(
	business: SavedBusiness
): Promise<SavedBusiness> {
	const database = await connectToMongoDB();
	const businessCollection = database.collection<SavedBusiness>(
		COLLECTIONS.SAVED_BUSINESSES
	);

	// Add timestamps
	const businessWithTimestamps = {
		...business,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	// Insert business
	const result = await businessCollection.insertOne(businessWithTimestamps);
	return { ...businessWithTimestamps, _id: result.insertedId.toString() };
}

export async function getSavedBusinesses(
	userId: string,
	page: number = 1,
	limit: number = 50,
	searchTerm?: string
): Promise<{
	businesses: SavedBusiness[];
	total: number;
	page: number;
	totalPages: number;
}> {
	const database = await connectToMongoDB();
	const businessCollection = database.collection<SavedBusiness>(
		COLLECTIONS.SAVED_BUSINESSES
	);

	const skip = (page - 1) * limit;

	// Build search filter
	let filter: any = { userId };
	if (searchTerm && searchTerm.trim()) {
		const searchRegex = new RegExp(searchTerm.trim(), 'i');
		filter.$or = [
			{ name: { $regex: searchRegex } },
			{ website: { $regex: searchRegex } },
			{ location: { $regex: searchRegex } },
		];
	}

	// Get total count for pagination with search filter
	const total = await businessCollection.countDocuments(filter);
	const totalPages = Math.ceil(total / limit);

	// Find all businesses for this user with pagination and search
	const businesses = await businessCollection
		.find(filter)
		.sort({ name: 1 })
		.skip(skip)
		.limit(limit)
		.toArray();

	return {
		businesses: businesses.map((b) => ({
			...b,
			_id: b._id!.toString(),
		})),
		total,
		page,
		totalPages,
	};
}

export async function getSavedBusinessById(
	id: string
): Promise<SavedBusiness | null> {
	const database = await connectToMongoDB();
	const businessCollection = database.collection(
		COLLECTIONS.SAVED_BUSINESSES
	);

	try {
		// Find business by ID - converting string ID to MongoDB ObjectId
		const business = (await businessCollection.findOne({
			_id: new ObjectId(id),
		})) as SavedBusiness | null;
		if (!business) return null;

		return {
			...business,
			_id: business._id!.toString(),
		};
	} catch (error) {
		console.error(`Error getting business by ID ${id}:`, error);
		return null;
	}
}

export async function updateSavedBusiness(
	id: string,
	updates: Partial<SavedBusiness>
): Promise<SavedBusiness | null> {
	const database = await connectToMongoDB();
	const businessCollection = database.collection<SavedBusiness>(
		COLLECTIONS.SAVED_BUSINESSES
	);

	// Make sure userId cannot be changed
	const { userId, _id, ...updateData } = updates;

	try {
		// Use type assertion to handle MongoDB typing issues with ObjectId
		const filter = { _id: new ObjectId(id) } as any;

		// Update business
		const result = (await businessCollection.findOneAndUpdate(
			filter,
			{
				$set: {
					...updateData,
					updatedAt: new Date(),
				},
			},
			{ returnDocument: 'after' }
		)) as any;

		if (!result) return null;

		return {
			...result,
			_id: result._id!.toString(),
		};
	} catch (error) {
		console.error(`Error updating business ${id}:`, error);
		return null;
	}
}

export async function deleteSavedBusiness(id: string): Promise<boolean> {
	const database = await connectToMongoDB();
	const businessCollection = database.collection<SavedBusiness>(
		COLLECTIONS.SAVED_BUSINESSES
	);

	try {
		// Delete business
		const result = await businessCollection.deleteOne({
			_id: new ObjectId(id),
		});
		return result.deletedCount > 0;
	} catch (error) {
		console.error(`Error deleting business ${id}:`, error);
		return false;
	}
}

export async function deleteAllSavedBusinesses(
	userId: string
): Promise<number> {
	const database = await connectToMongoDB();
	const businessCollection = database.collection<SavedBusiness>(
		COLLECTIONS.SAVED_BUSINESSES
	);

	try {
		// Delete all businesses for this user
		const result = await businessCollection.deleteMany({ userId });
		return result.deletedCount || 0;
	} catch (error) {
		console.error(
			`Error deleting all businesses for user ${userId}:`,
			error
		);
		return 0;
	}
}

// Saved Lists Functions
export async function createSavedList(list: SavedList): Promise<SavedList> {
	const database = await connectToMongoDB();
	const listCollection = database.collection<SavedList>(
		COLLECTIONS.SAVED_LISTS
	);

	// Add timestamps
	const listWithTimestamps = {
		...list,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	// Insert list
	const result = await listCollection.insertOne(listWithTimestamps);
	return { ...listWithTimestamps, _id: result.insertedId.toString() };
}

export async function getSavedLists(userId: string): Promise<SavedList[]> {
	const database = await connectToMongoDB();
	const listCollection = database.collection<SavedList>(
		COLLECTIONS.SAVED_LISTS
	);

	// Find all lists for this user
	const lists = await listCollection.find({ userId }).toArray();
	return lists.map((l) => ({
		...l,
		_id: l._id!.toString(),
	}));
}

export async function getSavedListById(id: string): Promise<SavedList | null> {
	const database = await connectToMongoDB();
	const listCollection = database.collection<SavedList>(
		COLLECTIONS.SAVED_LISTS
	);

	try {
		// Find list by ID
		const list = await listCollection.findOne({ _id: new ObjectId(id) });
		if (!list) return null;

		return {
			...list,
			_id: list._id!.toString(),
		};
	} catch (error) {
		console.error(`Error getting list by ID ${id}:`, error);
		return null;
	}
}

export async function updateSavedList(
	id: string,
	updates: Partial<SavedList>
): Promise<SavedList | null> {
	const database = await connectToMongoDB();
	const listCollection = database.collection<SavedList>(
		COLLECTIONS.SAVED_LISTS
	);

	// Make sure userId cannot be changed
	const { userId, _id, ...updateData } = updates;

	try {
		// Update list
		const result = await listCollection.findOneAndUpdate(
			{ _id: new ObjectId(id) },
			{
				$set: {
					...updateData,
					updatedAt: new Date(),
				},
			},
			{ returnDocument: 'after' }
		);

		if (!result) return null;

		return {
			...result,
			_id: result._id!.toString(),
		};
	} catch (error) {
		console.error(`Error updating list ${id}:`, error);
		return null;
	}
}

export async function deleteSavedList(id: string): Promise<boolean> {
	const database = await connectToMongoDB();
	const listCollection = database.collection<SavedList>(
		COLLECTIONS.SAVED_LISTS
	);

	try {
		// Delete list
		const result = await listCollection.deleteOne({
			_id: new ObjectId(id),
		});
		return result.deletedCount > 0;
	} catch (error) {
		console.error(`Error deleting list ${id}:`, error);
		return false;
	}
}

export async function addBusinessToList(
	listId: string,
	businessId: string
): Promise<SavedList | null> {
	const database = await connectToMongoDB();
	const listCollection = database.collection<SavedList>(
		COLLECTIONS.SAVED_LISTS
	);

	try {
		// Add business to list
		const result = await listCollection.findOneAndUpdate(
			{ _id: new ObjectId(listId) },
			{
				$addToSet: { businesses: businessId },
				$set: { updatedAt: new Date() },
			},
			{ returnDocument: 'after' }
		);

		if (!result) return null;

		return {
			...result,
			_id: result._id!.toString(),
		};
	} catch (error) {
		console.error(
			`Error adding business ${businessId} to list ${listId}:`,
			error
		);
		return null;
	}
}

export async function removeBusinessFromList(
	listId: string,
	businessId: string
): Promise<SavedList | null> {
	const database = await connectToMongoDB();
	const listCollection = database.collection<SavedList>(
		COLLECTIONS.SAVED_LISTS
	);

	try {
		// Remove business from list
		const result = await listCollection.findOneAndUpdate(
			{ _id: new ObjectId(listId) },
			{
				$pull: { businesses: businessId },
				$set: { updatedAt: new Date() },
			},
			{ returnDocument: 'after' }
		);

		if (!result) return null;

		return {
			...result,
			_id: result._id!.toString(),
		};
	} catch (error) {
		console.error(
			`Error removing business ${businessId} from list ${listId}:`,
			error
		);
		return null;
	}
}

// Get businesses for a specific list
export async function getBusinessesForList(
	listId: string
): Promise<SavedBusiness[]> {
	const database = await connectToMongoDB();
	const listCollection = database.collection<SavedList>(
		COLLECTIONS.SAVED_LISTS
	);
	const businessCollection = database.collection<SavedBusiness>(
		COLLECTIONS.SAVED_BUSINESSES
	);

	try {
		// Get the list
		const list = await listCollection.findOne({
			_id: new ObjectId(listId),
		});
		if (!list || !list.businesses || list.businesses.length === 0) {
			return [];
		}

		// Use string IDs instead of ObjectIds since businesses array contains string IDs
		const businesses = await businessCollection
			.find({
				_id: { $in: list.businesses.map((id) => new ObjectId(id)) },
			})
			.toArray();

		return businesses.map((b) => ({
			...b,
			_id: b._id!.toString(),
		}));
	} catch (error) {
		console.error(`Error getting businesses for list ${listId}:`, error);
		return [];
	}
}

// Import businesses from CSV for a specific user
export async function importBusinessesForUser(
	userId: string,
	businesses: Array<
		Omit<SavedBusiness, 'userId' | 'createdAt' | 'updatedAt'>
	>,
	options?: {
		skipDuplicates?: boolean;
		replaceDuplicates?: boolean;
	}
): Promise<{ count: number; businesses: SavedBusiness[] }> {
	const database = await connectToMongoDB();
	const businessCollection = database.collection<SavedBusiness>(
		COLLECTIONS.SAVED_BUSINESSES
	);

	// Default options
	const { skipDuplicates = true, replaceDuplicates = false } = options || {};

	// First, get existing businesses for this user to check for duplicates
	const existingBusinesses = await businessCollection
		.find({ userId })
		.toArray();

	// Check for duplicates by website or name
	const businessesToProcess = businesses.filter((newBusiness) => {
		// If not checking for duplicates, include all
		if (!skipDuplicates) {
			return true;
		}

		// Look for duplicate by website first
		const duplicateByWebsite = existingBusinesses.find((existing) => {
			if (!existing.website || !newBusiness.website) {
				return false;
			}

			// Normalize websites by removing protocol, www, and trailing slashes
			const normalizedExisting = existing.website
				.toLowerCase()
				.replace(/^https?:\/\//i, '')
				.replace(/^www\./i, '')
				.replace(/\/+$/, '');

			const normalizedNew = newBusiness.website
				.toLowerCase()
				.replace(/^https?:\/\//i, '')
				.replace(/^www\./i, '')
				.replace(/\/+$/, '');

			return normalizedExisting === normalizedNew;
		});

		// If found duplicate by website
		if (duplicateByWebsite) {
			// If replacing duplicates, we'll handle it later
			if (replaceDuplicates) {
				return true;
			}
			// Otherwise skip this business
			return false;
		}

		// Look for duplicate by name as fallback with enhanced matching
		const duplicateByName = existingBusinesses.find((existing) => {
			if (!existing.name || !newBusiness.name) {
				return false;
			}

			// Enhanced normalization that's more thorough:
			// 1. Convert to lowercase
			// 2. Remove legal suffixes (Inc, LLC, etc.)
			// 3. Remove special characters including quotes and parentheses
			// 4. Normalize whitespace
			// 5. Replace common abbreviations
			// 6. Remove filler words like "the", "and", etc.
			const normalizeNameEnhanced = (name: string): string => {
				return (
					name
						.toLowerCase()
						// Replace common abbreviations
						.replace(/\b(mktg|mrktg)\b/g, 'marketing')
						.replace(/\b(co|comp)\b/g, 'company')
						.replace(/\b(tech)\b/g, 'technology')
						.replace(/\b(svcs)\b/g, 'services')
						.replace(/\b(intl)\b/g, 'international')
						.replace(/\b(grp)\b/g, 'group')
						// Remove legal entity types and common suffixes
						.replace(
							/\s*(inc|incorporated|llc|ltd|limited|corp|corporation|company|co|group|grp|holdings|partners|agency|associates|solutions|technologies|technology|digital|media|marketing|services|svcs|consultants|consultancy|international|intl|global)\.?\s*$/i,
							''
						)
						// Remove "The" from beginning
						.replace(/^the\s+/i, '')
						// Remove special characters, leaving only alphanumeric and spaces
						.replace(/[^\w\s]/g, '')
						// Normalize whitespace (collapse multiple spaces to single space and trim)
						.replace(/\s+/g, ' ')
						.trim()
				);
			};

			// Apply enhanced normalization
			const normalizedExisting = normalizeNameEnhanced(existing.name);
			const normalizedNew = normalizeNameEnhanced(newBusiness.name);

			// Try exact match first
			if (normalizedExisting === normalizedNew) {
				return true;
			}

			// If names are short (less than 3 words), require exact match
			// Otherwise try additional fuzzy matching techniques
			const wordCountExisting = normalizedExisting.split(' ').length;
			const wordCountNew = normalizedNew.split(' ').length;

			if (wordCountExisting <= 2 && wordCountNew <= 2) {
				return false; // Require exact match for short names
			}

			// For longer names, check if one name contains the other completely
			if (
				normalizedExisting.includes(normalizedNew) ||
				normalizedNew.includes(normalizedExisting)
			) {
				return true;
			}

			// Check if there's significant word overlap for multi-word names
			const wordsExisting = normalizedExisting.split(' ');
			const wordsNew = normalizedNew.split(' ');

			// Count common words
			const commonWords = wordsExisting.filter((word) =>
				wordsNew.includes(word)
			);

			// If at least 2 significant words match and they represent at least 50% of the shorter name's words
			if (
				commonWords.length >= 2 &&
				commonWords.length /
					Math.min(wordsExisting.length, wordsNew.length) >=
					0.5
			) {
				return true;
			}

			return false;
		});

		// If found duplicate by name
		if (duplicateByName) {
			// If replacing duplicates, we'll handle it later
			if (replaceDuplicates) {
				return true;
			}
			// Otherwise skip this business
			return false;
		}

		// No duplicate found, include this business
		return true;
	});

	// Add userId and timestamps to all businesses
	const businessesToInsert = businessesToProcess.map((business) => ({
		...business,
		userId,
		createdAt: new Date(),
		updatedAt: new Date(),
	}));

	// If there are no businesses to insert after filtering
	if (businessesToInsert.length === 0) {
		return {
			count: 0,
			businesses: [],
		};
	}

	// Handle replacing duplicates if needed
	if (replaceDuplicates) {
		// First delete any duplicates
		for (const business of businessesToInsert) {
			if (!business.website && !business.name) continue;

			// Build query to find duplicates
			const query: any = { userId };

			if (business.website) {
				// Normalize website for search
				const normalizedWebsite = business.website
					.toLowerCase()
					.replace(/^https?:\/\//i, '')
					.replace(/^www\./i, '')
					.replace(/\/+$/, '');

				query.website = {
					$regex: new RegExp(
						`^(https?:\/\/)?(www\\.)?${normalizedWebsite.replace(
							/[-\/\\^$*+?.()|[\]{}]/g,
							'\\$&'
						)}\\/?$`,
						'i'
					),
				};
			} else if (business.name) {
				// Normalize name for search
				const normalizedName = business.name
					.toLowerCase()
					.replace(/\s*(inc|llc|ltd|corp|corporation)\s*\.?$/i, '');

				query.name = {
					$regex: new RegExp(
						`^${normalizedName.replace(
							/[-\/\\^$*+?.()|[\]{}]/g,
							'\\$&'
						)}(\\s*(inc|llc|ltd|corp|corporation)\\s*\\.?)?$`,
						'i'
					),
				};
			}

			// Delete duplicates
			await businessCollection.deleteMany(query);
		}
	}

	// Insert all businesses
	const result = await businessCollection.insertMany(businessesToInsert);

	// Get the inserted businesses with IDs
	const insertedObjectIds = Object.values(result.insertedIds);

	const insertedBusinesses = await businessCollection
		.find({ _id: { $in: insertedObjectIds } })
		.toArray();

	return {
		count: insertedBusinesses.length,
		businesses: insertedBusinesses.map((b) => ({
			...b,
			_id: b._id!.toString(),
		})),
	};
}

// API Keys Management Functions
export async function saveApiKeys(
	userId: string,
	apiKeys: Partial<
		Pick<ApiKeys, 'googlePlacesApiKey' | 'openaiApiKey' | 'mongodbUri'>
	>
): Promise<ApiKeys> {
	const database = await connectToMongoDB();
	const apiKeysCollection = database.collection<ApiKeys>(
		COLLECTIONS.API_KEYS
	);

	// Prepare update data (excluding createdAt since it should only be set on insert)
	const updateData = {
		userId,
		googlePlacesApiKey: apiKeys.googlePlacesApiKey,
		openaiApiKey: apiKeys.openaiApiKey,
		mongodbUri: apiKeys.mongodbUri,
		updatedAt: new Date(),
	};

	// Upsert - update if exists, create if doesn't
	const result = await apiKeysCollection.findOneAndUpdate(
		{ userId },
		{
			$set: updateData,
			$setOnInsert: {
				createdAt: new Date(),
			},
		},
		{
			upsert: true,
			returnDocument: 'after',
		}
	);

	return {
		...result!,
		_id: result!._id!.toString(),
	};
}

export async function getApiKeys(userId: string): Promise<ApiKeys | null> {
	const database = await connectToMongoDB();
	const apiKeysCollection = database.collection<ApiKeys>(
		COLLECTIONS.API_KEYS
	);

	const apiKeys = await apiKeysCollection.findOne({ userId });
	if (!apiKeys) return null;

	return {
		...apiKeys,
		_id: apiKeys._id!.toString(),
	};
}

export async function getApiKeysStatus(userId: string): Promise<{
	hasGooglePlacesKey: boolean;
	hasOpenaiKey: boolean;
	hasMongodbUri: boolean;
	updatedAt?: string;
}> {
	try {
		const userApiKeys = await getApiKeys(userId);

		// Check if API keys are available (user-provided only, no fallbacks)
		const hasGooglePlacesKey = !!userApiKeys?.googlePlacesApiKey;
		const hasOpenaiKey = !!userApiKeys?.openaiApiKey;
		const hasMongodbUri = !!userApiKeys?.mongodbUri;

		return {
			hasGooglePlacesKey,
			hasOpenaiKey,
			hasMongodbUri,
			updatedAt: userApiKeys?.updatedAt?.toISOString(),
		};
	} catch (error) {
		console.error('Error getting API keys status:', error);
		// No fallbacks - all keys must be user-provided
		return {
			hasGooglePlacesKey: false,
			hasOpenaiKey: false,
			hasMongodbUri: false,
		};
	}
}

export async function deleteApiKeys(userId: string): Promise<boolean> {
	const database = await connectToMongoDB();
	const apiKeysCollection = database.collection<ApiKeys>(
		COLLECTIONS.API_KEYS
	);

	try {
		const result = await apiKeysCollection.deleteOne({ userId });
		return result.deletedCount > 0;
	} catch (error) {
		console.error(`Error deleting API keys for user ${userId}:`, error);
		return false;
	}
}

// Search Fingerprinting + Persistent Result Storage functions

// Generate unique fingerprint for search parameters
export function generateSearchFingerprint(params: {
	businessType: string;
	location?: string;
	state?: string;
	selectedCities?: string[];
	radius?: string;
	maxResults?: number;
}): string {
	// Normalize parameters for consistent fingerprinting
	const normalized = {
		businessType: params.businessType.toLowerCase().trim(),
		location: params.location?.toLowerCase().trim(),
		state: params.state?.toLowerCase().trim(),
		selectedCities: params.selectedCities
			?.map((city) => city.toLowerCase().trim())
			.sort(),
		radius: params.radius,
		maxResults: params.maxResults,
	};

	// Create deterministic hash
	const fingerprintData = JSON.stringify(normalized);
	return crypto.createHash('sha256').update(fingerprintData).digest('hex');
}

// Save search results to cache
export async function saveCachedSearchResult(
	searchResult: Omit<CachedSearchResult, '_id'>
): Promise<CachedSearchResult> {
	try {
		const database = await connectToMongoDB();

		// Use upsert to replace existing cache if fingerprint exists
		const result = await database
			.collection(COLLECTIONS.CACHED_SEARCHES)
			.findOneAndUpdate(
				{ searchFingerprint: searchResult.searchFingerprint },
				{
					$set: {
						...searchResult,
						createdAt: new Date(),
						expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hour cache
					},
				},
				{
					upsert: true,
					returnDocument: 'after',
				}
			);

		return result as CachedSearchResult;
	} catch (error) {
		console.error('Error saving cached search result:', error);
		throw error;
	}
}

// Get cached search results by fingerprint
export async function getCachedSearchResult(
	searchFingerprint: string
): Promise<CachedSearchResult | null> {
	try {
		const database = await connectToMongoDB();

		// Find non-expired cached result
		const result = await database
			.collection(COLLECTIONS.CACHED_SEARCHES)
			.findOne({
				searchFingerprint,
				expiresAt: { $gt: new Date() },
			});

		return result as CachedSearchResult | null;
	} catch (error) {
		console.error('Error getting cached search result:', error);
		return null;
	}
}

// Clean up expired cached search results
export async function cleanupExpiredCachedResults(): Promise<number> {
	try {
		const database = await connectToMongoDB();
		const result = await database
			.collection(COLLECTIONS.CACHED_SEARCHES)
			.deleteMany({
				expiresAt: { $lt: new Date() },
			});

		return result.deletedCount || 0;
	} catch (error) {
		console.error('Error cleaning up expired cached results:', error);
		return 0;
	}
}

// Get all cached searches for debugging (admin function)
export async function getAllCachedSearches(
	limit: number = 50
): Promise<CachedSearchResult[]> {
	try {
		const database = await connectToMongoDB();
		const results = await database
			.collection(COLLECTIONS.CACHED_SEARCHES)
			.find({})
			.sort({ createdAt: -1 })
			.limit(limit)
			.toArray();

		return results as CachedSearchResult[];
	} catch (error) {
		console.error('Error getting all cached searches:', error);
		return [];
	}
}

// Guest Demo System Functions

// Demo Search Quota Management
export async function incrementDemoSearchCount(
	guestId: string
): Promise<{ count: number; remaining: number }> {
	const database = await connectToMongoDB();
	const demoSearchesCollection = database.collection<DemoSearch>(
		COLLECTIONS.DEMO_SEARCHES
	);

	const now = new Date();
	const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days from now

	// Upsert the demo search record
	const result = await demoSearchesCollection.findOneAndUpdate(
		{ guestId },
		{
			$inc: { count: 1 },
			$set: { lastSearchAt: now },
			$setOnInsert: {
				firstSearchAt: now,
				createdAt: now,
				expiresAt: expiresAt,
			},
		},
		{
			upsert: true,
			returnDocument: 'after',
		}
	);

	const count = result?.count || 1;
	const remaining = Math.max(0, 20 - count); // 20 search limit

	return { count, remaining };
}

export async function getDemoSearchStatus(
	guestId: string
): Promise<{ count: number; remaining: number; canSearch: boolean }> {
	const database = await connectToMongoDB();
	const demoSearchesCollection = database.collection<DemoSearch>(
		COLLECTIONS.DEMO_SEARCHES
	);

	const demoSearch = await demoSearchesCollection.findOne({ guestId });

	if (!demoSearch) {
		return { count: 0, remaining: 20, canSearch: true };
	}

	const count = demoSearch.count;
	const remaining = Math.max(0, 20 - count);
	const canSearch = count < 20;

	return { count, remaining, canSearch };
}

// Guest Results Management
export async function saveGuestResults(
	guestResult: Omit<GuestResult, 'createdAt' | 'expiresAt'>
): Promise<GuestResult> {
	const database = await connectToMongoDB();
	const guestResultsCollection = database.collection<GuestResult>(
		COLLECTIONS.GUEST_RESULTS
	);

	const now = new Date();
	const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days from now

	const newGuestResult: GuestResult = {
		...guestResult,
		createdAt: now,
		expiresAt,
	};

	// Use upsert to avoid duplicates based on guestId and searchFingerprint
	const result = await guestResultsCollection.findOneAndReplace(
		{
			guestId: guestResult.guestId,
			searchFingerprint: guestResult.searchFingerprint,
		},
		newGuestResult,
		{
			upsert: true,
			returnDocument: 'after',
		}
	);

	return result as GuestResult;
}

export async function getGuestResults(
	guestId: string,
	limit: number = 100
): Promise<GuestResult[]> {
	const database = await connectToMongoDB();
	const guestResultsCollection = database.collection<GuestResult>(
		COLLECTIONS.GUEST_RESULTS
	);

	const results = await guestResultsCollection
		.find({ guestId })
		.sort({ createdAt: -1 })
		.limit(limit)
		.toArray();

	return results as GuestResult[];
}

export async function getGuestBusinesses(
	guestId: string
): Promise<SavedBusiness[]> {
	const database = await connectToMongoDB();
	const guestResultsCollection = database.collection<GuestResult>(
		COLLECTIONS.GUEST_RESULTS
	);

	const results = await guestResultsCollection
		.find({ guestId })
		.sort({ createdAt: -1 })
		.toArray();

	// Flatten all businesses from all search results
	const allBusinesses: SavedBusiness[] = [];
	const seenBusinesses = new Set<string>(); // Track duplicates by name+location

	for (const result of results) {
		for (const business of result.businesses) {
			const businessKey = `${business.name}:${business.location}`;
			if (!seenBusinesses.has(businessKey)) {
				seenBusinesses.add(businessKey);
				allBusinesses.push(business);
			}
		}
	}

	return allBusinesses;
}

export async function deleteGuestData(guestId: string): Promise<void> {
	const database = await connectToMongoDB();

	// Delete from both guest collections
	await Promise.all([
		database.collection(COLLECTIONS.DEMO_SEARCHES).deleteMany({ guestId }),
		database.collection(COLLECTIONS.GUEST_RESULTS).deleteMany({ guestId }),
	]);
}

export async function migrateGuestDataToUser(
	guestId: string,
	userId: string
): Promise<void> {
	const database = await connectToMongoDB();

	// Get all guest results
	const guestResults = await getGuestResults(guestId);

	if (guestResults.length === 0) {
		return; // Nothing to migrate
	}

	// Convert guest results to saved businesses for the user
	const savedBusinessesCollection = database.collection<SavedBusiness>(
		COLLECTIONS.SAVED_BUSINESSES
	);

	const businessesToSave: SavedBusiness[] = [];
	const seenBusinesses = new Set<string>();

	for (const result of guestResults) {
		for (const business of result.businesses) {
			const businessKey = `${business.name}:${business.location}`;
			if (!seenBusinesses.has(businessKey)) {
				seenBusinesses.add(businessKey);
				businessesToSave.push({
					...business,
					userId, // Assign to the new user
					createdAt: new Date(),
					updatedAt: new Date(),
				});
			}
		}
	}

	// Bulk insert businesses for the user
	if (businessesToSave.length > 0) {
		await savedBusinessesCollection.insertMany(businessesToSave);
	}

	// Clean up guest data after successful migration
	await deleteGuestData(guestId);
}

// Demo API Keys (Owner's keys for guest searches only)
export function getDemoApiKeys(): {
	googlePlacesApiKey: string;
	openaiApiKey: string;
	mongodbUri: string;
} | null {
	const demoGooglePlacesKey = process.env.DEMO_GOOGLE_PLACES_API_KEY;
	const demoOpenAIKey = process.env.DEMO_OPENAI_API_KEY;
	const demoMongoDbUri = process.env.DEMO_MONGODB_URI;

	// All demo keys must be present for demo mode to work
	if (!demoGooglePlacesKey || !demoOpenAIKey || !demoMongoDbUri) {
		console.warn(
			'Demo API keys not configured - demo mode will be disabled'
		);
		return null;
	}

	return {
		googlePlacesApiKey: demoGooglePlacesKey,
		openaiApiKey: demoOpenAIKey,
		mongodbUri: demoMongoDbUri,
	};
}

export function isDemoModeEnabled(): boolean {
	return getDemoApiKeys() !== null;
}
