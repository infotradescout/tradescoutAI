
import { Contractor, User, Review, Category, KnowledgeEntry, LocalTradeData, LocalDataContext, Partnership, Lead, ActiveProject, ForumPost, ForumComment, CountyConfig } from '../types';

const DB_KEYS = {
    CONTRACTORS: 'scout_contractors',
    USERS: 'scout_users',
    REVIEWS: 'scout_reviews',
    LEADS: 'scout_leads',
    PROJECTS: 'scout_projects',
    FORUM_POSTS: 'scout_forum_posts',
    LOCAL_DATA: 'scout_local_data',
    PROMPTS: 'scout_prompts',
    KNOWLEDGE_BASE: 'scout_knowledge_base',
    ADS_PARTNERSHIPS: 'scout_partnerships',
    COUNTY_CONFIGS: 'scout_county_configs'
};

const SEED_CONTRACTORS: Contractor[] = [
    {
        id: 'c1',
        name: "Joe's Plumbing",
        category: Category.PLUMBING,
        location: "Oakville, ON",
        monthlyScore: 85,
        lifetimeScore: 920,
        avatarUrl: "https://ui-avatars.com/api/?name=Joes+Plumbing&background=random",
        description: "Expert plumbing services for residential and commercial needs. 20 years of experience.",
        specialties: ["Leak Repair", "Pipe Installation", "Water Heaters"],
        reviews: [
            { id: 'r1', userId: 'u2', rating: 5, comment: "Fast and reliable service!", date: "2023-10-15" },
            { id: 'r2', userId: 'u3', rating: 4, comment: "Good work, slightly pricey.", date: "2023-09-20" }
        ],
        verified: true,
        lat: 43.4675,
        lng: -79.6877,
        claimed: true,
        phone: "555-0101",
        website: "www.joesplumbing.com",
        distance: 2.5
    },
    {
        id: 'c2',
        name: "Elite Electricians",
        category: Category.ELECTRICAL,
        location: "Burlington, ON",
        monthlyScore: 92,
        lifetimeScore: 1150,
        avatarUrl: "https://ui-avatars.com/api/?name=Elite+Electricians&background=random",
        description: "Certified electricians specializing in smart home installations and rewiring.",
        specialties: ["Smart Home", "Rewiring", "Panel Upgrades"],
        reviews: [
            { id: 'r3', userId: 'u2', rating: 5, comment: "Installed my EV charger perfectly.", date: "2023-11-01" }
        ],
        verified: true,
        lat: 43.3255,
        lng: -79.7990,
        claimed: true,
        phone: "555-0102",
        website: "www.eliteelectric.ca",
        distance: 5.0
    },
    {
        id: 'c3',
        name: "Prestige Painters",
        category: Category.PAINTING,
        location: "Mississauga, ON",
        monthlyScore: 78,
        lifetimeScore: 600,
        avatarUrl: "https://ui-avatars.com/api/?name=Prestige+Painters&background=random",
        description: "Interior and exterior painting services with a focus on detail.",
        specialties: ["Interior", "Exterior", "Staining"],
        reviews: [],
        verified: false,
        lat: 43.5890,
        lng: -79.6441,
        claimed: false,
        phone: "555-0103",
        distance: 8.2
    },
    {
        id: 'c4',
        name: "Roofing Masters",
        category: Category.ROOFING,
        location: "Hamilton, ON",
        monthlyScore: 88,
        lifetimeScore: 980,
        avatarUrl: "https://ui-avatars.com/api/?name=Roofing+Masters&background=random",
        description: "Top-rated roofing company for repairs and replacements.",
        specialties: ["Shingles", "Flat Roofs", "Repairs"],
        reviews: [],
        verified: true,
        lat: 43.2557,
        lng: -79.8711,
        claimed: true,
        phone: "555-0104",
        website: "www.roofingmasters.ca",
        distance: 12.0
    },
    {
        id: 'c5',
        name: "Green Thumb Landscaping",
        category: Category.LANDSCAPING,
        location: "Oakville, ON",
        monthlyScore: 95,
        lifetimeScore: 1300,
        avatarUrl: "https://ui-avatars.com/api/?name=Green+Thumb&background=random",
        description: "Transforming your outdoor space into a paradise.",
        specialties: ["Garden Design", "Lawn Care", "Hardscaping"],
        reviews: [],
        verified: true,
        lat: 43.4600,
        lng: -79.6900,
        claimed: true,
        phone: "555-0105",
        distance: 1.5,
        isPromoted: true
    }
];

