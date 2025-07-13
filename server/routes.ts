import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertBusinessSchema, 
  searchParamsSchema, 
  importBusinessSchema, 
  type ImportBusiness,
  userSchema,
  loginSchema,
  savedBusinessSchema,
  savedListSchema,
  apiKeysSchema,
  stateSearchParamsSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import OpenAI from "openai";
import { 
  connectToMongoDB, 
  createUser, 
  loginUser, 
  getSavedBusinesses, 
  saveBusiness, 
  updateSavedBusiness, 
  deleteSavedBusiness,
  deleteAllSavedBusinesses,
  importBusinessesForUser,
  getSavedLists,
  createSavedList,
  getSavedListById,
  updateSavedList,
  deleteSavedList,
  addBusinessToList,
  removeBusinessFromList,
  getBusinessesForList,
  saveApiKeys,
  getApiKeys,
  getApiKeysStatus,
  deleteApiKeys,
  generateSearchFingerprint,
  saveCachedSearchResult,
  getCachedSearchResult,
  cleanupExpiredCachedResults
} from './mongodb';
import { authenticate, optionalAuth } from './middleware/auth';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI-powered search term and location generation for job-focused searches
async function generateJobFocusedSearchTerms(jobRole: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a job search expert who understands what types of companies hire specific roles. Generate comprehensive search terms for finding companies that would hire a specific job role. Return ONLY valid JSON in the exact format requested."
        },
        {
          role: "user",
          content: `Generate 12-18 search terms for companies that would likely hire "${jobRole}". Think about:
          - Different company types in that industry
          - Related business sectors
          - Company sizes (startups, agencies, enterprises)
          - Specific niches within the field
          
          For example, if the job role is "web developer", include terms like:
          "software company", "web development agency", "digital marketing agency", "tech startup", "IT consulting", "e-commerce company", "SaaS company", "mobile app development", "custom software development", "digital agency", "marketing technology company", etc.
          
          If the job role is "graphic designer", include terms like:
          "design agency", "marketing agency", "advertising agency", "branding company", "print shop", "digital marketing company", "creative agency", "web design company", etc.
          
          Focus on actual business types, not job titles. Return JSON in this exact format: {"terms": ["term1", "term2", "term3"]}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{"terms": []}');
    console.log("OpenAI generated search terms:", result);
    return result.terms && result.terms.length > 0 ? result.terms : [`${jobRole} company`];
  } catch (error) {
    console.error("Error generating job-focused search terms:", error);
    // Provide intelligent fallback terms based on common job roles
    if (jobRole.toLowerCase().includes('web') || jobRole.toLowerCase().includes('developer') || jobRole.toLowerCase().includes('software')) {
      return [
        "software company",
        "web development agency", 
        "tech startup",
        "digital marketing agency",
        "IT consulting",
        "e-commerce company",
        "SaaS company",
        "mobile app development",
        "custom software development",
        "digital agency",
        "technology company",
        "software development company"
      ];
    }
    return [`${jobRole} company`]; // Final fallback
  }
}

async function getOhioCities(): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a geography expert specializing in Ohio. Return only a JSON array of strings, no other text."
        },
        {
          role: "user",
          content: "Provide a comprehensive list of 30-40 Ohio cities for business searches. Include major cities, mid-size cities, and important suburban areas. Start with the largest cities like Columbus, Cleveland, Cincinnati, Toledo, Akron, Dayton, etc. and include smaller cities that likely have businesses. Format as a JSON array of city names only (no state)."
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{"cities": []}');
    return result.cities || ["Columbus", "Cleveland", "Cincinnati"]; // Fallback
  } catch (error) {
    console.error("Error generating Ohio cities:", error);
    return ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton"]; // Fallback
  }
}

// Dynamic city generation using OpenAI (cached to reduce API calls)
const stateCitiesCache = new Map<string, { cities: string[], timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function getTopCitiesForState(state: string, maxCities: number = 500): Promise<string[]> {
  // Check cache first (24-hour cache to reduce OpenAI API calls)
  const cacheKey = `${state}-${maxCities}`;
  const cached = stateCitiesCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.cities;
  }
  
  try {
    // Generate cities dynamically using OpenAI - now supports up to 500 cities
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a comprehensive geography expert with extensive knowledge of US cities. Return only a JSON object with a 'cities' array containing city names as strings, ordered by population size from largest to smallest."
        },
        {
          role: "user",
          content: `Provide exactly ${maxCities} cities and towns in ${state}, ordered by population size from largest to smallest. Include major metropolitan areas, cities, suburbs, towns, townships, villages, and smaller communities with business activity. Start with the largest cities and work down to smaller towns. Ensure each entry is just the city name without state abbreviation. Return JSON in this exact format: {"cities": ["City1", "City2", "City3"]} with exactly ${maxCities} cities ordered by population from largest to smallest.`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{"cities": []}');
    let cities = result.cities && Array.isArray(result.cities) ? result.cities : [];
    
    // Remove duplicates and trim whitespace
    cities = [...new Set(cities.map(city => city.trim()).filter(city => city.length > 0))].slice(0, maxCities);
    
    // Cache the result
    stateCitiesCache.set(cacheKey, {
      cities,
      timestamp: Date.now()
    });
    
    return cities;
    
  } catch (error) {
    console.error(`Error generating cities for ${state}:`, error);
    
    // Comprehensive fallback cities ordered by population size for better coverage
    const fallbackCities: Record<string, string[]> = {
      "California": ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno", "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Anaheim", "Santa Ana", "Riverside", "Stockton", "Irvine", "Chula Vista", "Fremont", "San Bernardino", "Modesto", "Fontana", "Oxnard", "Moreno Valley", "Huntington Beach", "Glendale", "Santa Clarita", "Garden Grove", "Oceanside", "Rancho Cucamonga", "Santa Rosa", "Ontario", "Lancaster", "Elk Grove", "Corona", "Palmdale", "Salinas", "Pomona", "Hayward", "Escondido", "Sunnyvale", "Torrance", "Orange", "Fullerton", "Pasadena", "Thousand Oaks", "Visalia", "Simi Valley", "Concord", "Roseville", "Vallejo", "Victorville", "Santa Clara", "Berkeley", "El Monte", "Downey", "Costa Mesa", "Inglewood", "Ventura", "West Covina", "Norwalk", "Carlsbad", "Fairfield", "Richmond", "Murrieta", "Burbank", "Antioch", "Daly City", "Temecula", "Santa Maria", "El Cajon", "San Mateo", "Rialto", "Clovis", "Compton", "Jurupa Valley", "Vista", "South Gate", "Mission Viejo", "Vacaville", "Carson", "Hesperia", "Santa Monica", "Westminster", "Redding", "Santa Barbara", "Chico", "Newport Beach", "San Leandro", "San Marcos", "Whittier", "Hawthorne", "Citrus Heights", "Tracy", "Alhambra", "Livermore", "Buena Park", "Lakewood", "Merced", "Hemet", "Chino", "Menifee", "Lake Forest", "Napa", "Redwood City", "Bellflower", "Indio", "Tustin", "Baldwin Park", "Chino Hills", "Mountain View", "Alameda", "Upland", "San Ramon", "Folsom", "Pleasanton", "Union City", "Perris", "Manteca", "Lynwood", "Apple Valley", "San Rafael", "Redlands", "Turlock", "Milpitas", "Redondo Beach", "Rancho Cordova", "Yorba Linda", "Palo Alto", "Davis", "Camarillo", "Walnut Creek", "Pittsburg", "South San Francisco", "Yuba City", "San Clemente", "Laguna Niguel", "Pico Rivera", "Montebello", "Lodi", "Madera", "Santa Cruz", "La Habra", "Encinitas", "Monterey Park", "Tulare", "Cupertino", "Gardena", "National City", "Rocklin", "Petaluma", "Huntington Park", "San Bruno", "Brentwood", "Paramount", "La Mesa", "El Centro", "Watsonville", "Santee", "Saratoga", "Campbell", "Novato", "Hanford", "Delano", "Porterville", "Yucaipa", "Pacifica", "Martinez", "San Pablo", "Holtville", "Lompoc", "El Segundo", "Gilroy", "Diamond Bar", "Brea", "Morgan Hill", "San Dimas", "Azusa", "Duarte", "Cerritos", "Milbrae", "San Carlos", "Arcadia", "La Puente", "Foster City", "Atascadero", "Glendora", "Monrovia", "Los Altos", "Manhattan Beach", "Hermosa Beach", "King City", "Seal Beach", "Placerville", "Paso Robles", "Hollister", "San Juan Capistrano", "Colton", "Grover Beach", "La Verne", "San Jacinto", "Benicia", "Ceres", "Soledad", "Cathedral City", "La Quinta", "Half Moon Bay", "Marina", "Barstow", "San Luis Obispo", "Los Banos", "Selma", "Coalinga", "Ridgecrest", "Tehachapi", "Banning", "Paradise", "Grass Valley", "Rosemead", "Eastvale", "Moraga", "La Mirada", "Villa Park", "Danville", "Brawley", "Rolling Hills Estates", "Nevada City", "Lemon Grove", "Hawaiian Gardens", "Canyon Lake", "Larkspur", "Belmont", "San Anselmo", "Corte Madera", "Mill Valley", "Tiburon", "Sausalito", "Orinda", "Lafayette", "Alamo", "Blackhawk", "Los Altos Hills", "Atherton", "Portola Valley", "Woodside", "Hillsborough", "Burlingame", "Brisbane", "Colma", "Broadmoor"],
      "Texas": ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso", "Arlington", "Corpus Christi", "Plano", "Lubbock", "Laredo", "Irving", "Garland", "Frisco", "McKinney", "Grand Prairie", "Amarillo", "Brownsville", "Pasadena", "Mesquite", "Killeen", "McAllen", "Carrollton", "Midland", "Waco", "Denton", "Abilene", "Beaumont", "Round Rock", "Odessa", "Wichita Falls", "Richardson", "Lewisville", "Tyler", "College Station", "Pearland", "San Angelo", "Allen", "League City", "Sugar Land", "Longview", "Baytown", "Missouri City", "Temple", "Edinburg", "Georgetown", "Pflugerville", "New Braunfels", "The Woodlands", "Cedar Park", "North Richland Hills", "Mansfield", "Rowlett", "Galveston", "Beaumont", "Port Arthur", "Texas City", "Huntsville", "Conroe", "Sherman", "Harlingen", "Victoria", "Bryan", "Pharr", "Mission", "Euless", "Grapevine", "Bedford", "Hurst", "Keller", "Coppell", "Flower Mound", "Duncanville", "DeSoto", "Lancaster", "Cedar Hill", "Wylie", "Rockwall", "Sachse", "Murphy", "Prosper", "Little Elm", "The Colony", "Farmers Branch", "Addison", "University Park", "Highland Park", "Balch Springs", "Seagoville", "Sunnyvale", "Hutchins", "Wilmer", "Glenn Heights", "Ovilla", "Red Oak", "Waxahachie", "Midlothian", "Ennis", "Corsicana", "Athens", "Palestine", "Jacksonville", "Marshall", "Texarkana", "Lufkin", "Nacogdoches", "Huntsville", "Conroe", "Magnolia", "Montgomery", "Willis", "Splendora", "Cleveland", "Liberty", "Dayton", "Crosby", "Humble", "Kingwood", "Atascocita", "Spring", "Tomball", "Cypress", "Katy", "Cinco Ranch", "Fulshear", "Richmond", "Rosenberg", "Stafford", "Bellaire", "West University Place", "Southside Place", "Hunters Creek Village", "Bunker Hill Village", "Piney Point Village", "Hedwig Village", "Spring Valley", "Jersey Village", "Jacinto City", "Galena Park", "South Houston", "Deer Park", "La Porte", "Seabrook", "Kemah", "Webster", "Nassau Bay", "El Lago", "Taylor Lake Village", "Clear Lake Shores", "Shoreacres", "Morgan's Point", "La Marque", "League City", "Friendswood", "Alvin", "Santa Fe", "Dickinson", "Hitchcock", "Bacliff", "San Leon", "Kemah", "Clear Lake City", "Brookside Village", "Hillcrest", "Pearland", "Manvel", "Iowa Colony", "Rosharon", "Angleton", "Lake Jackson", "Clute", "Freeport", "Quintana", "Surfside Beach", "Brazoria", "Sweeny", "West Columbia", "East Columbia", "Danbury", "Alvin", "Liverpool", "Chocolate Bayou", "Oyster Creek"],
      "Florida": ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Hialeah", "Tallahassee", "Fort Lauderdale", "Port St. Lucie", "Cape Coral", "Pembroke Pines", "Hollywood", "Miramar", "Gainesville", "Coral Springs", "Miami Gardens", "Clearwater", "Palm Bay", "West Palm Beach", "Pompano Beach", "Lakeland", "Davie", "Miami Beach", "Sunrise", "Plantation", "Boca Raton", "Deltona", "Largo", "Deerfield Beach", "Boynton Beach", "Lauderhill", "Weston", "Kissimmee", "Homestead", "Delray Beach", "Tamarac", "Daytona Beach", "North Miami", "Wellington", "North Port", "Coconut Creek", "Margate", "Ocala", "Pensacola", "Sanford", "Bradenton", "Palm Beach Gardens", "Pinellas Park", "Sarasota", "Orlando", "Altamonte Springs", "Casselberry", "Winter Park", "Apopka", "Oviedo", "Winter Springs", "Maitland", "Winter Garden", "Windermere", "Oakland", "Clermont", "Minneola", "Groveland", "Mascotte", "Montverde", "Howey-in-the-Hills", "Astatula", "Mount Dora", "Tavares", "Eustis", "Leesburg", "Fruitland Park", "Lady Lake", "The Villages", "Summerfield", "Belleview", "Ocala", "Silver Springs", "Dunnellon", "Crystal River", "Homosassa", "Inverness", "Lecanto", "Beverly Hills", "Citrus Springs", "Hernando", "Brooksville", "Spring Hill", "Weeki Wachee", "Masaryktown", "San Antonio", "Dade City", "Zephyrhills", "Wesley Chapel", "Lutz", "Land O' Lakes", "Odessa", "Trinity", "New Port Richey", "Port Richey", "Hudson", "Bayonet Point", "Holiday", "Tarpon Springs", "Palm Harbor", "Dunedin", "Safety Harbor", "Oldsmar", "Westchase", "Town 'n' Country", "Carrollwood", "Temple Terrace", "Plant City", "Brandon", "Valrico", "Lithia", "Riverview", "Gibsonton", "Apollo Beach", "Ruskin", "Sun City Center", "Wimauma", "Balm", "Durant", "Dover", "Seffner", "Mango", "Thonotosassa", "Dover"],
      "New York": ["New York City", "Buffalo", "Rochester", "Syracuse", "Albany", "Yonkers", "New Rochelle", "Mount Vernon", "Schenectady", "Utica", "White Plains", "Troy", "Niagara Falls", "Binghamton", "Freeport", "Valley Stream", "Long Beach", "Rome", "Watertown", "Ithaca", "Middletown", "Spring Valley", "Newburgh", "Poughkeepsie", "Jamestown", "Elmira", "Tonawanda", "Hempstead", "Levittown", "Hicksville", "Uniondale", "East Meadow", "Baldwin", "Massapequa", "Seaford", "Wantagh", "Bellmore", "Merrick", "Rockville Centre", "Lynbrook", "Malverne", "Glen Cove", "Oyster Bay", "Syosset", "Plainview", "Bethpage", "Farmingdale", "Amityville", "Copiague", "Lindenhurst", "Babylon", "West Babylon", "North Babylon", "Deer Park", "Brentwood", "Bay Shore", "Islip", "Central Islip", "Oakdale", "Bohemia", "Ronkonkoma", "Lake Ronkonkoma", "Holbrook", "Holtsville", "Farmingville", "Selden", "Centereach", "Middle Island", "Ridge", "Yaphank", "Medford", "Patchogue", "Bellport", "Brookhaven", "Shirley", "Mastic", "Moriches", "Eastport", "Speonk", "Remsenburg", "Westhampton", "East Quogue", "Hampton Bays", "Southampton", "Bridgehampton", "Sag Harbor", "East Hampton", "Amagansett", "Montauk", "Greenport", "Southold", "Mattituck", "Cutchogue", "Peconic", "Jamesport", "Aquebogue", "Baiting Hollow", "Calverton", "Manorville", "Eastport", "Center Moriches", "East Moriches", "Mastic Beach", "Shirley", "Mastic", "East Patchogue", "Medford"],
      "Pennsylvania": ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton", "Bethlehem", "Lancaster", "Harrisburg", "Altoona", "York", "State College", "Wilkes-Barre", "Chester", "Norristown", "Camden", "Williamsport", "Johnstown", "Easton", "McKeesport", "Hazleton", "Lebanon", "New Castle", "Washington", "Butler", "Pottstown", "Chambersburg", "Greensburg", "Uniontown", "Oil City", "Franklin", "Meadville", "Titusville", "Corry", "Warren", "Bradford", "Du Bois", "Punxsutawney", "Indiana", "Latrobe", "Jeannette", "Mount Pleasant", "Scottdale", "Connellsville", "Brownsville", "California", "Charleroi", "Monessen", "Belle Vernon", "Donora", "Glassport", "Liberty", "Port Vue", "Elizabeth", "West Elizabeth", "Clairton", "Duquesne", "Homestead", "Munhall", "West Homestead", "Whitaker", "Rankin", "Braddock", "North Braddock", "East Pittsburgh", "Turtle Creek", "Wilmerding", "Wall", "East McKeesport", "Versailles", "White Oak", "North Versailles", "Jefferson Hills", "West Mifflin", "Pleasant Hills", "Baldwin", "Whitehall", "Bethel Park", "Upper St. Clair", "Peters Township", "South Fayette", "Robinson Township", "Moon Township", "Coraopolis", "Sewickley", "Edgeworth", "Leetsdale", "Bell Acres", "Haysville", "Bradford Woods", "Franklin Park", "Marshall Township", "Pine Township", "Richland Township", "McCandless", "Ross Township", "Shaler Township", "Millvale", "Etna", "Sharpsburg", "Aspinwall", "Blawnox", "Fox Chapel", "O'Hara Township", "Indiana Township", "Harmar Township", "Springdale", "Cheswick", "Tarentum", "Brackenridge", "Natrona Heights", "Harrison Township", "Freeport", "Sarver", "Saxonburg", "Butler Township", "Adams Township", "Cranberry Township", "Zelienople", "Harmony", "Evans City", "Callery", "Mars", "Wexford", "Gibsonia", "Allison Park", "Glenshaw", "Hampton Township", "Richland Township"],
      "Illinois": ["Chicago", "Aurora", "Rockford", "Joliet", "Naperville", "Springfield", "Peoria", "Elgin", "Waukegan", "Cicero", "Champaign", "Bloomington", "Arlington Heights", "Evanston", "Decatur", "Schaumburg", "Bolingbrook", "Palatine", "Skokie", "Des Plaines", "Orland Park", "Tinley Park", "Oak Lawn", "Berwyn", "Mount Prospect", "Normal", "Wheaton", "Hoffman Estates", "Oak Park", "Downers Grove", "Elmhurst", "Glenview", "DeKalb", "Lombard", "Belleville", "Moline", "Buffalo Grove", "Bartlett", "Urbana", "Quincy", "Crystal Lake", "Streamwood", "Carol Stream", "Romeoville", "Rock Island", "Calumet City", "Carpentersville", "Wheeling", "Park Ridge", "Addison", "Woodridge"],
      "Ohio": ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Parma", "Canton", "Youngstown", "Lorain", "Hamilton", "Springfield", "Kettering", "Elyria", "Lakewood", "Cuyahoga Falls", "Middletown", "Euclid", "Newark", "Mansfield", "Mentor", "Beavercreek", "Cleveland Heights", "Strongsville", "Dublin", "Fairfield", "Findlay", "Warren", "Lancaster", "Lima", "Huber Heights", "Westerville", "Marion", "Grove City", "Stow", "Delaware", "Brunswick", "Upper Arlington", "Reynoldsburg", "Westlake", "Northbrook", "Gahanna", "Hilliard", "Pickerington", "Mason", "Twinsburg", "Miamisburg", "Whitehall", "New Albany", "Powell", "Worthington", "Grandview Heights", "Bexley", "Minerva Park", "Riverlea", "Marble Cliff", "Valleyview", "Urbancrest", "Lockbourne", "Commercial Point", "Ashville", "South Bloomfield", "Orient", "Mount Sterling", "London", "West Jefferson", "Plain City", "Marysville", "Uniontown", "Richwood", "Magnetic Springs", "Prospect", "Waldo", "Cardington", "Ashley", "Sunbury", "Galena", "Lewis Center", "Shawnee Hills", "Worthington Hills", "Riverlea"]
    };
    
    return fallbackCities[state]?.slice(0, maxCities) || [];
  }
}

async function getExpandedOhioCities(): Promise<string[]> {
  return getTopCitiesForState("Ohio", 80);
}

// Helper functions for comparing businesses
function normalizeDomain(url: string): string {
  try {
    if (!url) return '';
    
    // Extract just the main domain (example.com) for comparison
    const domainMatch = url.toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .match(/([a-z0-9-]+\.[a-z0-9-]+)/i);
    
    return domainMatch ? domainMatch[0] : '';
  } catch {
    return url.toLowerCase();
  }
}

function normalizeName(name: string): string {
  if (!name) return '';
  
  // Remove common business suffixes and lowercase
  return name.toLowerCase()
    .replace(/,?\s+(inc|llc|corporation|corp|co|company|ltd|limited)\.?$/i, '')
    .trim();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize MongoDB connection
  try {
    await connectToMongoDB();
    console.log("MongoDB connection established");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }

  // Google Places API endpoint
  const GOOGLE_PLACES_API_URL = "https://places.googleapis.com/v1/places";
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

  // Helper function to convert miles to meters for Google Places API
  const milesToMeters = (miles: number) => Math.round(miles * 1609.34);

  // API caching to reduce repeated calls
  const geocodeCache = new Map<string, any>();
  const businessDetailsCache = new Map<string, any>();
  
  // Authentication routes
  
  // Register a new user
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = userSchema.parse(req.body);
      
      const result = await createUser(userData);
      
      // Don't send password back to client
      const { user } = result;
      const userWithoutPassword = { ...user };
      
      if ('password' in userWithoutPassword) {
        // @ts-ignore
        delete userWithoutPassword.password;
      }
      
      res.status(201).json({ 
        user: userWithoutPassword, 
        token: result.token 
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error registering user:", error);
      
      if (error.message === "Email already registered") {
        return res.status(409).json({ message: "Email already registered" });
      }
      
      res.status(500).json({ message: "An error occurred while registering user" });
    }
  });
  
  // Login user
  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginData = loginSchema.parse(req.body);
      
      const result = await loginUser(loginData.email, loginData.password);
      
      // Don't send password back to client
      const { user } = result;
      const userWithoutPassword = { ...user };
      
      if ('password' in userWithoutPassword) {
        // @ts-ignore
        delete userWithoutPassword.password;
      }
      
      res.json({ 
        user: userWithoutPassword, 
        token: result.token 
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error logging in:", error);
      
      if (error.message === "User not found" || error.message === "Invalid credentials") {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      res.status(500).json({ message: "An error occurred while logging in" });
    }
  });
  
  // Get current user
  app.get("/api/auth/user", authenticate, async (req, res) => {
    try {
      // User is already authenticated via middleware
      res.json({ 
        userId: req.user!.userId,
        email: req.user!.email
      });
    } catch (error) {
      console.error("Error getting user:", error);
      res.status(500).json({ message: "An error occurred while fetching user" });
    }
  });

  // API Keys Management
  
  // Get user's API keys status
  app.get("/api/auth/api-keys", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const status = await getApiKeysStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Error fetching API keys status:", error);
      res.status(500).json({ message: "An error occurred while fetching API keys status" });
    }
  });

  // Save/Update user's API keys
  app.post("/api/auth/api-keys", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { googlePlacesApiKey, openaiApiKey, mongodbUri } = req.body;
      
      const apiKeys = await saveApiKeys(userId, {
        googlePlacesApiKey: googlePlacesApiKey || undefined,
        openaiApiKey: openaiApiKey || undefined,
        mongodbUri: mongodbUri || undefined
      });
      
      // Don't send actual keys back
      res.json({
        hasGooglePlacesKey: !!(apiKeys?.googlePlacesApiKey),
        hasOpenaiKey: !!(apiKeys?.openaiApiKey),
        hasMongodbUri: !!(apiKeys?.mongodbUri),
        updatedAt: apiKeys.updatedAt
      });
    } catch (error) {
      console.error("Error saving API keys:", error);
      res.status(500).json({ message: "An error occurred while saving API keys" });
    }
  });

  // Delete user's API keys
  app.delete("/api/auth/api-keys", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const deleted = await deleteApiKeys(userId);
      
      if (deleted) {
        res.json({ message: "API keys deleted successfully" });
      } else {
        res.status(404).json({ message: "No API keys found" });
      }
    } catch (error) {
      console.error("Error deleting API keys:", error);
      res.status(500).json({ message: "An error occurred while deleting API keys" });
    }
  });
  
  // User's saved businesses endpoints
  
  // Get user's saved businesses with pagination
  app.get("/api/my/businesses", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 200; // Increased default from 50 to 200
      
      console.log(`API call: /api/my/businesses - User: ${userId}, Page: ${page}, Limit: ${limit}`);
      
      const result = await getSavedBusinesses(userId, page, limit);
      
      console.log(`Returning ${result.businesses.length} businesses out of ${result.total} total for page ${page}`);
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching saved businesses:", error);
      res.status(500).json({ message: "An error occurred while fetching saved businesses" });
    }
  });
  
  // Save a new business to user's list
  app.post("/api/my/businesses", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const businessData = savedBusinessSchema.parse({
        ...req.body,
        userId
      });
      
      const savedBusiness = await saveBusiness(businessData);
      res.status(201).json(savedBusiness);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error saving business:", error);
      res.status(500).json({ message: "An error occurred while saving business" });
    }
  });
  
  // Update a saved business
  app.patch("/api/my/businesses/:id", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const businessId = req.params.id;
      
      // Make sure business belongs to this user
      // Get user's businesses and find the one with matching ID
      const userBusinesses = await getSavedBusinesses(userId);
      const business = userBusinesses.find(b => b._id === businessId);
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      // Check is redundant now since we filtered by userId, but keeping for clarity
      if (business.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to update this business" });
      }
      
      const updates = req.body;
      const updatedBusiness = await updateSavedBusiness(businessId, updates);
      
      res.json(updatedBusiness);
    } catch (error) {
      console.error("Error updating saved business:", error);
      res.status(500).json({ message: "An error occurred while updating business" });
    }
  });
  
  // Delete all saved businesses for a user - using a completely different endpoint to avoid route conflicts
  app.delete("/api/my/clear-all-businesses", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const deletedCount = await deleteAllSavedBusinesses(userId);
      
      res.json({ 
        message: "All saved businesses deleted successfully", 
        count: deletedCount 
      });
    } catch (error) {
      console.error("Error deleting all saved businesses:", error);
      res.status(500).json({ message: "Failed to delete all saved businesses" });
    }
  });
  
  // Delete a saved business
  app.delete("/api/my/businesses/:id", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const businessId = req.params.id;
      
      // Get user's businesses and find the one with matching ID
      const userBusinesses = await getSavedBusinesses(userId);
      const business = userBusinesses.find(b => b._id === businessId);
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      // Check is redundant now since we filtered by userId, but keeping for clarity
      if (business.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to delete this business" });
      }
      
      const deleted = await deleteSavedBusiness(businessId);
      
      if (deleted) {
        res.json({ message: "Business deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete business" });
      }
    } catch (error) {
      console.error("Error deleting saved business:", error);
      res.status(500).json({ message: "An error occurred while deleting business" });
    }
  });
  
  // Import businesses from search results
  app.post("/api/my/businesses/import-from-search", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      
      // Get the businesses from the search results
      const searchBusinesses = await storage.getBusinesses();
      
      // Convert them to saved businesses format
      const businessesToImport = searchBusinesses
        .filter(b => !b.isBadLead) // Skip bad leads
        .map(b => ({
          name: b.name,
          website: b.website || '',
          location: b.location || '',
          distance: b.distance || '',
          isBadLead: false,
          notes: b.notes || '',
          careerLink: b.careerLink || '',
          userId
        }));
      
      if (businessesToImport.length === 0) {
        return res.status(400).json({ message: "No valid businesses to import" });
      }
      
      const result = await importBusinessesForUser(userId, businessesToImport);
      
      res.status(201).json({ 
        message: `Successfully imported ${result.count} businesses`,
        businesses: result.businesses
      });
    } catch (error) {
      console.error("Error importing businesses:", error);
      res.status(500).json({ message: "An error occurred while importing businesses" });
    }
  });
  

  
  // Import businesses from CSV
  app.post("/api/my/businesses/import-from-csv", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { csvData, skipDuplicates = true, replaceDuplicates = false } = req.body;
      
      if (!csvData) {
        return res.status(400).json({ message: "CSV data is required" });
      }
      
      // Parse CSV data
      const csvBusinesses = parseCSV(csvData);
      
      if (csvBusinesses.length === 0) {
        return res.status(400).json({ message: "No valid businesses found in CSV data" });
      }
      
      // Convert to saved businesses format
      const businessesToImport = csvBusinesses.map(b => ({
        ...b,
        userId
      }));
      
      // Get duplicate handling options
      const importOptions = {
        skipDuplicates,
        replaceDuplicates
      };
      
      const result = await importBusinessesForUser(userId, businessesToImport, {
        skipDuplicates,
        replaceDuplicates
      });
      
      res.status(201).json({ 
        message: `Successfully imported ${result.count} businesses from CSV`,
        businesses: result.businesses
      });
    } catch (error) {
      console.error("Error importing businesses from CSV:", error);
      res.status(500).json({ message: "An error occurred while importing businesses from CSV" });
    }
  });

  // Parse CSV data from string format with intelligent column detection
  // Focusing only on company name, website, and address
  function parseCSV(csvContent: string): ImportBusiness[] {
    const lines = csvContent.split('\n');
    
    // Handle various CSV formats - commas, semicolons, or tabs
    let separator = ',';
    if (lines[0].includes(';')) separator = ';';
    else if (lines[0].includes('\t')) separator = '\t';
    
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Intelligent column detection - focusing only on essential columns
    const columnMap = {
      name: -1,
      website: -1,
      location: -1
    };
    
    // Map column names to their index
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase();

      // Company name detection
      if (columnMap.name === -1 && (
          headerLower.includes('company') || 
          headerLower.includes('name') || 
          headerLower.includes('business') ||
          headerLower === 'organization'
        )) {
        columnMap.name = index;
      }
      
      // Website detection
      if (columnMap.website === -1 && (
          headerLower.includes('website') || 
          headerLower.includes('url') || 
          headerLower.includes('site') ||
          headerLower.includes('web')
        )) {
        columnMap.website = index;
      }
      
      // Location detection
      if (columnMap.location === -1 && (
          headerLower.includes('location') || 
          headerLower.includes('address') || 
          headerLower.includes('street') ||
          headerLower.includes('city') ||
          headerLower.includes('state')
        )) {
        columnMap.location = index;
      }
    });
    
    // If name column wasn't found, try to determine it by examining data
    if (columnMap.name === -1) {
      // If we couldn't find a good header, just use the first column as name
      columnMap.name = 0;
      
      // Unless we already identified that column as something else
      if (Object.values(columnMap).includes(0)) {
        // Try to find an unused column
        for (let i = 0; i < headers.length; i++) {
          if (!Object.values(columnMap).includes(i)) {
            columnMap.name = i;
            break;
          }
        }
      }
    }
    
    // If website column wasn't found but we have URLs in the data, find them
    if (columnMap.website === -1) {
      // Look at a sample row to try to identify website column
      for (let i = 1; i < Math.min(5, lines.length); i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
        for (let j = 0; j < values.length; j++) {
          // Skip columns we've already identified
          if (Object.values(columnMap).includes(j)) continue;
          
          // Check if column contains what looks like a URL
          if (values[j].match(/^https?:\/\//i) || values[j].match(/^www\./i) || values[j].match(/\.(com|org|net|io|co)/i)) {
            columnMap.website = j;
            break;
          }
        }
        if (columnMap.website !== -1) break;
      }
    }
    
    // If location column wasn't found, look for text that might contain address patterns
    if (columnMap.location === -1) {
      // Look at sample rows to find address-like patterns
      const addressRegex = /\b\d+\s+\w+\s+(st|street|ave|avenue|blvd|boulevard|rd|road|drive|dr|lane|ln|way)\b/i;
      const cityStateRegex = /\b(columbus|ohio|oh),?\s+\d{5}(-\d{4})?\b/i;
      
      for (let i = 1; i < Math.min(5, lines.length); i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
        for (let j = 0; j < values.length; j++) {
          // Skip columns we've already identified
          if (Object.values(columnMap).includes(j)) continue;
          
          // Check if column contains what looks like an address
          if (addressRegex.test(values[j]) || cityStateRegex.test(values[j])) {
            columnMap.location = j;
            break;
          }
        }
        if (columnMap.location !== -1) break;
      }
    }
    
    console.log("Column mapping:", columnMap);
    console.log("CSV Headers:", headers);
    console.log("Total lines in CSV:", lines.length);
    
    const businesses: ImportBusiness[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
      
      // Only add if we can extract a name (columnMap.name should always be valid)
      if (values[columnMap.name] && values[columnMap.name].trim()) {
        const business: ImportBusiness = {
          name: values[columnMap.name].trim(),
          website: columnMap.website >= 0 ? (values[columnMap.website] || '').trim() : undefined,
          location: columnMap.location >= 0 ? (values[columnMap.location] || '').trim() : undefined,
          isBadLead: false, // Default values for other fields
          notes: '',
          distance: '',
          careerLink: undefined
        };
        
        businesses.push(business);
        
        // Log FYVE specifically to debug
        if (business.name.toLowerCase().includes('fyve')) {
          console.log("Found FYVE Marketing in CSV:", business);
        }
      } else {
        console.log(`Skipped row ${i}: missing name. Values:`, values);
      }
    }
    
    console.log(`Parsed ${businesses.length} businesses from CSV`);
    
    return businesses;
  }

  // State-based search with top 100 cities
  app.post("/api/businesses/search/state", authenticate, async (req, res) => {
    try {
      const stateSearchParams = stateSearchParamsSchema.parse(req.body);
      const { businessType, state, maxCities, maxResults } = stateSearchParams;
      
      // Get user's API keys
      const userId = req.user!.userId;
      const userApiKeys = await getApiKeys(userId);
      
      const googleApiKey = userApiKeys?.googlePlacesApiKey || process.env.GOOGLE_PLACES_API_KEY;
      const openaiApiKey = userApiKeys?.openaiApiKey || process.env.OPENAI_API_KEY;
      
      if (!googleApiKey) {
        return res.status(400).json({ 
          message: "Google Places API key is required. Please set up your API keys in the app settings."
        });
      }
      
      if (!openaiApiKey) {
        return res.status(400).json({ 
          message: "OpenAI API key is required for generating state city lists. Please set up your API keys in the app settings."
        });
      }
      
      // Initialize OpenAI with user's key
      const userOpenai = new OpenAI({ apiKey: openaiApiKey });
      
      // Get top cities for the state
      let cities: string[] = [];
      try {
        const response = await userOpenai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a geography expert. Return only a JSON array of strings, no other text."
            },
            {
              role: "user",
              content: `Provide a comprehensive list of the top ${maxCities} cities in ${state} for business searches. Include major cities, mid-size cities, suburbs, county seats, and regional business centers. Start with the largest cities and include important business areas. Format as a JSON array of city names only (no state abbreviation).`
            }
          ],
          response_format: { type: "json_object" },
        });

        const result = JSON.parse(response.choices[0].message.content || '{"cities": []}');
        cities = result.cities && result.cities.length > 0 ? result.cities.slice(0, maxCities) : [`${state} cities`];
      } catch (error) {
        console.error(`Error generating cities for ${state}:`, error);
        return res.status(500).json({ 
          message: `Failed to generate city list for ${state}. Please check your OpenAI API key.`
        });
      }
      
      // Clear existing search results
      await storage.clearAllBusinesses();
      
      const businesses = [];
      let searchedCities = 0;
      
      for (const city of cities) {
        if (businesses.length >= Number(maxResults)) break;
        
        const textQuery = `${businessType} in ${city}, ${state}`;
        
        try {
          const requestBody = {
            textQuery: textQuery,
            maxResultCount: 3 // Max 3 per city
          };
          
          const placesResponse = await fetch(`${GOOGLE_PLACES_API_URL}:searchText`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': googleApiKey,
              'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.formattedAddress'
            },
            body: JSON.stringify(requestBody)
          });
          const placesData = await placesResponse.json();
          
          if (placesResponse.ok && placesData.places) {
            for (const place of placesData.places) {
              if (businesses.length >= Number(maxResults)) break;
              
              businesses.push({
                name: place.displayName?.text || "Unknown Business",
                website: place.websiteUri || "",
                location: place.formattedAddress || "",
                distance: `${city}, ${state}`,
                isBadLead: false,
                notes: "",
                isDuplicate: false,
                careerLink: place.websiteUri ? `${place.websiteUri.replace(/\/+$/, '')}/careers` : ""
              });
            }
          }
          
          searchedCities++;
          
          // Small delay to respect rate limits
          if (searchedCities % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (cityError) {
          console.error(`Error searching ${city}:`, cityError);
          continue;
        }
      }
      
      // Store results and check for duplicates with user's saved businesses
      const savedBusinesses = await storage.saveBatchBusinesses(businesses);
      
      res.json({
        businesses: savedBusinesses,
        total: savedBusinesses.length,
        searchedCities,
        totalCities: cities.length
      });
      
    } catch (error) {
      console.error("Error in state search:", error);
      res.status(500).json({ message: "An error occurred during state search" });
    }
  });

  // Regular location-based search with intelligent caching
  app.post("/api/businesses/search", optionalAuth, async (req, res) => {
    try {
      const searchParams = searchParamsSchema.parse(req.body);
      const { businessType, location } = searchParams;
      
      // Use fixed values for radius and maxResults since they're not user-configurable
      const radius = "20"; // 20 miles default radius
      const maxResults = "100"; // 100 results default
      
      // Generate search fingerprint for caching
      const searchFingerprint = generateSearchFingerprint({
        businessType,
        location,
        radius: Number(radius),
        maxResults: Number(maxResults)
      });
      
      // Check for cached results first
      console.log(`Checking cache for search fingerprint: ${searchFingerprint}`);
      const cachedResult = await getCachedSearchResult(searchFingerprint);
      
      if (cachedResult) {
        console.log(`Found cached results for ${businessType} in ${location}. Returning ${cachedResult.businesses.length} cached businesses.`);
        
        // Clear existing in-memory storage and load cached results
        await storage.clearAllBusinesses();
        const businessesToStore = cachedResult.businesses.map(b => ({
          name: b.name,
          website: b.website || "",
          location: b.location,
          distance: b.distance,
          isBadLead: b.isBadLead,
          notes: b.notes,
          careerLink: b.careerLink
        }));
        
        const savedBusinesses = await storage.saveBatchBusinesses(businessesToStore);
        
        return res.json({
          businesses: savedBusinesses,
          total: cachedResult.totalResults,
          cached: true,
          cacheAge: Math.round((Date.now() - new Date(cachedResult.createdAt).getTime()) / (1000 * 60)) // Age in minutes
        });
      }
      
      console.log(`No cached results found. Proceeding with fresh API search.`);
      
      // Clear all existing businesses before performing a new search
      await storage.clearAllBusinesses();
      
      // Get API key (user's or system default)
      let googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (req.user?.userId) {
        const userApiKeys = await getApiKeys(req.user.userId);
        googleApiKey = userApiKeys?.googlePlacesApiKey || googleApiKey;
      }
      
      if (!googleApiKey) {
        return res.status(500).json({ 
          message: "Google Places API key is not configured"
        });
      }
      
      const maxResultsNum = Number(maxResults);
      const businesses = [];
      let nextPageToken = null;
      
      // Use Text Search API for all searches - much better coverage and reliability
      const textQuery = `${businessType} in ${location}`;
      console.log(`Searching for: "${textQuery}"`);
        
        do {
          const requestBody = {
            textQuery: textQuery,
            maxResultCount: Math.min(20, maxResultsNum - businesses.length)
          };
          
          if (nextPageToken) {
            requestBody.pageToken = nextPageToken;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          console.log(`Making Google Places API (New) call with query: "${textQuery}"`);
          const placesResponse = await fetch(`${GOOGLE_PLACES_API_URL}:searchText`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': googleApiKey,
              'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.formattedAddress,nextPageToken'
            },
            body: JSON.stringify(requestBody)
          });
          const placesData = await placesResponse.json();
          
          console.log(`Google Places API (New) response status: ${placesResponse.status}`);
          if (placesData.error) {
            console.log(`Google Places API error: ${JSON.stringify(placesData.error)}`);
            return res.status(400).json({ 
              message: "Failed to search businesses",
              details: placesData.error.message || "Unknown Google Places API error"
            });
          }
          
          if (!placesResponse.ok) {
            return res.status(400).json({ 
              message: "Failed to search businesses",
              details: `HTTP ${placesResponse.status}: ${placesResponse.statusText}`
            });
          }
          
          nextPageToken = placesData.nextPageToken || null;
          const pageResults = placesData.places || [];
          
          console.log(`Found ${pageResults.length} places in this page`);
          
          // Process results for new API format
          for (const place of pageResults) {
            businesses.push({
              name: place.displayName?.text || "Unknown Business",
              website: place.websiteUri || '',
              location: place.formattedAddress || '',
              distance: `${radius} mi radius`,
              isBadLead: false,
              notes: '',
              careerLink: place.websiteUri ? `${place.websiteUri.replace(/\/+$/, '')}/careers` : ""
            });
          }
          
        } while (nextPageToken && businesses.length < maxResultsNum);
      
      // Get user's saved businesses if user is logged in
      let userSavedBusinesses: any[] = [];
      if (req.user && req.user.userId) {
        try {
          userSavedBusinesses = await getSavedBusinesses(req.user.userId);
          console.log(`Found ${userSavedBusinesses.length} saved businesses for user ${req.user.userId}`);
        } catch (err) {
          console.error("Error fetching saved businesses for duplicate check:", err);
        }
      }
      
      // Clear ALL previous search results before saving new ones
      await storage.clearAllBusinesses();
      
      // Store the results for later retrieval (this will be the only results in storage)
      const savedBusinesses = await storage.saveBatchBusinesses(businesses);
      
      // For marking duplicates based on user's saved businesses
      if (userSavedBusinesses.length > 0) {
        for (const business of savedBusinesses) {
          const isDuplicate = userSavedBusinesses.some(savedBusiness => {
            // Check website match (normalize domains first)
            if (business.website && savedBusiness.website) {
              const normalizeUrl = (url: string) => {
                return url.toLowerCase()
                  .replace(/^https?:\/\//i, '')
                  .replace(/^www\./i, '')
                  .replace(/\/+$/, '');
              };
              
              const businessDomain = normalizeUrl(business.website);
              const savedDomain = normalizeUrl(savedBusiness.website);
              
              if (businessDomain === savedDomain) return true;
            }
            
            // Check name match (normalize company names)
            if (business.name && savedBusiness.name) {
              const normalizeName = (name: string) => {
                return name.toLowerCase()
                  .replace(/\s*(inc|llc|ltd|corp|corporation)\s*\.?$/i, '')
                  .trim();
              };
              
              const businessName = normalizeName(business.name);
              const savedName = normalizeName(savedBusiness.name);
              
              if (businessName === savedName) return true;
            }
            
            // Check location match (normalize locations)
            if (business.location && savedBusiness.location) {
              const normalizeLocation = (location: string) => {
                return location.toLowerCase()
                  // Remove apartment/suite numbers
                  .replace(/(\s|,)+suite\s+\w+/i, '')
                  .replace(/(\s|,)+ste\.?\s+\w+/i, '')
                  .replace(/(\s|,)+apt\.?\s+\w+/i, '')
                  .replace(/(\s|,)+unit\s+\w+/i, '')
                  .replace(/(\s|,)+#\s*\w+/i, '')
                  // Remove floor indicators
                  .replace(/(\s|,)+floor\s+\w+/i, '')
                  .replace(/(\s|,)+fl\.?\s+\w+/i, '')
                  // Remove room numbers
                  .replace(/(\s|,)+room\s+\w+/i, '')
                  .replace(/(\s|,)+rm\.?\s+\w+/i, '')
                  // Standardize address components
                  .replace(/\bstreet\b/i, 'st')
                  .replace(/\bavenue\b/i, 'ave')
                  .replace(/\bboulevard\b/i, 'blvd')
                  .replace(/\bsuite\b/i, 'ste')
                  .trim();
              };
              
              const businessLocation = normalizeLocation(business.location);
              const savedLocation = normalizeLocation(savedBusiness.location);
              
              // Check if the core address matches
              if (businessLocation === savedLocation) return true;
              
              // Attempt to extract city and state/zip if full match fails
              const extractCityState = (location: string) => {
                // Try to get city, state from address
                const cityStateMatch = location.match(/([^,]+),\s*([^,]+)(?:,\s*([^,]+))?$/);
                if (cityStateMatch) {
                  const city = cityStateMatch[1]?.trim().toLowerCase();
                  const state = cityStateMatch[2]?.trim().toLowerCase();
                  return { city, state };
                }
                return { city: '', state: '' };
              };
              
              const businessAddr = extractCityState(businessLocation);
              const savedAddr = extractCityState(savedLocation);
              
              // If we have both city and state and they match, it's likely the same location
              if (businessAddr.city && businessAddr.state && 
                  businessAddr.city === savedAddr.city && 
                  businessAddr.state === savedAddr.state) {
                return true;
              }
            }
            
            return false;
          });
          
          // Update the business with isDuplicate flag if it's a duplicate
          if (isDuplicate && business.id) {
            await storage.updateBusiness(business.id, { isDuplicate: true });
          }
        }
      } else {
        // Fall back to the regular duplicate check with stored businesses
        await storage.checkForDuplicates(savedBusinesses);
      }
      
      // Get the updated businesses with duplicate flags
      const updatedBusinesses = await storage.getBusinesses();
      const newBusinesses = updatedBusinesses.filter(b => 
        savedBusinesses.some(saved => saved.id === b.id));
      
      // Save results to persistent cache for future searches
      try {
        await saveCachedSearchResult({
          searchFingerprint,
          searchParams: {
            businessType,
            location,
            radius: Number(radius),
            maxResults: Number(maxResults)
          },
          businesses: newBusinesses.map(b => ({
            name: b.name,
            website: b.website || "",
            location: b.location,
            distance: b.distance,
            isBadLead: b.isBadLead,
            notes: b.notes,
            careerLink: b.careerLink
          })),
          totalResults: newBusinesses.length,
          userId: req.user?.userId // Optional user association
        });
        console.log(`Cached search results for fingerprint: ${searchFingerprint}`);
      } catch (cacheError) {
        console.error("Error saving search results to cache:", cacheError);
        // Don't fail the request if caching fails
      }
      
      res.json({
        businesses: newBusinesses,
        total: newBusinesses.length,
        cached: false
      });
      
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error searching businesses:", error);
      res.status(500).json({ message: "An error occurred while searching for businesses" });
    }
  });

  // Generate search suggestions based on current search
  app.post("/api/businesses/suggestions", optionalAuth, async (req, res) => {
    try {
      const { jobRole } = req.body;
      
      if (!jobRole || !jobRole.trim()) {
        return res.status(400).json({ 
          message: "Job role is required for generating suggestions"
        });
      }
      
      // Use user's OpenAI key if available, otherwise use system key
      let openaiToUse = openai;
      if (req.user?.userId) {
        const userApiKeys = await getApiKeys(req.user.userId);
        if (userApiKeys?.openaiApiKey) {
          openaiToUse = new OpenAI({ apiKey: userApiKeys.openaiApiKey });
        }
      }
      
      if (!process.env.OPENAI_API_KEY && (!req.user?.userId || !openaiToUse)) {
        return res.status(400).json({ 
          message: "OpenAI API key is required. Please set up your API keys in Account Portal."
        });
      }

      console.log("Generating search suggestions...");
      
      // Generate job-focused search terms using OpenAI
      const searchTerms = await generateJobFocusedSearchTerms(jobRole);
      console.log(`Generated ${searchTerms.length} search suggestions for "${jobRole}":`, searchTerms);
      
      res.json({ 
        suggestions: searchTerms
      });
      
    } catch (error) {
      console.error("Error generating suggestions:", error);
      res.status(500).json({ 
        message: "Failed to generate suggestions", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Search saved businesses for debugging
  app.get("/api/my/businesses/search", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ message: "Search query required" });
      }
      
      const result = await getSavedBusinesses(userId, 1, 1000); // Get all businesses
      const filteredBusinesses = result.businesses.filter(business => 
        business.name?.toLowerCase().includes(query.toLowerCase()) ||
        business.website?.toLowerCase().includes(query.toLowerCase()) ||
        business.location?.toLowerCase().includes(query.toLowerCase())
      );
      
      console.log(`Search for "${query}": found ${filteredBusinesses.length} matches out of ${result.total} total businesses`);
      
      res.json({ 
        businesses: filteredBusinesses,
        total: filteredBusinesses.length,
        searchQuery: query,
        totalInDatabase: result.total
      });
    } catch (error) {
      console.error("Error searching saved businesses:", error);
      res.status(500).json({ message: "An error occurred while searching businesses" });
    }
  });

  // Debug endpoint to get ALL businesses without pagination
  app.get("/api/my/businesses/all", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      
      // Get all businesses without pagination
      const result = await getSavedBusinesses(userId, 1, 10000); // Very high limit to get all
      
      console.log(`User ${userId} has ${result.total} total businesses`);
      
      // Check for specific companies
      const fyveBusinesses = result.businesses.filter(b => 
        b.name?.toLowerCase().includes('fyve')
      );
      const sixthCityBusinesses = result.businesses.filter(b => 
        b.name?.toLowerCase().includes('6ixth') || b.name?.toLowerCase().includes('sixth')
      );
      
      if (fyveBusinesses.length > 0) {
        console.log('FYVE businesses found:', fyveBusinesses.map(b => ({ name: b.name, _id: b._id })));
      }
      if (sixthCityBusinesses.length > 0) {
        console.log('6IXTH CITY businesses found:', sixthCityBusinesses.map(b => ({ name: b.name, _id: b._id })));
      }
      
      // Check data structure of first few companies
      console.log('Sample business data structure:', result.businesses.slice(0, 2).map(b => ({
        name: b.name,
        _id: b._id,
        userId: b.userId,
        hasAllFields: {
          name: !!b.name,
          website: !!b.website,
          location: !!b.location,
          userId: !!b.userId
        }
      })));
      
      res.json({ 
        businesses: result.businesses.slice(0, 50), // Return first 50 for debugging
        total: result.total,
        fyveFound: fyveBusinesses.length > 0,
        sixthCityFound: sixthCityBusinesses.length > 0,
        fyveBusinesses: fyveBusinesses,
        sixthCityBusinesses: sixthCityBusinesses,
        sampleDataStructure: result.businesses.slice(0, 2)
      });
    } catch (error) {
      console.error("Error getting all saved businesses:", error);
      res.status(500).json({ message: "An error occurred while getting all businesses" });
    }
  });

  // Get available cities for a specific state
  app.post("/api/businesses/state-cities", optionalAuth, async (req, res) => {
    try {
      const { state, maxCities = 500, sortBy = "size" } = req.body;
      
      if (!state) {
        return res.status(400).json({ message: "State is required" });
      }
      
      // Get user's API keys for OpenAI (needed for city generation) or use system keys
      let openaiApiKey = process.env.OPENAI_API_KEY;
      if (req.user?.userId) {
        const userApiKeys = await getApiKeys(req.user.userId);
        if (userApiKeys?.openaiApiKey) {
          openaiApiKey = userApiKeys.openaiApiKey;
        }
      }
      
      if (!openaiApiKey) {
        return res.status(400).json({ 
          message: "OpenAI API key is required for city generation. Please set up your API keys in the app settings or configure system-wide keys."
        });
      }
      
      // Generate up to 500 cities for selection (users can choose up to 5 for actual search)
      let cities = await getTopCitiesForState(state, maxCities);
      
      // Apply sorting based on request
      if (sortBy === "alphabetical") {
        cities = cities.sort((a, b) => a.localeCompare(b));
      }
      // Default is already by size from OpenAI response
      
      res.json({
        cities,
        state,
        count: cities.length,
        sortBy,
        estimatedCost: {
          perCity: "$0.049",
          total: `$${(Math.min(5, cities.length) * 0.049).toFixed(2)}` // Cost based on max 5 cities selected
        }
      });
    } catch (error) {
      console.error("Error getting state cities:", error);
      res.status(500).json({ 
        message: "Failed to get cities for the specified state. Please check your API key setup." 
      });
    }
  });

  // State-wide business search with intelligent caching
  app.post("/api/businesses/search/state", optionalAuth, async (req, res) => {
    try {
      const { businessType, state, maxCities = 5, selectedCities } = req.body;
      
      if (!businessType || !state) {
        return res.status(400).json({ message: "Business type and state are required" });
      }
      
      // Enforce limits for performance - hard limits
      const limitedMaxCities = Math.min(maxCities, 5); // Maximum 5 cities for optimal performance
      
      // Generate search fingerprint for caching
      const searchFingerprint = generateSearchFingerprint({
        businessType,
        state,
        selectedCities: selectedCities?.slice(0, 5), // Limit to 5 cities for fingerprint
        maxResults: 50 // Standard limit for state searches
      });
      
      // Check for cached results first
      console.log(`Checking cache for search fingerprint: ${searchFingerprint}`);
      const cachedResult = await getCachedSearchResult(searchFingerprint);
      
      if (cachedResult) {
        console.log(`Found cached results for ${businessType} in ${state}. Returning ${cachedResult.businesses.length} cached businesses.`);
        
        // Clear existing in-memory storage and load cached results
        await storage.clearAllBusinesses();
        const businessesToStore = cachedResult.businesses.map(b => ({
          name: b.name,
          website: b.website || "",
          location: b.location,
          distance: b.distance,
          isBadLead: b.isBadLead,
          notes: b.notes,
          careerLink: b.careerLink
        }));
        
        const savedBusinesses = await storage.saveBatchBusinesses(businessesToStore);
        
        return res.json({
          businesses: savedBusinesses,
          total: cachedResult.totalResults,
          searchedCities: cachedResult.searchedCities?.length || 0,
          totalCities: cachedResult.searchedCities?.length || 0,
          cached: true,
          cacheAge: Math.round((Date.now() - new Date(cachedResult.createdAt).getTime()) / (1000 * 60)) // Age in minutes
        });
      }
      
      console.log(`No cached results found. Proceeding with fresh API search.`);
      
      // Get user's API keys or use system keys
      let googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
      let openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (req.user?.userId) {
        const userApiKeys = await getApiKeys(req.user.userId);
        if (userApiKeys?.googlePlacesApiKey) {
          googleApiKey = userApiKeys.googlePlacesApiKey;
        }
        if (userApiKeys?.openaiApiKey) {
          openaiApiKey = userApiKeys.openaiApiKey;
        }
      }
      
      if (!googleApiKey) {
        return res.status(400).json({ 
          message: "Google Places API key is required. Please set up your API keys or configure system-wide keys."
        });
      }
      
      // Use selected cities if provided, otherwise get top cities for the state
      let cities;
      if (selectedCities && selectedCities.length > 0) {
        cities = selectedCities.slice(0, 5); // Limit to 5 cities max
        console.log(`Using ${cities.length} selected cities:`, cities);
      } else {
        // Get top cities for the state (dynamically generated, cached for 24 hours)
        const allCities = await getTopCitiesForState(state, 10); // Generate max 10 cities, use only 5
        if (allCities.length === 0) {
          return res.status(400).json({ 
            message: `Unable to find cities for "${state}". Please try a different state or check your OpenAI API key.`
          });
        }
        cities = allCities.slice(0, limitedMaxCities);
        console.log(`Using ${cities.length} top cities for ${state}:`, cities);
      }
      const businesses: Business[] = [];
      let searchedCities = 0;
      
      // Process cities in batches of 2 to control API usage and stay under 2 minutes
      const BATCH_SIZE = 2;
      const batches = [];
      for (let i = 0; i < cities.length; i += BATCH_SIZE) {
        batches.push(cities.slice(i, i + BATCH_SIZE));
      }
      
      for (const batch of batches) {
        // Process batch with controlled concurrency and staggered requests
        const batchPromises = batch.map(async (city, index) => {
          // Stagger requests within batch to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, index * 300));
          
          try {
            searchedCities++;
            
            // Check geocoding cache first (24-hour cache)
            const cityKey = `${city}, ${state}`.toLowerCase();
            let geocodeData;
            
            if (geocodeCache.has(cityKey)) {
              geocodeData = geocodeCache.get(cityKey);
            } else {
              const geocodeUrl = `${GOOGLE_GEOCODING_API_URL}?address=${encodeURIComponent(`${city}, ${state}`)}&key=${googleApiKey}`;
              const geocodeResponse = await fetch(geocodeUrl);
              geocodeData = await geocodeResponse.json();
              
              // Cache for 24 hours to prevent repeated geocoding calls
              if (geocodeData.status === "OK") {
                geocodeCache.set(cityKey, geocodeData);
                setTimeout(() => geocodeCache.delete(cityKey), 24 * 60 * 60 * 1000);
              }
            }
            
            if (geocodeData.status !== "OK" || !geocodeData.results?.[0]) {
              console.warn(`Failed to geocode ${city}, ${state}`);
              return [];
            }
            
            const { lat, lng } = geocodeData.results[0].geometry.location;
            
            // Check places cache (1-hour cache)
            const placesKey = `${lat},${lng}-${businessType}`.toLowerCase();
            let placesData;
            
            if (businessDetailsCache.has(placesKey)) {
              placesData = businessDetailsCache.get(placesKey);
            } else {
              // Search for businesses using new Places API
              const requestBody = {
                textQuery: `${businessType} in ${city}, ${state}`,
                maxResultCount: 20
              };
              
              const placesResponse = await fetch(`${GOOGLE_PLACES_API_URL}:searchText`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': googleApiKey,
                  'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.formattedAddress'
                },
                body: JSON.stringify(requestBody)
              });
              placesData = await placesResponse.json();
              
              // Cache for 1 hour
              if (placesResponse.ok && placesData.places) {
                businessDetailsCache.set(placesKey, placesData);
                setTimeout(() => businessDetailsCache.delete(placesKey), 60 * 60 * 1000);
              }
            }
            
            const cityBusinesses: Business[] = [];
            
            if (placesData.places && placesData.places.length > 0) {
              // Process all results for this city
              for (const place of placesData.places) {
                const business: Business = {
                  name: place.displayName?.text || "Unknown Business",
                  website: place.websiteUri || "", 
                  location: place.formattedAddress || `${city}, ${state}`,
                  distance: `${city}, ${state}`,
                  isBadLead: false,
                  notes: "",
                  isDuplicate: false,
                  careerLink: place.websiteUri ? `${place.websiteUri.replace(/\/+$/, '')}/careers` : ""
                };
                
                cityBusinesses.push(business);
              }
            }
            
            return cityBusinesses;
            
          } catch (error) {
            console.error(`Error searching ${city}, ${state}:`, error);
            return [];
          }
        });
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(cityBusinesses => {
          businesses.push(...cityBusinesses);
        });
        
        // Rate limiting between batches (ensures completion within 2 minutes)
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      
      // Store results for duplicate detection and export functionality
      // Clear previous search results first
      await storage.clearAllBusinesses();
      
      if (businesses.length > 0) {
        const insertBusinesses = businesses.map(business => ({
          name: business.name,
          website: business.website,
          location: business.location,
          distance: business.distance,
          isBadLead: business.isBadLead,
          notes: business.notes,
          careerLink: business.careerLink
        }));
        
        await storage.saveBatchBusinesses(insertBusinesses);
      }

      // Save results to persistent cache for future searches
      try {
        await saveCachedSearchResult({
          searchFingerprint,
          searchParams: {
            businessType,
            state,
            selectedCities: selectedCities?.slice(0, 5) || cities,
            maxResults: 50
          },
          businesses: businesses.map(b => ({
            name: b.name,
            website: b.website || "",
            location: b.location,
            distance: b.distance,
            isBadLead: b.isBadLead,
            notes: b.notes,
            careerLink: b.careerLink
          })),
          totalResults: businesses.length,
          searchedCities: cities,
          userId: req.user?.userId // Optional user association
        });
        console.log(`Cached search results for fingerprint: ${searchFingerprint}`);
      } catch (error) {
        console.error("Error saving search results to cache:", error);
        // Don't fail the request if caching fails
      }

      res.json({
        businesses: businesses.slice(0, limitedMaxResults),
        total: businesses.length,
        searchedCities,
        totalCities: allCities.length,
        cached: false,
        compliance: {
          maxCitiesLimited: limitedMaxCities,
          originalRequest: { maxCities, maxResults },
          limitReason: "API optimization - limited to 5 cities for performance",
          note: "Results stored for duplicate detection and export functionality"
        }
      });
      
    } catch (error) {
      console.error("Error in state search:", error);
      res.status(500).json({ 
        message: "Failed to perform state search. Please try again." 
      });
    }
  });

  // Get all businesses
  app.get("/api/businesses", async (_req, res) => {
    try {
      const businesses = await storage.getBusinesses();
      res.json(businesses);
    } catch (error) {
      console.error("Error fetching businesses:", error);
      res.status(500).json({ message: "An error occurred while fetching businesses" });
    }
  });

  // Update a business (e.g., mark as bad lead)
  app.patch("/api/businesses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid business ID" });
      }

      const updateData = req.body;
      const updatedBusiness = await storage.updateBusiness(id, updateData);
      
      if (!updatedBusiness) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      res.json(updatedBusiness);
    } catch (error) {
      console.error("Error updating business:", error);
      res.status(500).json({ message: "An error occurred while updating the business" });
    }
  });

  // Compare businesses from CSV with existing search results
  app.post("/api/businesses/compare", async (req, res) => {
    try {
      const { csvData } = req.body;
      
      if (!csvData) {
        return res.status(400).json({ message: "CSV data is required" });
      }
      
      // Parse CSV data without storing it
      const csvBusinesses = parseCSV(csvData);
      
      if (csvBusinesses.length === 0) {
        return res.status(400).json({ message: "No valid businesses found in CSV data" });
      }
      
      // Get existing businesses (search results)
      const existingBusinesses = await storage.getBusinesses();
      let updatedCount = 0;
      
      // Check each existing business against the CSV list
      for (const existing of existingBusinesses) {
        if (!existing.id) continue;
        
        // Check if this business exists in the CSV data
        const isDuplicate = csvBusinesses.some(csvBusiness => {
          // Compare by domain if website is available
          if (existing.website && csvBusiness.website) {
            const existingDomain = normalizeDomain(existing.website);
            const csvDomain = normalizeDomain(csvBusiness.website);
            if (existingDomain && csvDomain && existingDomain === csvDomain) {
              return true;
            }
          }
          
          // Fall back to company name comparison
          const existingName = normalizeName(existing.name);
          const csvName = normalizeName(csvBusiness.name);
          return existingName && csvName && existingName === csvName;
        });
        
        // Mark as duplicate if found in CSV
        if (isDuplicate) {
          await storage.updateBusiness(existing.id, { isDuplicate: true });
          updatedCount++;
        }
      }
      
      res.json({ 
        message: `Found ${updatedCount} duplicate businesses`,
        count: updatedCount
      });
      
    } catch (error) {
      console.error("Error comparing businesses:", error);
      res.status(500).json({ message: "An error occurred while comparing businesses" });
    }
  });

  // Clear duplicate flags
  app.post("/api/businesses/clear-duplicates", async (_req, res) => {
    try {
      await storage.clearDuplicateFlags();
      res.json({ message: "Duplicate flags cleared successfully" });
    } catch (error) {
      console.error("Error clearing duplicate flags:", error);
      res.status(500).json({ message: "An error occurred while clearing duplicate flags" });
    }
  });
  
  // Clear all business data (completely removes all businesses from storage)
  app.post("/api/businesses/clear-all", async (_req, res) => {
    try {
      await storage.clearAllBusinesses();
      res.json({ message: "All business data cleared successfully" });
    } catch (error) {
      console.error("Error clearing all business data:", error);
      res.status(500).json({ message: "An error occurred while clearing all business data" });
    }
  });

  // Geocode address to get coordinates using Google Maps API with caching
  app.get("/api/geocode", async (req, res) => {
    try {
      const { address } = req.query;
      
      if (!address) {
        return res.status(400).json({ message: "Address parameter is required" });
      }

      if (!API_KEY) {
        return res.status(500).json({ 
          message: "Google Places API key is not configured"
        });
      }

      const addressKey = (address as string).toLowerCase();
      
      // Check cache first to avoid repeated geocoding calls
      if (geocodeCache.has(addressKey)) {
        const cachedResult = geocodeCache.get(addressKey);
        return res.json(cachedResult);
      }

      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address as string)}&key=${API_KEY}`;
      
      const response = await fetch(geocodeUrl);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const result = {
          coordinates: {
            lat: location.lat,
            lng: location.lng
          },
          formatted_address: data.results[0].formatted_address
        };
        
        // Cache the result to avoid repeated API calls
        geocodeCache.set(addressKey, result);
        
        res.json(result);
      } else {
        res.status(404).json({ message: "Address not found" });
      }
    } catch (error) {
      console.error("Error geocoding address:", error);
      res.status(500).json({ message: "Failed to geocode address" });
    }
  });

  // Helper function to calculate distance using Haversine formula
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  const httpServer = createServer(app);
  return httpServer;
}
