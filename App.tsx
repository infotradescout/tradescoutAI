
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import CategoryFilter from './components/CategoryFilter';
import SearchBar from './components/SearchBar';
import RatingFilter from './components/RatingFilter';
import QuoteCalculator from './components/QuoteCalculator';
import ContractorList from './components/ContractorList';
import AuthModal from './components/AuthModal';
import * as db from './services/db';
import { User, Review, Contractor, Category, ProjectAnalysis } from './types';
import SortControl from './components/SortControl';
import ProjectAssistant from './components/ProjectAssistant';
import ViewToggle from './components/ViewToggle';
import MapView from './components/MapView';
import { GoogleGenAI } from '@google/genai';
import QuoteRequestModal from './components/QuoteRequestModal';
import SavedProsDashboard from './components/SavedProsDashboard';
import Chatbot from './components/Chatbot';
import BusinessProfileModal from './components/BusinessProfileModal';
import AddBusinessModal from './components/AddBusinessModal';
import LandingPage from './components/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import { CloudArrowDownIcon } from './components/Icons';

type SortOption = 'monthlyScore' | 'lifetimeScore' | 'nearest';
type ViewMode = 'list' | 'map';
type Page = 'main' | 'dashboard' | 'admin';

// Helper to calculate distance in miles using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3958.8; // Radius of the Earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const App: React.FC = () => {
  // Main State
  const [page, setPage] = useState<Page>('main');
  const [hasSearched, setHasSearched] = useState(false); // New state for landing page toggle
  
  // Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [minRating, setMinRating] = useState<number>(0);
  const [sortOption, setSortOption] = useState<SortOption>('monthlyScore');
  
  // Data State
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectAnalysis, setProjectAnalysis] = useState<ProjectAnalysis | null>(null);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // UI State
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [quoteRequestContractor, setQuoteRequestContractor] = useState<Contractor | null>(null);

  // Business Profile Management State
  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Contractor | null>(null);
  const [businessModalMode, setBusinessModalMode] = useState<'claim' | 'edit'>('claim');
  
  // Add Business Modal State
  const [isAddBusinessModalOpen, setIsAddBusinessModalOpen] = useState(false);
  
  // Auto-Discovery & Deep Search State
  const [newlyDiscovered, setNewlyDiscovered] = useState<string | null>(null);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  
  // Location State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Auto-discovery effect
  useEffect(() => {
      const runAutoDiscovery = async () => {
        if (!userLocation) return;

        // Only run randomly (e.g. 30% chance on load) to simulate "finding" things over time
        if (Math.random() > 0.3) return;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            // Pick a random category to explore
            const categories = Object.values(Category);
            const randomCat = categories[Math.floor(Math.random() * categories.length)];

            // Step 1: Use Google Maps and Search tools to find businesses
            const searchResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Find 5 real, highly-rated ${randomCat} businesses near coordinates ${userLocation.lat}, ${userLocation.lng}. Search Google Maps and the web. Provide their names, description, location, phone, and website.`,
                config: { tools: [{ googleMaps: {} }, { googleSearch: {} }] }
            });
            
            // Extract potential source URLs from grounding
            const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            
            // Simplified heuristics for mapping chunks to results: just collect all valid URIs
            const mapUris = chunks.map((c: any) => c.maps?.googleMapsUri || c.maps?.uri || c.web?.uri).filter((u: any) => u);

            // Step 2: Parse the text response into JSON
            const parseResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Extract a JSON array from the following text. The JSON should match this schema: [{"name": "string", "description": "string", "location": "string", "phone": "string", "website": "string"}].
                
                Text to parse:
                ${searchResponse.text}`,
                config: { responseMimeType: 'application/json' }
            });
            
            const discovered = JSON.parse(parseResponse.text);
            
            if (Array.isArray(discovered) && discovered.length > 0) {
                let count = 0;
                discovered.forEach((biz: any, index: number) => {
                    if (!db.contractorExists(biz.name)) {
                         db.addContractor({
                            id: `auto-${Date.now()}-${Math.random()}`,
                            name: biz.name,
                            category: randomCat,
                            location: biz.location || "Nearby",
                            monthlyScore: Math.floor(Math.random() * 20) + 70, // Random score 70-90
                            lifetimeScore: 0,
                            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(biz.name)}&background=random`,
                            description: biz.description || `Professional ${randomCat} services found in your area.`,
                            specialties: [randomCat, 'Local Pro'],
                            reviews: [],
                            verified: false, // Auto-discovered are not verified yet
                            lat: userLocation.lat + (Math.random() - 0.5) * 0.05, 
                            lng: userLocation.lng + (Math.random() - 0.5) * 0.05,
                            claimed: false,
                            phone: biz.phone || null,
                            website: biz.website || null,
                            sourceUrl: mapUris[index] || undefined // Attempt to assign a source URL
                         });
                         count++;
                    }
                });
                
                if (count > 0) {
                    setContractors(db.getContractors());
                    setNewlyDiscovered(`${count} new ${randomCat} pros found near you!`);
                    setTimeout(() => setNewlyDiscovered(null), 6000);
                }
            }
        } catch (e) {
            console.log("Auto-discovery silent fail", e);
        }
      };
      
      runAutoDiscovery();
  }, [userLocation]);

  useEffect(() => {
    db.initDB();
    setContractors(db.getContractors());
    setUsers(db.getUsers());

    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }

    // Get User Location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const loc = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                setUserLocation(loc);
                // Default to nearest sort if location is found
                setSortOption('nearest'); 
            },
            (error) => {
                console.error("Error getting location:", error);
            }
        );
    }

  }, []);

  const performDeepSearch = useCallback(async (term: string) => {
      if (isDeepSearching || !term.trim()) return;
      
      setIsDeepSearching(true);
      console.log(`Starting Deep Search for: ${term}`);
      
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
          const promptLocation = userLocation ? `near coordinates ${userLocation.lat}, ${userLocation.lng}` : 'in the US';
          
          // Step 1: Use Maps and Search tool to find businesses (Text output)
          const searchResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `Find 4 real, existing ${term} related home service businesses ${promptLocation}. Search Google Maps and the web. Include real address, phone, and website.`,
              config: { tools: [{ googleMaps: {} }, { googleSearch: {} }] }
          });

          // Extract grounding metadata
          const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          
          // Extract ALL URIs from chunks (Maps, Web, etc.)
          const validUris: string[] = [];
          chunks.forEach((c: any) => {
              if (c.maps?.googleMapsUri) validUris.push(c.maps.googleMapsUri);
              else if (c.maps?.uri) validUris.push(c.maps.uri);
              else if (c.web?.uri) validUris.push(c.web.uri);
          });

          // Step 2: Parse text to JSON
          const parseResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `Extract JSON array from this search result: ${searchResponse.text}. Schema: [{"name": "string", "category": "string", "description": "string", "location": "string", "phone": "string", "website": "string"}]`,
              config: { responseMimeType: 'application/json' }
          });

          const results = JSON.parse(parseResponse.text);
          
          let count = 0;
          if (Array.isArray(results)) {
              results.forEach((biz: any, index: number) => {
                  if (!db.contractorExists(biz.name)) {
                      let cat = Category.GENERAL;
                      const lowerDesc = (biz.description || '' + biz.name).toLowerCase();
                      if (lowerDesc.includes('plumb')) cat = Category.PLUMBING;
                      else if (lowerDesc.includes('electric') || lowerDesc.includes('spark')) cat = Category.ELECTRICAL;
                      else if (lowerDesc.includes('roof')) cat = Category.ROOFING;
                      else if (lowerDesc.includes('paint')) cat = Category.PAINTING;
                      else if (lowerDesc.includes('landscape') || lowerDesc.includes('lawn')) cat = Category.LANDSCAPING;

                      db.addContractor({
                          id: `auto-${Date.now()}-${Math.random()}`,
                          name: biz.name,
                          category: biz.category as Category || cat,
                          location: biz.location || "US",
                          monthlyScore: Math.floor(Math.random() * 20) + 80,
                          lifetimeScore: 0,
                          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(biz.name)}&background=random`,
                          description: biz.description || `Professional ${cat} services.`,
                          specialties: [cat, 'Residential'],
                          reviews: [],
                          verified: false,
                          lat: userLocation ? userLocation.lat + (Math.random() - 0.5) * 0.05 : 38, 
                          lng: userLocation ? userLocation.lng + (Math.random() - 0.5) * 0.05 : -98,
                          claimed: false,
                          phone: biz.phone || null,
                          website: biz.website || null,
                          sourceUrl: validUris[index] || undefined
                      });
                      count++;
                  }
              });
          }

          if (count > 0) {
              setContractors(db.getContractors());
              setNewlyDiscovered(`${count} new pros found matching "${term}"`);
              setTimeout(() => setNewlyDiscovered(null), 5000);
          }

      } catch (e) {
          console.log("Deep Search failed", e);
      } finally {
          setIsDeepSearching(false);
      }
  }, [userLocation, isDeepSearching]);

  const handleProjectQuery = async (query: string) => {
    setIsAssistantLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      // Step 0: Check for General Information / Meta Queries
      if (query.toLowerCase().includes('what can tradescout') || query.toLowerCase().includes('how does this work')) {
         const response = await ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents: `Describe the TradeScout app features in JSON format as if it were a project analysis.
                Set "category" to "General Information".
                Set "estimatedCost" to "Free for Homeowners".
                Set "jobSummary" to "TradeScout is your AI-powered home improvement assistant..."
                Set "processSteps" to ["Project Analysis", "Cost Estimation", "Deep Search", "Comparison Tools"].
                Set "costFactors" to "TradeScout is free to use. You only pay independent contractors.".
                Set "estimatedMaterials" to ["Verified Contractors", "AI Cost Calculator", "Project Planner"].
                Output JSON only.`,
             config: { responseMimeType: 'application/json' }
         });
         const result: ProjectAnalysis = JSON.parse(response.text);
         setProjectAnalysis(result);
         setHasSearched(true);
         setIsAssistantLoading(false);
         return;
      }


      // Step 1: Location Extraction
      // We need to know where the user is talking about to pull the correct local data.
      const locationPrompt = `Analyze the query: "${query}". Extract the target State Code (2 letters, e.g. TX) and County Name (e.g. Travis) if mentioned or implied.
      If not mentioned, infer from context or return null.
      Return JSON: { "state": "string|null", "county": "string|null" }`;

      const locationResp = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: locationPrompt,
          config: { responseMimeType: 'application/json' }
      });
      const locData = JSON.parse(locationResp.text);
      
      // Step 2: Fetch Hierarchical Local Data Context
      const localContext = db.getLocalDataContext(locData.state, locData.county);
      
      // Step 3: Fetch Admin Knowledge Base
      const knowledgeEntries = db.getKnowledgeBase().filter(e => e.isActive);
      const adminKnowledge = knowledgeEntries.length > 0 
        ? `\n\nADMIN KNOWLEDGE BASE OVERRIDE:\n${knowledgeEntries.map(e => `[${e.title}]: ${e.content}`).join('\n')}`
        : '';

      // Step 4: Construct Main Analysis Prompt
      const mainPrompt = `Analyze this home improvement project request: "${query}".
      
      LOCAL DATA CONTEXT (Use this hierarchy: County > State > National):
      ${JSON.stringify(localContext, null, 2)}
      
      ${adminKnowledge}

      INSTRUCTIONS:
      You must base your analysis ONLY on the local data profile provided above.
      Use this fallback order:
      1. County data (if available in context)
      2. State data (if available in context)
      3. National data (always available)
      
      If a specific field (like permit requirements) is missing at the local level, look up the stack.
      NEVER guess regulations or costs if you have explicit data provided in the context.

      Return a detailed JSON object with the following fields:
      - "category": The most relevant contractor category.
      - "keywords": An array of 3-5 specific keywords.
      - "location": An inferred location string if present, else null.
      - "estimatedCost": A realistic, hyper-local price range string (e.g. "$200 - $500") based on the 'typicalCosts' in the provided local data.
      - "costFactors": A concise explanation (2-3 sentences). YOU MUST cite specific local factors from the provided context (e.g. "Travis County requires specific tree permits..." or "Texas labor rates are lower...").
      - "processSteps": An array of 3-5 strings outlining the step-by-step process. Mention specific permits from the context if relevant.
      - "estimatedMaterials": An array of strings listing materials likely needed.
      - "jobSummary": A professional, concise summary of the task.
      
      Use this JSON Schema:
      {
          "category": "string",
          "keywords": ["string"],
          "location": "string",
          "estimatedCost": "string",
          "costFactors": "string",
          "processSteps": ["string"],
          "estimatedMaterials": ["string"],
          "jobSummary": "string"
      }`;

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: mainPrompt,
          config: { responseMimeType: 'application/json' }
      });

      const result: ProjectAnalysis = JSON.parse(response.text);
      setProjectAnalysis(result);
      
      // Auto-apply filters based on analysis
      if (result.category && result.category !== 'General Information') {
          setSelectedCategory(result.category);
      }
      if (result.keywords && result.keywords.length > 0) {
          setSearchTerm(result.keywords.join(' '));
      }

      // Transition to dashboard view
      setHasSearched(true);

    } catch (error) {
      console.error("AI Assistant Error:", error);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const handleLogin = (username: string) => {
    // For Demo: Admin access check
    if (username.toLowerCase() === 'admin') {
         // Create mock admin if not exists in local state
         const adminUser = users.find(u => u.username === 'admin');
         if (adminUser) {
             setCurrentUser(adminUser);
             sessionStorage.setItem('currentUser', JSON.stringify(adminUser));
             setIsAuthModalOpen(false);
             return true;
         }
    }

    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
      setCurrentUser(user);
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      setIsAuthModalOpen(false);
      return true;
    }
    return false;
  };

  const handleSignup = (username: string, bio: string) => {
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return false;
    }
    const newUser: User = {
      id: `u${Date.now()}`,
      username,
      avatarUrl: `https://i.pravatar.cc/150?u=${username}`,
      bio,
      savedContractorIds: [],
    };
    db.addUser(newUser);
    setUsers(db.getUsers());
    setCurrentUser(newUser);
    sessionStorage.setItem('currentUser', JSON.stringify(newUser));
    setIsAuthModalOpen(false);
    return true;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
    setPage('main');
    setHasSearched(false);
    setProjectAnalysis(null);
    setSearchTerm('');
    setSelectedCategory('All');
  };

  const handleAddReview = (contractorId: string, review: Omit<Review, 'id' | 'date'>) => {
    const newReview: Review = {
      ...review,
      id: `r${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
    };
    db.addReview(contractorId, newReview);
    setContractors(db.getContractors());
  };

  const handleToggleSave = (contractorId: string) => {
      if (!currentUser) {
          setAuthMode('login');
          setIsAuthModalOpen(true);
          return;
      }
      db.toggleSavedContractor(currentUser.id, contractorId);
      // Update local state for currentUser
      const updatedUsers = db.getUsers();
      const updatedUser = updatedUsers.find(u => u.id === currentUser.id) || currentUser;
      setCurrentUser(updatedUser);
      sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
  };

  const handleBusinessProfileSave = (updatedContractor: Contractor) => {
      db.updateContractor(updatedContractor);
      setContractors(db.getContractors());
  };
  
  const handleImportBusiness = (newContractor: Contractor) => {
      if (db.contractorExists(newContractor.name)) {
          alert("This business already exists in our database.");
          return;
      }
      db.addContractor(newContractor);
      setContractors(db.getContractors());
      alert(`${newContractor.name} has been imported successfully!`);
  };

  const openClaimModal = (contractor: Contractor) => {
      setSelectedBusiness(contractor);
      setBusinessModalMode('claim');
      setBusinessModalOpen(true);
  };

  const openEditModal = (contractor: Contractor) => {
      setSelectedBusiness(contractor);
      setBusinessModalMode('edit');
      setBusinessModalOpen(true);
  };

  const filteredContractors = useMemo(() => {
    let result = contractors.map(c => {
        // Calculate distance if user location is available
        if (userLocation) {
            return {
                ...c,
                distance: calculateDistance(userLocation.lat, userLocation.lng, c.lat, c.lng)
            };
        }
        return c;
    });

    // Category Filter
    if (selectedCategory !== 'All' && selectedCategory !== 'General Information') {
      result = result.filter(c => c.category === selectedCategory);
    }

    // Advanced Search Filter
    if (searchTerm.trim()) {
        const lowerTerm = searchTerm.toLowerCase();
        
        // 1. Extract exact phrases (e.g., "smart home")
        const phrases = (lowerTerm.match(/"([^"]+)"/g) || []).map(p => p.replace(/"/g, ''));
        let remainingTerm = lowerTerm.replace(/"([^"]+)"/g, '');

        // 2. Extract excluded terms (e.g., -emergency)
        const exclusions = (remainingTerm.match(/-\w+/g) || []).map(e => e.substring(1));
        remainingTerm = remainingTerm.replace(/-\w+/g, '');

        // 3. Extract remaining keywords
        const keywords = remainingTerm.split(/\s+/).filter(Boolean);

        result = result.filter(c => {
            const textToCheck = `${c.name} ${c.description} ${c.specialties.join(' ')} ${c.location}`.toLowerCase();

            // Check Phrases (must contain ALL)
            const hasPhrases = phrases.every(phrase => textToCheck.includes(phrase));
            if (!hasPhrases) return false;

            // Check Exclusions (must contain NONE)
            const hasExclusions = exclusions.some(exclusion => textToCheck.includes(exclusion));
            if (hasExclusions) return false;

            // Check Keywords (must contain ALL - strictly narrowing)
            const hasKeywords = keywords.every(keyword => textToCheck.includes(keyword));
            if (hasKeywords) return false;

            return true;
        });
    }

    // Rating Filter
    if (minRating > 0) {
      result = result.filter(c => {
        if (c.reviews.length === 0) return false;
        const avg = c.reviews.reduce((acc, r) => acc + r.rating, 0) / c.reviews.length;
        return avg >= minRating;
      });
    }

    return result;
  }, [contractors, selectedCategory, searchTerm, minRating, userLocation]);

  // Deep Search Trigger
  useEffect(() => {
      // Only trigger deep search if we are past the landing page and actually searching
      if (hasSearched && searchTerm.length > 3 && filteredContractors.length === 0 && !isDeepSearching) {
          const timeoutId = setTimeout(() => {
              performDeepSearch(searchTerm);
          }, 1000); // Debounce 1s
          return () => clearTimeout(timeoutId);
      }
  }, [searchTerm, filteredContractors.length, isDeepSearching, performDeepSearch, hasSearched]);

  const savedContractorsList = useMemo(() => {
      if (!currentUser) return [];
      return contractors.filter(c => currentUser.savedContractorIds.includes(c.id));
  }, [contractors, currentUser]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative">
      {newlyDiscovered && (
          <div className="fixed top-24 right-4 z-50 bg-indigo-600 text-white px-4 py-3 md:px-6 md:py-4 rounded-xl shadow-2xl animate-fade-in-up flex items-center border border-indigo-400 max-w-[90vw]">
              <div className="bg-white/20 p-2 rounded-full mr-3 flex-shrink-0">
                  <CloudArrowDownIcon className="w-5 h-5 md:w-6 md:h-6 animate-bounce" />
              </div>
              <div>
                  <p className="font-bold text-sm md:text-base">Discovery Complete!</p>
                  <p className="text-xs md:text-sm opacity-90">{newlyDiscovered}</p>
              </div>
          </div>
      )}

      <Header 
        currentUser={currentUser} 
        onLoginClick={() => { setAuthMode('login'); setIsAuthModalOpen(true); }}
        onSignupClick={() => { setAuthMode('signup'); setIsAuthModalOpen(true); }}
        onLogout={handleLogout}
        onNavigateToDashboard={() => setPage('dashboard')}
        onAddBusinessClick={() => setIsAddBusinessModalOpen(true)}
        onAdminClick={() => setPage('admin')}
      />

      <main className="container mx-auto px-4 py-4 md:py-6 pb-20">
        {page === 'admin' ? (
            <AdminDashboard onBack={() => setPage('main')} />
        ) : page === 'dashboard' && currentUser ? (
            <SavedProsDashboard 
                savedContractors={savedContractorsList}
                allUsers={users}
                onBack={() => setPage('main')}
                onUnsave={(id) => handleToggleSave(id)}
            />
        ) : (
            <>
                {!hasSearched ? (
                    <LandingPage onQuerySubmit={handleProjectQuery} isLoading={isAssistantLoading} />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 animate-fade-in-up">
                        {/* Left Sidebar */}
                        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
                            <ProjectAssistant 
                                onQuerySubmit={handleProjectQuery} 
                                isLoading={isAssistantLoading} 
                                analysisResult={projectAnalysis}
                                onReset={() => {
                                    setHasSearched(false);
                                    setProjectAnalysis(null);
                                    setSearchTerm('');
                                    setSelectedCategory('All');
                                }}
                            />
                            <div className="hidden lg:block space-y-6">
                                <QuoteCalculator />
                                {/* Filters for Desktop */}
                                <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg">Filters</h3>
                                    <div className="mb-6">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                                        <select 
                                            value={selectedCategory} 
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-slate-800"
                                        >
                                            <option value="All">All Categories</option>
                                            {Object.values(Category).map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <RatingFilter minRating={minRating} onRatingChange={setMinRating} />
                                </div>
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
                             {/* Mobile Filters */}
                            <div className="lg:hidden space-y-4">
                                <CategoryFilter selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 items-center sticky top-16 md:top-20 z-30 bg-slate-50/95 backdrop-blur-sm py-2 transition-all">
                                <div className="flex-grow w-full">
                                    <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
                                </div>
                                <div className="flex-shrink-0 flex gap-2 w-full sm:w-auto">
                                    <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-sm font-medium text-slate-600">
                                    Showing <span className="font-bold text-indigo-600">{filteredContractors.length}</span> verified pros
                                    {userLocation && <span className="text-emerald-600 ml-2 bg-emerald-50 px-2 py-0.5 rounded-full text-xs border border-emerald-100 whitespace-nowrap">📍 Location Active</span>}
                                </p>
                                <div className="w-full sm:w-auto">
                                    <SortControl 
                                        sortOption={sortOption} 
                                        onSortChange={setSortOption} 
                                        hasLocation={!!userLocation}
                                    />
                                </div>
                            </div>

                            {viewMode === 'map' ? (
                                <div className="h-[400px] md:h-[600px] w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200 relative z-0">
                                    <MapView contractors={filteredContractors} />
                                </div>
                            ) : (
                                <ContractorList 
                                    contractors={filteredContractors} 
                                    sortOption={sortOption}
                                    currentUser={currentUser}
                                    allUsers={users}
                                    onAddReview={handleAddReview}
                                    onRequestQuote={setQuoteRequestContractor}
                                    onToggleSave={handleToggleSave}
                                    onClaim={openClaimModal}
                                    onEdit={openEditModal}
                                    onSearchOnline={() => performDeepSearch(searchTerm)}
                                    isSearchingOnline={isDeepSearching}
                                    onFilterByCategory={setSelectedCategory}
                                    onFilterByTerm={setSearchTerm}
                                    searchTerm={searchTerm}
                                />
                            )}
                        </div>
                    </div>
                )}
            </>
        )}
      </main>

      {isAuthModalOpen && (
        <AuthModal 
          mode={authMode}
          onClose={() => setIsAuthModalOpen(false)}
          onLogin={handleLogin}
          onSignup={handleSignup}
          onSwitchMode={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
        />
      )}

      <QuoteRequestModal 
         isOpen={!!quoteRequestContractor}
         onClose={() => setQuoteRequestContractor(null)}
         contractor={quoteRequestContractor}
         currentUser={currentUser}
      />
      
      <BusinessProfileModal 
        isOpen={businessModalOpen}
        onClose={() => setBusinessModalOpen(false)}
        contractor={selectedBusiness}
        onSave={handleBusinessProfileSave}
        mode={businessModalMode}
      />

      <AddBusinessModal
        isOpen={isAddBusinessModalOpen}
        onClose={() => setIsAddBusinessModalOpen(false)}
        onImport={handleImportBusiness}
      />

      <Chatbot />

      <style>{`
        @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
            animation: blob 7s infinite;
        }
        .animation-delay-2000 {
            animation-delay: 2s;
        }
        .animation-delay-4000 {
            animation-delay: 4s;
        }
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;