const SEED_USERS: User[] = [
    { id: 'u1', username: 'HomeOwner1', avatarUrl: 'https://ui-avatars.com/api/?name=HomeOwner1&background=random', bio: 'Renovating my 1980s home.', savedContractorIds: ['c2'], role: 'homeowner' },
    { id: 'u2', username: 'CondoDweller', avatarUrl: 'https://ui-avatars.com/api/?name=CondoDweller&background=random', bio: 'Looking for reliable maintenance pros.', savedContractorIds: [], role: 'homeowner' },
    { id: 'u3', username: 'DIYDave', avatarUrl: 'https://ui-avatars.com/api/?name=DIYDave&background=random', bio: 'I do most things myself, but need help sometimes.', savedContractorIds: ['c1'], role: 'homeowner' },
    { id: 'admin', username: 'Admin', avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=random', bio: 'System Administrator', savedContractorIds: [], isAdmin: true, role: 'homeowner' }
];

const SEED_PROMPTS = [
    "Find a reliable plumber for a kitchen leak",
    "How much does it cost to paint a 12x12 room?",
    "Roof repair specialists near me",
    "Permits needed for a deck in Texas",
    "Best work van for HVAC technician",
    "Landscaping ideas for small backyards"
];

const SEED_KNOWLEDGE: KnowledgeEntry[] = [
    { id: 'kb1', title: 'Permit Basics', content: 'Most structural changes require a permit. Electrical and plumbing work often requires separate trade permits.', dateAdded: new Date().toISOString(), isActive: true }
];

const SEED_PARTNERSHIPS: Partnership[] = [
    { id: 'p1', title: 'Home Depot Pro', description: '5% off bulk lumber', link: 'https://homedepot.com', type: 'Affiliate', triggerKeywords: ['lumber', 'deck', 'wood'], priority: 1, isActive: true },
    { id: 'p2', title: 'Ford Fleet', description: 'Lease deals on Transit vans', link: 'https://ford.com', type: 'Sponsored', triggerKeywords: ['van', 'truck', 'vehicle'], priority: 10, isActive: true }
];

const SEED_FORUM_POSTS: ForumPost[] = [
    {
        id: 'post-1',
        userId: 'u1',
        username: 'HomeOwner1',
        userRole: 'homeowner',
        title: 'Best insulation for attic?',
        content: 'I am looking to upgrade my attic insulation. Blown-in or batts? Any recommendations?',
        category: 'General Contractor',
        date: '2023-11-10',
        upvotes: 5,
        views: 120,
        comments: [
            { id: 'c1', postId: 'post-1', userId: 'c5', username: 'Joe\'s Plumbing', userRole: 'contractor', content: 'While I do plumbing, I recommend blown-in for better coverage in tight corners.', date: '2023-11-10', upvotes: 2 }
        ]
    }
];

export const initDB = () => {
    if (!localStorage.getItem(DB_KEYS.CONTRACTORS)) {
        localStorage.setItem(DB_KEYS.CONTRACTORS, JSON.stringify(SEED_CONTRACTORS));
    }
    if (!localStorage.getItem(DB_KEYS.USERS)) {
        localStorage.setItem(DB_KEYS.USERS, JSON.stringify(SEED_USERS));
    }
    if (!localStorage.getItem(DB_KEYS.PROMPTS)) {
        localStorage.setItem(DB_KEYS.PROMPTS, JSON.stringify(SEED_PROMPTS));
    }
    if (!localStorage.getItem(DB_KEYS.KNOWLEDGE_BASE)) {
        localStorage.setItem(DB_KEYS.KNOWLEDGE_BASE, JSON.stringify(SEED_KNOWLEDGE));
    }
    if (!localStorage.getItem(DB_KEYS.ADS_PARTNERSHIPS)) {
        localStorage.setItem(DB_KEYS.ADS_PARTNERSHIPS, JSON.stringify(SEED_PARTNERSHIPS));
    }
    if (!localStorage.getItem(DB_KEYS.FORUM_POSTS)) {
        localStorage.setItem(DB_KEYS.FORUM_POSTS, JSON.stringify(SEED_FORUM_POSTS));
    }
};

export const getSystemStats = () => {
    return {
        users: getUsers().length,
        contractors: getContractors().length,
        leads: getLeads().length,
        posts: getForumPosts().length,
        projects: JSON.parse(localStorage.getItem(DB_KEYS.PROJECTS) || '[]').length
    };
};

export const deleteUser = (userId: string) => {
    const users = getUsers().filter(u => u.id !== userId);
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
}

export const removeContractor = (id: string) => {
    const list = getContractors().filter(c => c.id !== id);
    localStorage.setItem(DB_KEYS.CONTRACTORS, JSON.stringify(list));
}

export const deleteReview = (contractorId: string, reviewId: string) => {
    const contractors = getContractors();
    const contractorIndex = contractors.findIndex(c => c.id === contractorId);
    if (contractorIndex > -1) {
        contractors[contractorIndex].reviews = contractors[contractorIndex].reviews.filter(r => r.id !== reviewId);
        localStorage.setItem(DB_KEYS.CONTRACTORS, JSON.stringify(contractors));
    }
}

export const deleteForumPost = (postId: string) => {
    const posts = getForumPosts().filter(p => p.id !== postId);
    localStorage.setItem(DB_KEYS.FORUM_POSTS, JSON.stringify(posts));
}

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
    return prompts ? JSON.parse(prompts) : [];
};

