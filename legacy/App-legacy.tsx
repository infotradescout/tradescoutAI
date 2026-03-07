import React, { useState, useEffect, useMemo, useCallback } from "react";
import Header from "./components/Header";
import CategoryFilter from "./components/CategoryFilter";
import SearchBar from "./components/SearchBar";
import RatingFilter from "./components/RatingFilter";
import QuoteCalculator from "./components/QuoteCalculator";
import ContractorList from "./components/ContractorList";
import AuthModal from "./components/AuthModal";
import * as db from "./services/db";
import { User, Review, Contractor, Category, ProjectAnalysis, ActiveProject } from "./types";
import SortControl from "./components/SortControl";
import ProjectAssistant from "./components/ProjectAssistant";
import ViewToggle from "./components/ViewToggle";
import MapView from "./components/MapView";
import QuoteRequestModal from "./components/QuoteRequestModal";
import SavedProsDashboard from "./components/SavedProsDashboard";
import Chatbot from "./components/Chatbot";
import BusinessProfileModal from "./components/BusinessProfileModal";
import AddBusinessModal from "./components/AddBusinessModal";
import LandingPage from "./components/LandingPage";
import AdminDashboard from "./components/AdminDashboard";
import ProjectDashboard from "./components/ProjectDashboard";
import CommunityForum from "./components/CommunityForum";
import ProDashboard from "./components/ProDashboard";
import LocationModal from "./components/LocationModal";
import { CloudArrowDownIcon, Cog6ToothIcon, ShieldCheckIcon } from "./components/Icons";
import { lookupCountyFromLatLng } from "./services/locationService";
import { authService } from "./services/auth";

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch("/api/ai/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return typeof data.text === "string" ? data.text : "";
}

type SortOption = "monthlyScore" | "lifetimeScore" | "nearest";
type ViewMode = "list" | "map";
type Page = "main" | "dashboard" | "admin" | "projects" | "forum";

// SYSTEM PROMPT - GLOBAL AI CONFIGURATION
const SYSTEM_PROMPT = `
You are Community Scout — a strictly local-first home project assistant.

LOCAL-DATA PRIORITY (critical):
1. COUNTY data (highest priority)
2. STATE data
3. REGION data
4. NATIONAL data (lowest)

Rules:
- Never guess or fabricate missing county or state values.
- Always cite which level you are using: "county", "state", "region", or "national".
- If county-level data is incomplete, fall back in order without inventing anything.
- Recommend only contractors passed in the request.
- Never reference external directories or non-existent businesses.
- If the app lacks contractor matches, admit it and suggest next steps.
- Use structured JSON when asked, matching the schema exactly.
- For cost ranges: use county.typicalCosts first → then state → region → national.
- Admit when the database has gaps; never hallucinate.
- Safety: emphasize licensed pros for electrical, structural, gas, and roof work.

Tone:
- Direct, actionable, local, community-first.
- Avoid corporate language.
`;

