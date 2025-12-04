
import { Contractor, User, Review, Category, KnowledgeEntry, LocalTradeData, LocalDataContext } from '../types';

// --- Initial Seed Data ---
// This data serves as the initial database state for the application.

const seedUsers: User[] = [
  { id: 'u1', username: 'SarahJenkins', avatarUrl: 'https://i.pravatar.cc/150?u=sarah', bio: 'Renovating my 1920s Victorian home.', savedContractorIds: ['real-1'] },
  { id: 'u2', username: 'DavidMiller', avatarUrl: 'https://i.pravatar.cc/150?u=david', bio: 'Real estate investor.', savedContractorIds: ['real-1', 'real-4'] },
  { id: 'u3', username: 'MichaelChen', avatarUrl: 'https://i.pravatar.cc/150?u=michael', bio: 'First-time homeowner looking for reliable pros.', savedContractorIds: [] },
  { id: 'u4', username: 'EmilyRose', avatarUrl: 'https://i.pravatar.cc/150?u=emily', bio: 'DIY enthusiast but needs help with big jobs.', savedContractorIds: [] },
  { id: 'admin', username: 'admin', avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=000&color=fff', bio: 'System Administrator', savedContractorIds: [], isAdmin: true},
];

const seedContractors: Contractor[] = [
  // --- Northeast ---
  {
    id: 'real-ne-1',
    name: 'Suffolk Construction',
    category: Category.GENERAL,
    location: 'Boston, MA',
    monthlyScore: 95,
    lifetimeScore: 4200,
    avatarUrl: 'https://ui-avatars.com/api/?name=Suffolk&background=B22222&color=fff',
    description: 'Providing general contracting and construction management services across New England.',
    specialties: ['Commercial', 'Construction Management'],
    reviews: [],
    verified: true,
    lat: 42.3601,
    lng: -71.0589,
    claimed: false,
    phone: '(617) 517-4000',
    website: 'suffolk.com'
  },
  {
    id: 'real-ne-2',
    name: 'ABM Industries',
    category: Category.GENERAL,
    location: 'New York, NY',
    monthlyScore: 94,
    lifetimeScore: 5500,
    avatarUrl: 'https://ui-avatars.com/api/?name=ABM&background=000&color=fff',
    description: 'A leading provider of facility solutions in the NYC metro area.',
    specialties: ['Janitorial', 'Engineering', 'Parking'],
    reviews: [],
    verified: true,
    lat: 40.7128,
    lng: -74.0060,
    claimed: false,
    phone: '(212) 297-0200',
    website: 'abm.com'
  },
  {
    id: 'real-ne-3',
    name: 'BrightView Landscapes',
    category: Category.LANDSCAPING,
    location: 'Blue Bell, PA',
    monthlyScore: 92,
    lifetimeScore: 3200,
    avatarUrl: 'https://ui-avatars.com/api/?name=BrightView&background=4CAF50&color=fff',
    description: 'The nation\'s leading landscape design, construction, and maintenance company.',
    specialties: ['Landscape Maintenance', 'Design & Build'],
    reviews: [{ id: 'r6', userId: 'u2', rating: 5, comment: 'Corporate campus looks great.', date: '2023-08-15' }],
    verified: true,
    lat: 40.1476,
    lng: -75.2680,
    claimed: false,
    phone: '(484) 567-7204',
    website: 'brightview.com'
  },
  {
    id: 'real-ne-4',
    name: 'Power Home Remodeling',
    category: Category.GENERAL,
    location: 'Philadelphia, PA',
    monthlyScore: 97,
    lifetimeScore: 4800,
    avatarUrl: 'https://ui-avatars.com/api/?name=Power&background=0047AB&color=fff',
    description: 'The nation\'s largest full-service exterior home remodeler.',
    specialties: ['Windows', 'Siding', 'Roofing'],
    reviews: [{ id: 'r10', userId: 'u1', rating: 5, comment: 'Replaced all our windows perfectly.', date: '2023-09-05' }],
    verified: true,
    lat: 39.9526,
    lng: -75.1652,
    claimed: false,
    phone: '(610) 874-5000',
    website: 'powerhrg.com'
  },
  {
    id: 'real-ne-5',
    name: 'Benjamin Franklin Plumbing',
    category: Category.PLUMBING,
    location: 'Columbia, MD',
    monthlyScore: 92,
    lifetimeScore: 3100,
    avatarUrl: 'https://ui-avatars.com/api/?name=Ben+Franklin&background=00F&color=fff',
    description: 'The Punctual Plumber. Serving the greater DC/Maryland area.',
    specialties: ['Plumbing Repair', 'Water Heaters'],
    reviews: [],
    verified: true,
    lat: 39.1737,
    lng: -76.8476,
    claimed: false,
    phone: '(866) 496-9634',
    website: 'benjaminfranklinplumbing.com'
  },

  // --- South / Southeast ---
  {
    id: 'real-se-1',
    name: 'Baker Roofing Company',
    category: Category.ROOFING,
    location: 'Raleigh, NC',
    monthlyScore: 98,
    lifetimeScore: 4500,
    avatarUrl: 'https://ui-avatars.com/api/?name=Baker+Roofing&background=0D8ABC&color=fff',
    description: 'Specializing in commercial and residential roofing throughout the Southeast.',
    specialties: ['Commercial Roofing', 'Residential Roofing'],
    reviews: [{ id: 'r1', userId: 'u2', rating: 5, comment: 'Flawless commercial roof replacement.', date: '2023-11-15' }],
    verified: true,
    lat: 35.7796,
    lng: -78.6382,
    claimed: false,
    phone: '(919) 828-2975',
    website: 'bakerroofing.com'
  },
  {
    id: 'real-se-2',
    name: 'MasTec',
    category: Category.ELECTRICAL,
    location: 'Coral Gables, FL',
    monthlyScore: 95,
    lifetimeScore: 4600,
    avatarUrl: 'https://ui-avatars.com/api/?name=MasTec&background=8B0000&color=fff',
    description: 'Infrastructure engineering and construction company based in Florida.',
    specialties: ['Communications', 'Clean Energy'],
    reviews: [],
    verified: true,
    lat: 25.7215,
    lng: -80.2684,
    claimed: false,
    phone: '(305) 599-1800',
    website: 'mastec.com'
  },
  {
    id: 'real-se-3',
    name: 'TruGreen',
    category: Category.LANDSCAPING,
    location: 'Memphis, TN',
    monthlyScore: 87,
    lifetimeScore: 4100,
    avatarUrl: 'https://ui-avatars.com/api/?name=TruGreen&background=32CD32&color=fff',
    description: 'America\'s #1 lawn care company.',
    specialties: ['Lawn Care', 'Tree & Shrub'],
    reviews: [],
    verified: true,
    lat: 35.1495,
    lng: -90.0490,
    claimed: false,
    phone: '1-800-464-0171',
    website: 'trugreen.com'
  },
  {
    id: 'real-se-4',
    name: 'Mister Sparky',
    category: Category.ELECTRICAL,
    location: 'Houston, TX',
    monthlyScore: 88,
    lifetimeScore: 1750,
    avatarUrl: 'https://ui-avatars.com/api/?name=Mr+Sparky&background=D32F2F&color=fff',
    description: 'Leading electrician service provider in Texas.',
    specialties: ['Residential Electrical', 'Repairs'],
    reviews: [{ id: 'r8', userId: 'u3', rating: 5, comment: 'Technician was polite and on time.', date: '2023-11-30' }],
    verified: true,
    lat: 29.7604,
    lng: -95.3698,
    claimed: false,
    phone: '(888) 877-2759',
    website: 'mistersparky.com'
  },
  {
    id: 'real-se-5',
    name: 'TDIndustries',
    category: Category.PLUMBING,
    location: 'Dallas, TX',
    monthlyScore: 91,
    lifetimeScore: 2800,
    avatarUrl: 'https://ui-avatars.com/api/?name=TD&background=003366&color=fff',
    description: 'Premier mechanical construction and facility services in Dallas.',
    specialties: ['Mechanical Construction', 'Complex Plumbing'],
    reviews: [],
    verified: true,
    lat: 32.7767,
    lng: -96.7970,
    claimed: false,
    phone: '(972) 888-9500',
    website: 'tdindustries.com'
  },
  {
    id: 'real-se-6',
    name: 'Comfort Systems USA',
    category: Category.GENERAL,
    location: 'Houston, TX',
    monthlyScore: 90,
    lifetimeScore: 2900,
    avatarUrl: 'https://ui-avatars.com/api/?name=Comfort&background=008080&color=fff',
    description: 'Commercial HVAC, mechanical and electrical services.',
    specialties: ['HVAC', 'Mechanical'],
    reviews: [],
    verified: true,
    lat: 29.76,
    lng: -95.37,
    claimed: false,
    phone: '(713) 830-9600',
    website: 'comfortsystemsusa.com'
  },

  // --- Midwest ---
  {
    id: 'real-mw-1',
    name: 'Roto-Rooter Plumbing',
    category: Category.PLUMBING,
    location: 'Cincinnati, OH',
    monthlyScore: 94,
    lifetimeScore: 5100,
    avatarUrl: 'https://ui-avatars.com/api/?name=Roto+Rooter&background=222&color=fff',
    description: 'North America\'s largest plumbing and drain cleaning service.',
    specialties: ['Emergency Plumbing', 'Drain Cleaning'],
    reviews: [{ id: 'r4', userId: 'u1', rating: 5, comment: 'Saved us during a midnight flood.', date: '2024-01-10' }],
    verified: true,
    lat: 39.1031,
    lng: -84.5120,
    claimed: false,
    phone: '1-800-768-6911',
    website: 'rotorooter.com'
  },
  {
    id: 'real-mw-2',
    name: 'Tecta America',
    category: Category.ROOFING,
    location: 'Rosemont, IL',
    monthlyScore: 93,
    lifetimeScore: 3100,
    avatarUrl: 'https://ui-avatars.com/api/?name=Tecta&background=333&color=fff',
    description: 'Commercial roofing contractor serving the Chicago area and beyond.',
    specialties: ['Commercial Roofing', 'Roof Replacement'],
    reviews: [],
    verified: true,
    lat: 41.9868,
    lng: -87.8722,
    claimed: false,
    phone: '(847) 581-3838',
    website: 'tectaamerica.com'
  },
  {
    id: 'real-mw-3',
    name: 'Davey Tree Expert Company',
    category: Category.LANDSCAPING,
    location: 'Kent, OH',
    monthlyScore: 90,
    lifetimeScore: 3400,
    avatarUrl: 'https://ui-avatars.com/api/?name=Davey&background=2E7D32&color=fff',
    description: 'Residential, commercial, and utility tree and landscape services.',
    specialties: ['Tree Services', 'Grounds Management'],
    reviews: [{ id: 'r9', userId: 'u4', rating: 4, comment: 'Removed a dangerous oak tree safely.', date: '2023-10-12' }],
    verified: true,
    lat: 41.1537,
    lng: -81.3579,
    claimed: false,
    phone: '1-800-445-8733',
    website: 'davey.com'
  },

  // --- West ---
  {
    id: 'real-w-1',
    name: 'Rosendin Electric',
    category: Category.ELECTRICAL,
    location: 'San Jose, CA',
    monthlyScore: 96,
    lifetimeScore: 3850,
    avatarUrl: 'https://ui-avatars.com/api/?name=Rosendin&background=FFD700&color=000',
    description: 'One of the largest employee-owned electrical contractors.',
    specialties: ['Commercial Electrical', 'Renewable Energy'],
    reviews: [{ id: 'r3', userId: 'u2', rating: 5, comment: 'Incredible expertise in renewable energy.', date: '2023-12-05' }],
    verified: true,
    lat: 37.3382,
    lng: -121.8863,
    claimed: false,
    phone: '(408) 286-2800',
    website: 'rosendin.com'
  },
  {
    id: 'real-w-2',
    name: 'Helix Electric',
    category: Category.ELECTRICAL,
    location: 'San Diego, CA',
    monthlyScore: 89,
    lifetimeScore: 2100,
    avatarUrl: 'https://ui-avatars.com/api/?name=Helix&background=000080&color=fff',
    description: 'Full-service electrical contractor in Southern California.',
    specialties: ['Design-Build', 'Mission Critical'],
    reviews: [],
    verified: true,
    lat: 32.7157,
    lng: -117.1611,
    claimed: false,
    phone: '(858) 535-0505',
    website: 'helixelectric.com'
  },
  {
    id: 'real-w-3',
    name: 'DPR Construction',
    category: Category.GENERAL,
    location: 'Redwood City, CA',
    monthlyScore: 93,
    lifetimeScore: 3600,
    avatarUrl: 'https://ui-avatars.com/api/?name=DPR&background=D22&color=fff',
    description: 'Forward-thinking general contractor and construction manager.',
    specialties: ['Advanced Tech', 'Life Sciences', 'Healthcare'],
    reviews: [],
    verified: true,
    lat: 37.4852,
    lng: -122.2364,
    claimed: false,
    phone: '(650) 474-1450',
    website: 'dpr.com'
  },
  {
    id: 'real-w-4',
    name: 'McKinstry',
    category: Category.GENERAL,
    location: 'Seattle, WA',
    monthlyScore: 91,
    lifetimeScore: 2900,
    avatarUrl: 'https://ui-avatars.com/api/?name=McKinstry&background=2F4F4F&color=fff',
    description: 'National leader in designing, constructing, operating and maintaining high-performing buildings.',
    specialties: ['Construction', 'Energy', 'Consulting'],
    reviews: [],
    verified: true,
    lat: 47.6062,
    lng: -122.3321,
    claimed: false,
    phone: '(206) 762-3311',
    website: 'mckinstry.com'
  },
  {
    id: 'real-w-5',
    name: 'PCL Construction',
    category: Category.GENERAL,
    location: 'Denver, CO',
    monthlyScore: 92,
    lifetimeScore: 3100,
    avatarUrl: 'https://ui-avatars.com/api/?name=PCL&background=FFC107&color=000',
    description: 'Group of independent construction companies across the United States.',
    specialties: ['Commercial', 'Industrial', 'Civil'],
    reviews: [],
    verified: true,
    lat: 39.7392,
    lng: -104.9903,
    claimed: false,
    phone: '(303) 365-6500',
    website: 'pcl.com'
  },
  {
    id: 'real-w-6',
    name: 'Interstate Roofing',
    category: Category.ROOFING,
    location: 'Portland, OR',
    monthlyScore: 89,
    lifetimeScore: 2400,
    avatarUrl: 'https://ui-avatars.com/api/?name=Interstate&background=607D8B&color=fff',
    description: 'One of the largest roofing contractors in the Western US.',
    specialties: ['Residential Roofing', 'Commercial Roofing'],
    reviews: [],
    verified: true,
    lat: 45.5152,
    lng: -122.6784,
    claimed: false,
    phone: '(503) 684-5611',
    website: 'interstateroofing.com'
  },
  {
    id: 'real-sw-1',
    name: 'Sundt Construction',
    category: Category.GENERAL,
    location: 'Phoenix, AZ',
    monthlyScore: 90,
    lifetimeScore: 3300,
    avatarUrl: 'https://ui-avatars.com/api/?name=Sundt&background=8B4513&color=fff',
    description: 'One of the country\'s largest and most respected general contractors.',
    specialties: ['Transportation', 'Industrial', 'Building'],
    reviews: [],
    verified: true,
    lat: 33.4484,
    lng: -112.0740,
    claimed: false,
    phone: '(480) 293-3000',
    website: 'sundt.com'
  }
];

const DEFAULT_PROMPTS = [
    "Cost to remodel a 5x8 bathroom",
    "Replace asphalt shingle roof",
    "Install EV charger in garage",
    "Fix a leaking kitchen faucet",
    "Landscaping for small backyard"
];

const nationalData: LocalTradeData = {
    permitsRequired: ["Structural changes", "New electrical circuits", "Major plumbing additions"],
    typicalCosts: {
        "Plumbing": { low: 100, high: 250, unit: "USD" },
        "Electrical": { low: 90, high: 200, unit: "USD" },
        "Roofing": { low: 450, high: 800, unit: "USD" }, // per square
        "General Contractor": { low: 10, high: 20, unit: "USD" } // % markup
    },
    climateFactors: ["Varies by region"],
    riskFactors: ["Check for lead paint in homes pre-1978"],
    materialAvailability: ["Generally good availability", "Specialty items may have lead times"],
    contractorRegulations: ["EPA Lead-Safe Certification required for pre-1978 homes"],
    popularProjectTypes: ["Kitchen Remodel", "Bathroom Remodel", "Deck Building"]
};

const txData: LocalTradeData = {
    permitsRequired: ["Varies by municipality (no county-level general permits in unincorporated areas usually)"],
    typicalCosts: {
        "Plumbing": { low: 90, high: 180, unit: "USD" },
        "Electrical": { low: 85, high: 160, unit: "USD" },
        "Roofing": { low: 350, high: 600, unit: "USD" },
        "General Contractor": { low: 15, high: 25, unit: "USD" }
    },
    climateFactors: ["High Heat", "Humidity", "Hurricanes (Gulf Coast)", "Flash Flooding"],
    riskFactors: ["Foundation shifting due to clay soil", "Termites"],
    materialAvailability: ["High availability of concrete and brick"],
    contractorRegulations: ["No state-wide General Contractor license (Local only)", "State Plumbing & Electrical licenses required"],
    popularProjectTypes: ["Foundation Repair", "AC Installation", "Outdoor Kitchens"]
};

const travisCountyData: LocalTradeData = {
    permitsRequired: ["Austin Energy Green Building requirements", "Tree Ordinance permits", "Impervious cover limits"],
    typicalCosts: {
        "Plumbing": { low: 120, high: 220, unit: "USD" },
        "Electrical": { low: 100, high: 180, unit: "USD" },
        "Roofing": { low: 400, high: 700, unit: "USD" },
        "General Contractor": { low: 18, high: 28, unit: "USD" }
    },
    climateFactors: ["Flash Alley flooding zone", "Extreme summer heat"],
    riskFactors: ["Limestone excavation costs", "Oak Wilt protection"],
    materialAvailability: ["Local Limestone", "Xeriscaping plants"],
    contractorRegulations: ["Strict City of Austin inspections", "Wildland-Urban Interface codes"],
    popularProjectTypes: ["Xeriscaping", "Solar Installation", "Accessory Dwelling Units (ADUs)"]
};

const caData: LocalTradeData = {
    permitsRequired: ["Title 24 Energy Standards", "Seismic retrofitting"],
    typicalCosts: {
        "Plumbing": { low: 150, high: 300, unit: "USD" },
        "Electrical": { low: 120, high: 250, unit: "USD" },
        "Roofing": { low: 600, high: 1000, unit: "USD" },
        "General Contractor": { low: 20, high: 30, unit: "USD" }
    },
    climateFactors: ["Seismic activity", "Wildfires", "Coastal salt air"],
    riskFactors: ["Earthquakes", "Landslides"],
    materialAvailability: ["Strict VOC regulations on paints/adhesives"],
    contractorRegulations: ["CSLB License required for jobs over $500", "Strict workers comp laws"],
    popularProjectTypes: ["Seismic Retrofit", "Drought-tolerant Landscaping", "Solar"]
};

const laCountyData: LocalTradeData = {
    permitsRequired: ["LADBS structural observation", "Hillside grading permits"],
    typicalCosts: {
        "Plumbing": { low: 160, high: 320, unit: "USD" },
        "Electrical": { low: 130, high: 260, unit: "USD" },
        "Roofing": { low: 650, high: 1100, unit: "USD" },
        "General Contractor": { low: 20, high: 35, unit: "USD" }
    },
    climateFactors: ["Santa Ana winds", "Urban heat island"],
    riskFactors: ["Liquefaction zones"],
    materialAvailability: ["High cost of lumber"],
    contractorRegulations: ["Local hire initiatives in some zones"],
    popularProjectTypes: ["ADU Conversion", "Pool Building", "Smart Home Tech"]
};


const DB_KEYS = {
  CONTRACTORS: 'localpro_contractors_real_v5_national',
  USERS: 'localpro_users_real_v5',
  PROMPTS: 'localpro_suggested_prompts',
  KNOWLEDGE_BASE: 'localpro_knowledge_base',
  LOCAL_DATA: 'localpro_local_data_store'
};

// --- Initialization ---
export const initDB = () => {
  if (!localStorage.getItem(DB_KEYS.CONTRACTORS)) {
    localStorage.setItem(DB_KEYS.CONTRACTORS, JSON.stringify(seedContractors));
  }
  if (!localStorage.getItem(DB_KEYS.USERS)) {
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(seedUsers));
  }
  if (!localStorage.getItem(DB_KEYS.PROMPTS)) {
    localStorage.setItem(DB_KEYS.PROMPTS, JSON.stringify(DEFAULT_PROMPTS));
  }
  if (!localStorage.getItem(DB_KEYS.KNOWLEDGE_BASE)) {
    localStorage.setItem(DB_KEYS.KNOWLEDGE_BASE, JSON.stringify([]));
  }
  
  // Seed Local Data Hierarchy
  if (!localStorage.getItem(DB_KEYS.LOCAL_DATA)) {
      const initialStore = {
          'national': nationalData,
          'state_TX': txData,
          'county_TX_Travis': travisCountyData,
          'state_CA': caData,
          'county_CA_LosAngeles': laCountyData
      };
      localStorage.setItem(DB_KEYS.LOCAL_DATA, JSON.stringify(initialStore));
  }
};

