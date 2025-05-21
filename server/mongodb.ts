import { MongoClient, Db, ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, UserCreate, SavedBusiness, SavedList } from '@shared/schema';

// MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jacegalloway:1313@cluster0.77bcf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET = 'business-search-token-secret-2025';

// Database and collection names
const DB_NAME = 'businessSearchApp';
const COLLECTIONS = {
  USERS: 'users',
  SAVED_BUSINESSES: 'savedBusinesses',
  SAVED_LISTS: 'savedLists'
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
    await db.collection(COLLECTIONS.USERS).createIndex({ email: 1 }, { unique: true });
    await db.collection(COLLECTIONS.SAVED_BUSINESSES).createIndex({ userId: 1 });
    await db.collection(COLLECTIONS.SAVED_LISTS).createIndex({ userId: 1 });
    
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
export async function createUser(userData: UserCreate): Promise<{ user: User; token: string }> {
  const database = await connectToMongoDB();
  const usersCollection = database.collection<User>(COLLECTIONS.USERS);

  // Check if user already exists
  const existingUser = await usersCollection.findOne({ email: userData.email });
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
    updatedAt: new Date()
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
    user: { ...userWithoutPassword, _id: result.insertedId.toString() } as User, 
    token 
  };
}

export async function loginUser(email: string, password: string): Promise<{ user: User; token: string }> {
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
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// Saved Business Functions
export async function saveBusiness(business: SavedBusiness): Promise<SavedBusiness> {
  const database = await connectToMongoDB();
  const businessCollection = database.collection<SavedBusiness>(COLLECTIONS.SAVED_BUSINESSES);

  // Add timestamps
  const businessWithTimestamps = {
    ...business,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Insert business
  const result = await businessCollection.insertOne(businessWithTimestamps);
  return { ...businessWithTimestamps, _id: result.insertedId.toString() };
}

export async function getSavedBusinesses(userId: string): Promise<SavedBusiness[]> {
  const database = await connectToMongoDB();
  const businessCollection = database.collection<SavedBusiness>(COLLECTIONS.SAVED_BUSINESSES);

  // Find all businesses for this user
  const businesses = await businessCollection.find({ userId }).toArray();
  return businesses.map(b => ({
    ...b,
    _id: b._id!.toString()
  }));
}

export async function getSavedBusinessById(id: string): Promise<SavedBusiness | null> {
  const database = await connectToMongoDB();
  const businessCollection = database.collection(COLLECTIONS.SAVED_BUSINESSES);

  try {
    // Find business by ID - converting string ID to MongoDB ObjectId
    const business = await businessCollection.findOne({ 
      _id: new ObjectId(id) 
    }) as SavedBusiness | null;
    if (!business) return null;

    return {
      ...business,
      _id: business._id!.toString()
    };
  } catch (error) {
    console.error(`Error getting business by ID ${id}:`, error);
    return null;
  }
}

export async function updateSavedBusiness(id: string, updates: Partial<SavedBusiness>): Promise<SavedBusiness | null> {
  const database = await connectToMongoDB();
  const businessCollection = database.collection<SavedBusiness>(COLLECTIONS.SAVED_BUSINESSES);

  // Make sure userId cannot be changed
  const { userId, _id, ...updateData } = updates;

  try {
    // Use type assertion to handle MongoDB typing issues with ObjectId
    const filter = { _id: new ObjectId(id) } as any;
    
    // Update business
    const result = await businessCollection.findOneAndUpdate(
      filter,
      { 
        $set: { 
          ...updateData,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    ) as any;

    if (!result) return null;

    return {
      ...result,
      _id: result._id!.toString()
    };
  } catch (error) {
    console.error(`Error updating business ${id}:`, error);
    return null;
  }
}

export async function deleteSavedBusiness(id: string): Promise<boolean> {
  const database = await connectToMongoDB();
  const businessCollection = database.collection<SavedBusiness>(COLLECTIONS.SAVED_BUSINESSES);

  try {
    // Delete business
    const result = await businessCollection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  } catch (error) {
    console.error(`Error deleting business ${id}:`, error);
    return false;
  }
}

// Saved Lists Functions
export async function createSavedList(list: SavedList): Promise<SavedList> {
  const database = await connectToMongoDB();
  const listCollection = database.collection<SavedList>(COLLECTIONS.SAVED_LISTS);

  // Add timestamps
  const listWithTimestamps = {
    ...list,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Insert list
  const result = await listCollection.insertOne(listWithTimestamps);
  return { ...listWithTimestamps, _id: result.insertedId.toString() };
}

export async function getSavedLists(userId: string): Promise<SavedList[]> {
  const database = await connectToMongoDB();
  const listCollection = database.collection<SavedList>(COLLECTIONS.SAVED_LISTS);

  // Find all lists for this user
  const lists = await listCollection.find({ userId }).toArray();
  return lists.map(l => ({
    ...l,
    _id: l._id!.toString()
  }));
}

export async function getSavedListById(id: string): Promise<SavedList | null> {
  const database = await connectToMongoDB();
  const listCollection = database.collection<SavedList>(COLLECTIONS.SAVED_LISTS);

  try {
    // Find list by ID
    const list = await listCollection.findOne({ _id: new ObjectId(id) });
    if (!list) return null;

    return {
      ...list,
      _id: list._id!.toString()
    };
  } catch (error) {
    console.error(`Error getting list by ID ${id}:`, error);
    return null;
  }
}

export async function updateSavedList(id: string, updates: Partial<SavedList>): Promise<SavedList | null> {
  const database = await connectToMongoDB();
  const listCollection = database.collection<SavedList>(COLLECTIONS.SAVED_LISTS);

  // Make sure userId cannot be changed
  const { userId, _id, ...updateData } = updates;

  try {
    // Update list
    const result = await listCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          ...updateData,
          updatedAt: new Date() 
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result) return null;

    return {
      ...result,
      _id: result._id!.toString()
    };
  } catch (error) {
    console.error(`Error updating list ${id}:`, error);
    return null;
  }
}

export async function deleteSavedList(id: string): Promise<boolean> {
  const database = await connectToMongoDB();
  const listCollection = database.collection<SavedList>(COLLECTIONS.SAVED_LISTS);

  try {
    // Delete list
    const result = await listCollection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  } catch (error) {
    console.error(`Error deleting list ${id}:`, error);
    return false;
  }
}

export async function addBusinessToList(listId: string, businessId: string): Promise<SavedList | null> {
  const database = await connectToMongoDB();
  const listCollection = database.collection<SavedList>(COLLECTIONS.SAVED_LISTS);

  try {
    // Add business to list
    const result = await listCollection.findOneAndUpdate(
      { _id: new ObjectId(listId) },
      { 
        $addToSet: { businesses: businessId },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result) return null;

    return {
      ...result,
      _id: result._id!.toString()
    };
  } catch (error) {
    console.error(`Error adding business ${businessId} to list ${listId}:`, error);
    return null;
  }
}

export async function removeBusinessFromList(listId: string, businessId: string): Promise<SavedList | null> {
  const database = await connectToMongoDB();
  const listCollection = database.collection<SavedList>(COLLECTIONS.SAVED_LISTS);

  try {
    // Remove business from list
    const result = await listCollection.findOneAndUpdate(
      { _id: new ObjectId(listId) },
      { 
        $pull: { businesses: businessId },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result) return null;

    return {
      ...result,
      _id: result._id!.toString()
    };
  } catch (error) {
    console.error(`Error removing business ${businessId} from list ${listId}:`, error);
    return null;
  }
}

// Get businesses for a specific list
export async function getBusinessesForList(listId: string): Promise<SavedBusiness[]> {
  const database = await connectToMongoDB();
  const listCollection = database.collection<SavedList>(COLLECTIONS.SAVED_LISTS);
  const businessCollection = database.collection<SavedBusiness>(COLLECTIONS.SAVED_BUSINESSES);

  try {
    // Get the list
    const list = await listCollection.findOne({ _id: new ObjectId(listId) });
    if (!list || !list.businesses || list.businesses.length === 0) {
      return [];
    }

    // Use string IDs instead of ObjectIds since businesses array contains string IDs
    const businesses = await businessCollection.find({ 
      _id: { $in: list.businesses.map(id => new ObjectId(id)) }
    }).toArray();

    return businesses.map(b => ({
      ...b,
      _id: b._id!.toString()
    }));
  } catch (error) {
    console.error(`Error getting businesses for list ${listId}:`, error);
    return [];
  }
}

// Import businesses from CSV for a specific user
export async function importBusinessesForUser(
  userId: string, 
  businesses: Array<Omit<SavedBusiness, 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<{ count: number; businesses: SavedBusiness[] }> {
  const database = await connectToMongoDB();
  const businessCollection = database.collection<SavedBusiness>(COLLECTIONS.SAVED_BUSINESSES);

  // Add userId and timestamps to all businesses
  const businessesToInsert = businesses.map(business => ({
    ...business,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  // Insert all businesses
  const result = await businessCollection.insertMany(businessesToInsert);

  // Get the inserted businesses with IDs
  const insertedIds = Object.values(result.insertedIds).map(id => id.toString());
  const insertedObjectIds = Object.values(result.insertedIds);
  
  const insertedBusinesses = await businessCollection
    .find({ _id: { $in: insertedObjectIds } })
    .toArray();

  return {
    count: insertedBusinesses.length,
    businesses: insertedBusinesses.map(b => ({
      ...b,
      _id: b._id!.toString()
    }))
  };
}