// Helper to calculate distance in miles using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const App: React.FC = () => {
  // Main State
  const [page, setPage] = useState<Page>("main");
  const [hasSearched, setHasSearched] = useState(false); // New state for landing page toggle

  // Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [minRating, setMinRating] = useState<number>(0);
  const [sortOption, setSortOption] = useState<SortOption>("monthlyScore");

  // Data State
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectAnalysis, setProjectAnalysis] = useState<ProjectAnalysis | null>(null);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // UI State
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [quoteRequestContractor, setQuoteRequestContractor] = useState<Contractor | null>(null);

  // Business Profile Management State
  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Contractor | null>(null);
  const [businessModalMode, setBusinessModalMode] = useState<"claim" | "edit">("claim");

  // Add Business Modal State
  const [isAddBusinessModalOpen, setIsAddBusinessModalOpen] = useState(false);

  // Auto-Discovery & Deep Search State
  const [newlyDiscovered, setNewlyDiscovered] = useState<string | null>(null);
  const [isDeepSearching, setIsDeepSearching] = useState(false);

  // Location State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);
  const [selectedCountyCode, setSelectedCountyCode] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Auto-discovery effect
  useEffect(() => {
    const runAutoDiscovery = async () => {
      if (!userLocation) return;

      // Only run randomly (e.g. 30% chance on load) to simulate "finding" things over time
      if (Math.random() > 0.3) return;

      // Disabled: legacy auto-discovery used client-side LLM web tools.
      // If reintroducing, route any LLM calls through server endpoints.
      return;
    };

    runAutoDiscovery();
  }, [userLocation]);

  useEffect(() => {
    db.initDB();
    setContractors(db.getContractors());
    setUsers(db.getUsers());

    // Restore Location Preference
    const s = localStorage.getItem("userLocationState");
    const c = localStorage.getItem("userLocationCounty");
    if (s && c) {
      setSelectedStateCode(s);
      setSelectedCountyCode(c);
    }

    // Check for Secure Session
    const initSession = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    };
    initSession();

    // Get User Location & Geocode if needed
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(loc);
          setSortOption("nearest");

          // If no manual override exists, lookup county
          if (!localStorage.getItem("userLocationCounty")) {
            const info = await lookupCountyFromLatLng(loc.lat, loc.lng);
            if (info) {
              setSelectedStateCode(info.stateCode);
              setSelectedCountyCode(info.countyCode);
              // Optional: Auto-save guessed location?
              // localStorage.setItem("userLocationState", info.stateCode);
              // localStorage.setItem("userLocationCounty", info.countyCode);
            } else {
              // Fallback if lookup fails or user denied loc but we want to ask
              setShowLocationModal(true);
            }
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          // If location denied and no saved data, prompt user
          if (!localStorage.getItem("userLocationCounty")) {
            setShowLocationModal(true);
          }
        }
      );
    } else {
      if (!localStorage.getItem("userLocationCounty")) {
        setShowLocationModal(true);
      }
    }
  }, []);

  const handleLocationSelect = (stateCode: string, county: string) => {
    setSelectedStateCode(stateCode);
    setSelectedCountyCode(county);
    localStorage.setItem("userLocationState", stateCode);
    localStorage.setItem("userLocationCounty", county);
    setShowLocationModal(false);
  };

  const performDeepSearch = useCallback(
    async (term: string) => {
      if (isDeepSearching || !term.trim()) return;
      setIsDeepSearching(true);
      try {
        // Disabled: legacy deep search used client-side LLM web tools.
        // If reintroducing, route any LLM calls through server endpoints.
        return;
      } catch (e) {
        console.error("Deep search failed", e);
      } finally {
        setIsDeepSearching(false);
      }
    },
    [userLocation, isDeepSearching, selectedCountyCode, selectedStateCode]
  );

  // ... (handleProjectQuery and other handlers remain the same)
  const handleProjectQuery = async (query: string) => {
    setIsAssistantLoading(true);
    try {
      const activeState = selectedStateCode;
      const activeCounty = selectedCountyCode;

      const localContext = db.getLocalDataContext(
        activeState || undefined,
        activeCounty || undefined
      );

      const knowledgeEntries = db.getKnowledgeBase().filter((e: any) => e.isActive);
      const adminKnowledge =
        knowledgeEntries.length > 0
          ? `\n\nADMIN KNOWLEDGE BASE:\n${knowledgeEntries.map((e: any) => `[${e.title}]: ${e.content}`).join("\n")}`
          : "";

      const partnerships = db.getPartnerships().filter((p: any) => p.isActive);
      const partnershipData =
        partnerships.length > 0
          ? `\n\nAVAILABLE PARTNERSHIPS / ADS:\n${JSON.stringify(partnerships.map((p: any) => ({ title: p.title, type: p.type, keywords: p.triggerKeywords, link: p.link, desc: p.description })))}`
          : "";

      const prompt = `${SYSTEM_PROMPT}

User query: "${query}"

LOCAL DATA CONTEXT:
${JSON.stringify(localContext, null, 2)}
${adminKnowledge}
${partnershipData}

Return JSON only matching the ProjectAnalysis schema used by this legacy UI.`;

      const analysis = JSON.parse(await callGemini(prompt));
      setProjectAnalysis(analysis);
      return;

      // Step 1: Intent Classification & Location Extraction
      const classificationPrompt = `
        You are the core logic of TradeScout, a community interaction and resource platform.
        Analyze the user query: "${query}"
        
        Determine the INTENT:
        - 'GENERAL': User is asking "What can you do?", "How does this work?", "Who are you?", or about app features.
        - 'PROJECT': User describes a job, renovation, repair, or wants to find a contractor (e.g. "Fix my sink", "Kitchen remodel").
        - 'VEHICLE': User is looking for work trucks, vans, heavy equipment, or tools.
        - 'CODES': User is asking about building codes, permits, laws, or regulations.
        
        Extract LOCATION (if mentioned): State Code (2 letters) and County Name.
        If not mentioned, return null.

        Return JSON: { "intent": "GENERAL" | "PROJECT" | "VEHICLE" | "CODES", "state": "string|null", "county": "string|null" }
      `;

      const classResp = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: classificationPrompt,
        config: { responseMimeType: "application/json" },
      });

      const { intent, state, county } = JSON.parse(classResp.text);

      // Step 2: Fetch Context Data (Local Data, Knowledge Base, Ads)
      // Use detected location OR selected location
      const activeState = state || selectedStateCode;
      const activeCounty = county || selectedCountyCode;

      const localContext = db.getLocalDataContext(
        activeState || undefined,
        activeCounty || undefined
      );

      const knowledgeEntries = db.getKnowledgeBase().filter((e) => e.isActive);
      const adminKnowledge =
        knowledgeEntries.length > 0
          ? `\n\nADMIN KNOWLEDGE BASE:\n${knowledgeEntries.map((e) => `[${e.title}]: ${e.content}`).join("\n")}`
          : "";

      const partnerships = db.getPartnerships().filter((p) => p.isActive);
      const partnershipData =
        partnerships.length > 0
          ? `\n\nAVAILABLE PARTNERSHIPS / ADS: \n${JSON.stringify(partnerships.map((p) => ({ title: p.title, type: p.type, keywords: p.triggerKeywords, link: p.link, desc: p.description })))}`
          : "";

      // Step 3: Branching Logic based on Intent
      let mainPrompt = "";

      if (intent === "GENERAL") {
        // Flow: App Capabilities
        mainPrompt = `The user asked: "${query}". 
          They are inquiring about TradeScout's capabilities or features.
          
          Respond by generating a JSON object that maps system features to the 'ProjectAnalysis' schema so the UI displays a "System Overview".
          
          - "intent": "GENERAL"
          - "category": "General Information"
          - "jobSummary": A welcoming, neighborly summary of what TradeScout is (Community Interaction Platform, Local Intelligence, Project Management).
          - "estimatedCost": "Free for Communities"
          - "costFactors": "TradeScout is free to use. Connect with neighbors and local pros."
          - "processSteps": ["Interact with Neighbors", "Find Local Pros", "Access Area Intel", "Manage Projects"]
          - "estimatedMaterials": ["Community Forum", "Scout Intelligence", "Verified Directory"]
          - "relatedServices": ["Home Security", "Moving Services", "Interior Design"] (Suggest lifestyle services)
          - "affiliateOffers": [] 
          - "thoughtProcess": "User asked about app capabilities. Mapping system features to display fields."
          
          Return JSON only.`;
      } else if (intent === "VEHICLE") {
        // Flow: Fleet & Gear
        mainPrompt = `The user is interested in Vehicles or Equipment: "${query}".
          
          CONTEXT:
          ${partnershipData}
          
          Respond with a JSON object:
          - "intent": "VEHICLE"
          - "category": "Fleet & Equipment"
          - "jobSummary": A summary of the vehicle/tool specs requested.
          - "estimatedCost": Market price range for purchase or rental.
          - "costFactors": Key specs affecting price (e.g. Mileage, Horsepower, Brand).
          - "processSteps": ["Determine Specs", "Check Inventory", "Financing Options", "Purchase/Lease"]
          - "estimatedMaterials": List of specific models or tool types.
          - "affiliateOffers": Suggest relevant partners (e.g. Ford, Home Depot) from the provided list.
          - "thoughtProcess": Explain your recommendation logic.
          
          Return JSON only.`;
      } else if (intent === "CODES") {
        // Flow: Regulations
        mainPrompt = `The user is asking about Codes/Permits: "${query}".
          
          LOCAL DATA CONTEXT:
          ${JSON.stringify(localContext, null, 2)}
          
          ${adminKnowledge}
          
          Respond with a JSON object:
          - "intent": "CODES"
          - "category": "Regulatory Briefing"
          - "jobSummary": A summary of the regulations/permits relevant to their query.
          - "estimatedCost": Estimated Permit Fees (from local data if avail).
          - "costFactors": Explanation of why permits are needed and risks of skipping.
          - "processSteps": ["Application", "Plan Review", "Inspection", "Approval"]
          - "estimatedMaterials": List of required documents (Site Plan, Electrical Diagram, etc.)
          - "thoughtProcess": Explain how you derived the code info from local data.
          
          Return JSON only.`;
      } else {
        // Flow: Standard Project (Renovation/Repair) - Default
        mainPrompt = `Analyze this community or home improvement request: "${query}".
          
          You are a "Scout Guide" - a helpful, knowledgeable neighbor.
          
          LOCAL DATA CONTEXT (Use this hierarchy: County > State > National):
          ${JSON.stringify(localContext, null, 2)}
          
          ${adminKnowledge}
          ${partnershipData}
    
          INSTRUCTIONS:
          1. Analyze the project needs based on the local context.
          2. Suggest 3-4 "Related Services" (internal ecosystem searches).
          3. Suggest 2-3 "Affiliate Offers" (Check PARTNERSHIPS list first).
          
          4. THOUGHT PROCESS: Explicitly explain your reasoning. Why did you choose this cost range? Which local regulations did you consider?
          5. Set INTENT to "PROJECT".
    
          Return a detailed JSON object matching this schema:
          {
              "intent": "PROJECT",
              "category": "string",
              "keywords": ["string"],
              "location": "string",
              "estimatedCost": "string",
              "costFactors": "string",
              "processSteps": ["string"],
              "estimatedMaterials": ["string"],
              "jobSummary": "string",
              "relatedServices": ["string"],
              "affiliateOffers": [{ "title": "string", "type": "string" }],
              "thoughtProcess": "string"
          }`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: mainPrompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: SYSTEM_PROMPT, // Use global system prompt
        },
      });

      const result: ProjectAnalysis = JSON.parse(response.text);
      setProjectAnalysis(result);

      // Auto-apply filters based on analysis ONLY if it's a project
      if (result.intent === "PROJECT") {
        if (result.category) setSelectedCategory(result.category);
        if (result.keywords && result.keywords.length > 0) setSearchTerm(result.keywords.join(" "));
      } else {
        setSearchTerm("");
        setSelectedCategory("All");
      }

      setHasSearched(true);
    } catch (error) {
      console.error("Scout Assistant Error:", error);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const handleLogin = async (username: string) => {
    // For demo simplicity, admin/baker bypass hash check in old mock logic
    // But with authService, we should try real login
    // Fallback for "admin" without password in this specific mock function signature which only takes username
    // Real implementation uses authService.login(username, password) inside the modal.
    // This handler is called AFTER modal success.

    // Refresh user from DB/Auth
    const user = await authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const handleSignup = async (username: string, bio: string) => {
    // This is handled by AuthModal calling authService.register
    // We just need to refresh state
    const user = await authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setPage("main");
    setHasSearched(false);
    setProjectAnalysis(null);
    setSearchTerm("");
    setSelectedCategory("All");
  };

  const handleAddReview = (contractorId: string, review: Omit<Review, "id" | "date">) => {
    const newReview: Review = {
      ...review,
      id: `r${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
    };
    db.addReview(contractorId, newReview);
    setContractors(db.getContractors());
  };

  const handleToggleSave = (contractorId: string) => {
    if (!currentUser) {
      setAuthMode("login");
      setIsAuthModalOpen(true);
      return;
    }
    db.toggleSavedContractor(currentUser.id, contractorId);
    // Refresh user to get updated saved list
    const updatedUsers = db.getUsers();
    const updatedUser = updatedUsers.find((u) => u.id === currentUser.id);
    if (updatedUser) setCurrentUser(updatedUser);
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
    setBusinessModalMode("claim");
    setBusinessModalOpen(true);
  };

  const openEditModal = (contractor: Contractor) => {
    setSelectedBusiness(contractor);
    setBusinessModalMode("edit");
    setBusinessModalOpen(true);
  };

  // NEW: Admin Action Handler for Deleting Contractors "On the Fly"
  const handleAdminDeleteContractor = (contractor: Contractor) => {
    if (currentUser?.isAdmin) {
      if (confirm(`ADMIN ACTION: Permanently delete ${contractor.name}?`)) {
        db.removeContractor(contractor.id);
        setContractors(db.getContractors());
      }
    }
  };

  const handleSaveAsProject = () => {
    if (!currentUser || !projectAnalysis) {
      if (!currentUser) setIsAuthModalOpen(true);
      return;
    }
    const newProject: ActiveProject = {
      id: `proj-${Date.now()}`,
      userId: currentUser.id,
      title:
        projectAnalysis.category !== "General Information"
          ? `${projectAnalysis.category} Project`
          : "New Project",
      category: projectAnalysis.category,
      status: "planning",
      startDate: new Date().toISOString().split("T")[0],
      budget: 0,
      notes: projectAnalysis.jobSummary,
      tasks: projectAnalysis.processSteps.map((step, idx) => ({
        id: `task-${Date.now()}-${idx}`,
        title: step,
        status: "pending",
      })),
      documents: [],
    };
    db.addProject(newProject);
    alert("Project saved to your dashboard!");
    setPage("projects");
  };

  // Chatbot handlers
  const handleChatSearch = (term: string, category: string) => {
    setHasSearched(true);
    setSearchTerm(term);
    if (category) setSelectedCategory(category);
  };

  const handleChatSave = (contractorId: string) => {
    handleToggleSave(contractorId);
  };

  const handleChatReview = (contractorId: string, rating: number, comment: string) => {
    if (!currentUser) return false;
    handleAddReview(contractorId, { userId: currentUser.id, rating, comment });
    return true;
  };

  const handleChatClaim = (contractorId: string) => {
    const c = contractors.find((con) => con.id === contractorId);
    if (c) openClaimModal(c);
  };

  // Filter Logic
  const filteredContractors = useMemo(() => {
    let result = contractors.map((c) => {
      if (userLocation) {
        return {
          ...c,
          distance: calculateDistance(userLocation.lat, userLocation.lng, c.lat, c.lng),
        };
      }
      return c;
    });

    if (selectedCategory !== "All" && selectedCategory !== "General Information") {
      result = result.filter((c) => c.category === selectedCategory);
    }

    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase();
      const phrases = (lowerTerm.match(/"([^"]+)"/g) || []).map((p) => p.replace(/"/g, ""));
      let remainingTerm = lowerTerm.replace(/"([^"]+)"/g, "");
      const exclusions = (remainingTerm.match(/-\w+/g) || []).map((e) => e.substring(1));
      remainingTerm = remainingTerm.replace(/-\w+/g, "");
      const keywords = remainingTerm.split(/\s+/).filter(Boolean);

      result = result.filter((c) => {
        const textToCheck =
          `${c.name} ${c.description} ${c.specialties.join(" ")} ${c.location}`.toLowerCase();
        const hasPhrases = phrases.every((phrase) => textToCheck.includes(phrase));
        if (!hasPhrases) return false;
        const hasExclusions = exclusions.some((exclusion) => textToCheck.includes(exclusion));
        if (hasExclusions) return false;
        const hasKeywords = keywords.every((keyword) => textToCheck.includes(keyword));
        if (hasKeywords) return false;
        return true;
      });
    }

    if (minRating > 0) {
      result = result.filter((c) => {
        if (c.reviews.length === 0) return false;
        const avg = c.reviews.reduce((acc, r) => acc + r.rating, 0) / c.reviews.length;
        return avg >= minRating;
      });
    }
    return result;
  }, [contractors, selectedCategory, searchTerm, minRating, userLocation]);

  const savedContractorsList = useMemo(() => {
    if (!currentUser) return [];
    return contractors.filter((c) => currentUser.savedContractorIds.includes(c.id));
  }, [contractors, currentUser]);

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-100 relative selection:bg-orange-500 selection:text-white pb-20 md:pb-0">
      {/* Floating Admin Toolbar */}
      {currentUser?.isAdmin && page !== "admin" && (
        <div className="fixed top-24 left-4 z-50 flex flex-col gap-2 animate-fade-in-up">
          <div className="bg-red-900/90 text-white p-3 rounded-xl shadow-2xl border border-red-500 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2 border-b border-red-500/50 pb-2">
              <ShieldCheckIcon className="w-5 h-5 text-red-300" />
              <span className="text-xs font-bold uppercase tracking-wider">Admin Mode Active</span>
            </div>
            <button
              onClick={() => setPage("admin")}
              className="w-full text-xs font-bold bg-white text-red-900 px-3 py-1.5 rounded hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
            >
              <Cog6ToothIcon className="w-3 h-3" />
              Open Console
            </button>
            <p className="text-[10px] text-red-200 mt-2 text-center max-w-[120px] leading-tight">
              You can delete listings and posts directly from this view.
            </p>
          </div>
        </div>
      )}

      {newlyDiscovered && (
        <div className="fixed top-24 right-4 z-50 bg-orange-600 text-white px-4 py-3 md:px-6 md:py-4 rounded-xl shadow-2xl animate-fade-in-up flex items-center border border-orange-400 max-w-[90vw]">
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
        onLoginClick={() => {
          setAuthMode("login");
          setIsAuthModalOpen(true);
        }}
        onSignupClick={() => {
          setAuthMode("signup");
          setIsAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        onNavigateToDashboard={() => {
          // Determine dashboard based on role
          if (currentUser?.role === "contractor")
            setPage("dashboard"); // Actually need logic here to show PRO dashboard
          else setPage("dashboard"); // For homeowner, this is Saved Dashboard
        }}
        onNavigateToProjects={() => setPage("projects")}
        onAddBusinessClick={() => setIsAddBusinessModalOpen(true)}
        onAdminClick={() => setPage("admin")}
        onNavigateToForum={() => setPage("forum")}
      />

      <main className="container mx-auto px-4 py-4 md:py-6">
        {page === "admin" ? (
          <AdminDashboard onBack={() => setPage("main")} />
        ) : page === "dashboard" && currentUser?.role === "contractor" ? (
          <ProDashboard currentUser={currentUser} onBack={() => setPage("main")} />
        ) : page === "dashboard" && currentUser ? (
          <SavedProsDashboard
            savedContractors={savedContractorsList}
            allUsers={users}
            onBack={() => setPage("main")}
            onUnsave={(id) => handleToggleSave(id)}
          />
        ) : page === "projects" && currentUser ? (
          <ProjectDashboard currentUser={currentUser} onBack={() => setPage("main")} />
        ) : page === "forum" ? ( // Forum Page
          <CommunityForum
            currentUser={currentUser}
            onLoginClick={() => {
              setAuthMode("login");
              setIsAuthModalOpen(true);
            }}
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
                      setSearchTerm("");
                      setSelectedCategory("All");
                    }}
                  />
                  {/* Save Analysis as Project Button */}
                  {projectAnalysis && currentUser && projectAnalysis.intent === "PROJECT" && (
                    <button
                      onClick={handleSaveAsProject}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-md hover:bg-emerald-700 hover:-translate-y-0.5 transition-all flex items-center justify-center border border-emerald-500"
                    >
                      <CloudArrowDownIcon className="w-5 h-5 mr-2" />
                      Save as Active Project
                    </button>
                  )}

                  <div className="hidden lg:block space-y-6">
                    <QuoteCalculator />
                    {/* Filters for Desktop */}
                    <div className="bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-700">
                      <h3 className="font-bold text-white mb-4 text-lg">Filters</h3>
                      <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-300 mb-2">
                          Category
                        </label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full border border-slate-600 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-slate-900 text-white"
                        >
                          <option value="All">All Categories</option>
                          {Object.values(Category).map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
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
                    <CategoryFilter
                      selectedCategory={selectedCategory}
                      onSelectCategory={setSelectedCategory}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-center sticky top-16 md:top-20 z-30 bg-slate-900/95 backdrop-blur-sm py-2 transition-all">
                    <div className="flex-grow w-full">
                      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
                    </div>
                    <div className="flex-shrink-0 flex gap-2 w-full sm:w-auto">
                      <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
                    <p className="text-sm font-medium text-slate-300">
                      Showing{" "}
                      <span className="font-bold text-orange-400">
                        {filteredContractors.length}
                      </span>{" "}
                      verified pros
                      {selectedStateCode && (
                        <span className="text-emerald-400 ml-2 bg-emerald-900/30 px-2 py-0.5 rounded-full text-xs border border-emerald-800 whitespace-nowrap">
                          📍 {selectedCountyCode}, {selectedStateCode}
                        </span>
                      )}
                    </p>
                    <div className="w-full sm:w-auto">
                      <SortControl
                        sortOption={sortOption}
                        onSortChange={setSortOption}
                        hasLocation={!!userLocation}
                      />
                    </div>
                  </div>

                  {viewMode === "map" ? (
                    <div className="h-[400px] md:h-[600px] w-full rounded-2xl overflow-hidden shadow-lg border border-slate-700 relative z-0">
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
                      onDelete={handleAdminDeleteContractor} // PASS DELETE HANDLER
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

      {/* Modals and Chatbot remain same */}
      {isAuthModalOpen && (
        <AuthModal
          mode={authMode}
          onClose={() => setIsAuthModalOpen(false)}
          onLogin={async (user) => {
            const success = await authService.login(user, "Password123!"); // In real usage this would take form data
            if (success) {
              const u = await authService.getCurrentUser();
              if (u) setCurrentUser(u);
              setIsAuthModalOpen(false);
              return true;
            }
            return false;
          }}
          onSignup={async (user, bio) => {
            const success = await authService.register(user, "Password123!", bio);
            if (success) {
              const u = await authService.getCurrentUser();
              if (u) setCurrentUser(u);
              setIsAuthModalOpen(false);
              return true;
            }
            return false;
          }}
          onSwitchMode={() => setAuthMode(authMode === "login" ? "signup" : "login")}
        />
      )}

      {showLocationModal && (
        <LocationModal
          onClose={() => setShowLocationModal(false)}
          onSelect={handleLocationSelect}
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

      <Chatbot
        currentUser={currentUser}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onSearch={handleChatSearch}
        onSave={handleChatSave}
        onReview={handleChatReview}
        onClaim={handleChatClaim}
        onAddBusiness={() => setIsAddBusinessModalOpen(true)}
      />

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
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default App;