// --- Getters ---
export const getContractors = (): Contractor[] => {
  const contractorsJSON = localStorage.getItem(DB_KEYS.CONTRACTORS);
  return contractorsJSON ? JSON.parse(contractorsJSON) : [];
};

export const getUsers = (): User[] => {
  const usersJSON = localStorage.getItem(DB_KEYS.USERS);
  return usersJSON ? JSON.parse(usersJSON) : [];
};

export const getSuggestedPrompts = (): string[] => {
    const prompts = localStorage.getItem(DB_KEYS.PROMPTS);
    return prompts ? JSON.parse(prompts) : DEFAULT_PROMPTS;
};

export const getKnowledgeBase = (): KnowledgeEntry[] => {
    const kb = localStorage.getItem(DB_KEYS.KNOWLEDGE_BASE);
    return kb ? JSON.parse(kb) : [];
};

// --- Local Trade Data System ---

export const getLocalTradeData = (scope: 'national' | 'state' | 'county', locationId?: string): LocalTradeData | null => {
    const storeJSON = localStorage.getItem(DB_KEYS.LOCAL_DATA);
    if (!storeJSON) return null;
    const store = JSON.parse(storeJSON);
    
    let key = 'national';
    if (scope === 'state' && locationId) key = `state_${locationId}`;
    if (scope === 'county' && locationId) key = `county_${locationId}`; // locationId should be "State_CountyName"
    
    return store[key] || null;
};