export const getKnowledgeBase = (): KnowledgeEntry[] => {
    const kb = localStorage.getItem(DB_KEYS.KNOWLEDGE_BASE);
    return kb ? JSON.parse(kb) : [];
};

export const getPartnerships = (): Partnership[] => {
    const p = localStorage.getItem(DB_KEYS.ADS_PARTNERSHIPS);
    return p ? JSON.parse(p) : [];
};

export const getLeads = (): Lead[] => {
    const l = localStorage.getItem(DB_KEYS.LEADS);
    return l ? JSON.parse(l) : [];
};

export const getProjects = (userId: string): ActiveProject[] => {
    const p = localStorage.getItem(DB_KEYS.PROJECTS);
    const projects: ActiveProject[] = p ? JSON.parse(p) : [];
    return projects.filter(project => project.userId === userId);
};

export const getForumPosts = (): ForumPost[] => {
    const p = localStorage.getItem(DB_KEYS.FORUM_POSTS);
    return p ? JSON.parse(p) : [];
};

export const getLocalTradeData = (scope: 'national' | 'state' | 'county', locationId?: string): LocalTradeData | null => {
    const storeJSON = localStorage.getItem(DB_KEYS.LOCAL_DATA);
    if (!storeJSON) return null;
    const store = JSON.parse(storeJSON);
    
    let key = 'national';
    if (scope === 'state' && locationId) key = `state_${locationId}`;
    if (scope === 'county' && locationId) key = `county_${locationId}`; 
    
    return store[key] || null;
};