export const getLocalDataContext = (state?: string, county?: string): LocalDataContext => {
    const storeJSON = localStorage.getItem(DB_KEYS.LOCAL_DATA);
    const store = JSON.parse(storeJSON || '{}');
    
    const context: LocalDataContext = {
        national: store['national'] || nationalData
    };
    
    if (state && store[`state_${state}`]) {
        context.state = store[`state_${state}`];
    }
    
    if (state && county) {
        // Normalize county string to remove "County" suffix if present for matching
        const normalizedCounty = county.replace(' County', '').replace(' ', '');
        const key = `county_${state}_${normalizedCounty}`;
        if (store[key]) {
            context.county = store[key];
        }
    }
    
    return context;
};

export const saveLocalTradeData = (scope: 'national' | 'state' | 'county', locationId: string, data: LocalTradeData) => {
    const storeJSON = localStorage.getItem(DB_KEYS.LOCAL_DATA);
    const store = JSON.parse(storeJSON || '{}');
    
    let key = 'national';
    if (scope === 'state') key = `state_${locationId}`;
    if (scope === 'county') key = `county_${locationId}`;
    
    store[key] = data;
    localStorage.setItem(DB_KEYS.LOCAL_DATA, JSON.stringify(store));
};

// --- Setters / Updaters ---

export const contractorExists = (name: string): boolean => {
    const contractors = getContractors();
    return contractors.some(c => c.name.toLowerCase().trim() === name.toLowerCase().trim());
};

export const addUser = (newUser: User) => {
  const users = getUsers();
  users.push(newUser);
  localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
};

export const addContractor = (newContractor: Contractor) => {
    const contractors = getContractors();
    contractors.push(newContractor);
    localStorage.setItem(DB_KEYS.CONTRACTORS, JSON.stringify(contractors));
};

export const addReview = (contractorId: string, newReview: Review) => {
  const contractors = getContractors();
  const contractorIndex = contractors.findIndex(c => c.id === contractorId);

  if (contractorIndex > -1) {
    const contractor = contractors[contractorIndex];
    contractor.reviews.unshift(newReview);
    contractor.reviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    contractors[contractorIndex] = contractor;
    localStorage.setItem(DB_KEYS.CONTRACTORS, JSON.stringify(contractors));
  }
};

export const updateContractor = (updatedContractor: Contractor) => {
    const contractors = getContractors();
    const index = contractors.findIndex(c => c.id === updatedContractor.id);
    
    if (index > -1) {
        contractors[index] = updatedContractor;
        localStorage.setItem(DB_KEYS.CONTRACTORS, JSON.stringify(contractors));
    }
};