export const getLocalDataContext = (state?: string, county?: string): LocalDataContext => {
    const storeJSON = localStorage.getItem(DB_KEYS.LOCAL_DATA);
    const store = JSON.parse(storeJSON || '{}');
    
    const context: LocalDataContext = {
        national: store['national'] || {} as any
    };
    
    if (state && store[`state_${state}`]) {
        context.state = store[`state_${state}`];
    }
    
    if (state && county) {
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

export const getCountyConfig = (county: string, state: string): CountyConfig | null => {
    const configsJSON = localStorage.getItem(DB_KEYS.COUNTY_CONFIGS);
    if (!configsJSON) return null;
    const configs: CountyConfig[] = JSON.parse(configsJSON);
    
    // Normalize search
    const normalizedCounty = county.toLowerCase().trim();
    const normalizedState = state.toLowerCase().trim();
    
    return configs.find(c => 
        c.countyCode.toLowerCase().trim() === normalizedCounty && 
        c.stateCode.toLowerCase().trim() === normalizedState
    ) || null;
};

export const saveCountyConfig = (config: CountyConfig) => {
    const configsJSON = localStorage.getItem(DB_KEYS.COUNTY_CONFIGS);
    const configs: CountyConfig[] = configsJSON ? JSON.parse(configsJSON) : [];
    
    const index = configs.findIndex(c => 
        c.countyCode.toLowerCase() === config.countyCode.toLowerCase() && 
        c.stateCode.toLowerCase() === config.stateCode.toLowerCase()
    );
    
    if (index > -1) {
        configs[index] = config;
    } else {
        configs.push(config);
    }
    
    localStorage.setItem(DB_KEYS.COUNTY_CONFIGS, JSON.stringify(configs));
    
    // Sync with LOCAL_DATA for app consumption
    const normalizedCounty = config.countyCode.replace(' County', '').replace(' ', '');
    saveLocalTradeData('county', `${config.stateCode}_${normalizedCounty}`, config.localTradeData);
};

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

export const addLead = (lead: Lead) => {
    const leads = getLeads();
    leads.push(lead);
    localStorage.setItem(DB_KEYS.LEADS, JSON.stringify(leads));
};

export const getLeadsForPro = (category: string, location: string): Lead[] => {
    const leads = getLeads();
    return leads.filter(l => 
        l.status === 'open' && 
        l.category === category &&
        (l.location.includes(location) || location.includes(l.location) || location === 'National' || l.location === 'US')
    );
};

export const addProject = (project: ActiveProject) => {
    const p = localStorage.getItem(DB_KEYS.PROJECTS);
    const projects: ActiveProject[] = p ? JSON.parse(p) : [];
    projects.push(project);
    localStorage.setItem(DB_KEYS.PROJECTS, JSON.stringify(projects));
}

export const updateProject = (project: ActiveProject) => {
    const p = localStorage.getItem(DB_KEYS.PROJECTS);
    const projects: ActiveProject[] = p ? JSON.parse(p) : [];
    const index = projects.findIndex(proj => proj.id === project.id);
    if (index > -1) {
        projects[index] = project;
        localStorage.setItem(DB_KEYS.PROJECTS, JSON.stringify(projects));
    }
}

export const addForumPost = (post: ForumPost) => {
    const posts = getForumPosts();
    posts.unshift(post);
    localStorage.setItem(DB_KEYS.FORUM_POSTS, JSON.stringify(posts));
}

export const addForumComment = (postId: string, comment: ForumComment) => {
    const posts = getForumPosts();
    const index = posts.findIndex(p => p.id === postId);
    if (index > -1) {
        posts[index].comments.push(comment);
        localStorage.setItem(DB_KEYS.FORUM_POSTS, JSON.stringify(posts));
    }
}

export const togglePostUpvote = (postId: string) => {
    const posts = getForumPosts();
    const index = posts.findIndex(p => p.id === postId);
    if (index > -1) {
        posts[index].upvotes += 1;
        localStorage.setItem(DB_KEYS.FORUM_POSTS, JSON.stringify(posts));
    }
}

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

export const updatePartnerships = (partnerships: Partnership[]) => {
    localStorage.setItem(DB_KEYS.ADS_PARTNERSHIPS, JSON.stringify(partnerships));
};

export const addPartnership = (p: Partnership) => {
    const current = getPartnerships();
    current.push(p);
    localStorage.setItem(DB_KEYS.ADS_PARTNERSHIPS, JSON.stringify(current));
};