export const toggleSavedContractor = (userId: string, contractorId: string) => {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex > -1) {
        const user = users[userIndex];
        const savedIds = user.savedContractorIds || [];
        const contractorIndexInSaved = savedIds.indexOf(contractorId);

        if (contractorIndexInSaved > -1) {
            savedIds.splice(contractorIndexInSaved, 1);
        } else {
            savedIds.push(contractorId);
        }
        user.savedContractorIds = savedIds;
        users[userIndex] = user;
        localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
    }
};

// --- Admin Features ---

export const updateSuggestedPrompts = (prompts: string[]) => {
    localStorage.setItem(DB_KEYS.PROMPTS, JSON.stringify(prompts));
};

export const addKnowledgeEntry = (title: string, content: string) => {
    const entries = getKnowledgeBase();
    const newEntry: KnowledgeEntry = {
        id: `kb-${Date.now()}`,
        title,
        content,
        dateAdded: new Date().toISOString(),
        isActive: true
    };
    entries.push(newEntry);
    localStorage.setItem(DB_KEYS.KNOWLEDGE_BASE, JSON.stringify(entries));
};

export const removeKnowledgeEntry = (id: string) => {
    const entries = getKnowledgeBase().filter(e => e.id !== id);
    localStorage.setItem(DB_KEYS.KNOWLEDGE_BASE, JSON.stringify(entries));
};

export const toggleKnowledgeEntry = (id: string) => {
    const entries = getKnowledgeBase();
    const index = entries.findIndex(e => e.id === id);
    if (index > -1) {
        entries[index].isActive = !entries[index].isActive;
        localStorage.setItem(DB_KEYS.KNOWLEDGE_BASE, JSON.stringify(entries));
    }
};
