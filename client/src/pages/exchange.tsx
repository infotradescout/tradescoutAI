import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Megaphone,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  Factory,
  Filter,
  Gavel,
  Eye,
  Heart,
  HeartHandshake,
  HelpCircle,
  Info,
  MapPin,
  Package,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  Share2,
  MessageSquare,
  Copy,
  Building,
  Clock,
  ExternalLink,
  Tag,
  TrendingUp,
  Upload as UploadIcon,
  Home,
  Wrench,
  Trees,
  Briefcase,
  Smartphone,
  Trophy,
  Palette,
  Gem,
  Layers3,
} from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { uploadObject } from "@/lib/objectUpload";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { share } from "@/utils/share";
import { SEOHelmet } from "@/components/SEOHelmet";
import {
  EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME as SHARED_EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME,
  type ExchangeCategorySlug,
  type SellField,
  SELL_CATEGORY_FIELDS as SHARED_SELL_CATEGORY_FIELDS,
  SELL_CATEGORY_FLOWS as SHARED_SELL_CATEGORY_FLOWS,
  getExchangePhotoHint,
  getExchangePhotoMaximum,
  getRequiredExchangeFieldKeys,
  validateExchangeCategoryListing,
  EXCHANGE_PROHIBITED_POLICY_NOTICE,
  getCottageFoodRules,
} from "@shared/exchangeListingRules";

interface ExchangeItem {
  id: string;
  title: string;
  description: string;
  price: number | null;
  pricingMode?: "fixed" | "request_quote";
  category: string;
  condition: "new" | "like_new" | "good" | "fair";
  images: string[];
  location: string;
  seller: {
    id: string;
    name: string;
    rating: number;
    verified: boolean;
  };
  createdAt: string;
  featured: boolean;
  views: number;
  favorites: number;
  isLocalPickupOnly?: boolean;
  shippingCost?: number | null;
  state?: string;
  county?: string;
  sourceType?: string;
  profileOfferId?: string;
  publicProfilePath?: string;
}

interface ExchangePromotion {
  id: string;
  slug: string;
  title: string;
  description: string;
  offerDetails: string;
  businessName: string;
  promoCode?: string | null;
  expiresAt?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  isFeatured?: boolean;
  viewCount: number;
  leadCount: number;
}

interface CompanyPromotion {
  id: string;
  companyName: string;
  companyLogo?: string;
  companyWebsite?: string;
  title: string;
  description: string;
  dealDetails: string;
  dealType:
    | "percentage_off"
    | "dollar_off"
    | "bogo"
    | "free_shipping"
    | "bundle_deal"
    | "clearance";
  discountValue?: number;
  originalPrice?: number;
  salePrice?: number;
  promoCode?: string;
  minimumPurchase?: number;
  maxDiscount?: number;
  productCategories: string[];
  targetAudience: string[];
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  isFeatured: boolean;
  availableStates?: string[];
  storeLocationsOnly: boolean;
  slug: string;
  viewCount: number;
  clickCount: number;
  redemptionCount: number;
  terms?: string;
  restrictions?: string;
}

type SellFormCategorySlug = Exclude<
  ExchangeCategorySlug,
  "real-estate" | "metals" | "building-materials"
>;
type ExchangePortalSlug = "" | "rental-property" | "rental-equipment";
type ExchangeSearchScope = "local" | "state" | "nationwide";

const EXCHANGE_CATEGORIES = [
  {
    id: "business",
    name: "Sell Your Business",
    icon: Building2,
    description: "Complete businesses, franchises, opportunities",
  },
  {
    id: "real-estate",
    name: "HomeScout",
    icon: Home,
    description: "Homes, land, commercial properties",
  },
  { id: "vehicles", name: "Vehicles", icon: Car, description: "Cars, trucks, motorcycles, boats" },
  {
    id: "construction",
    name: "Construction Equipment",
    icon: Wrench,
    description: "Heavy machinery, tools, equipment",
  },
  {
    id: "building-materials",
    name: "Building Materials & Surfaces",
    icon: Layers3,
    description: "Profile catalogs for stone, onyx, and project materials",
  },
  {
    id: "tools",
    name: "Tools & Hardware",
    icon: Wrench,
    description: "Professional tools, hardware",
  },
  {
    id: "furniture",
    name: "Furniture & Home",
    icon: Home,
    description: "Quality furniture and home goods",
  },
  {
    id: "farm",
    name: "Farm Equipment",
    icon: Trees,
    description: "Agricultural equipment and livestock",
  },
  {
    id: "business-equipment",
    name: "Business Equipment",
    icon: Briefcase,
    description: "Office and commercial equipment",
  },
  {
    id: "electronics",
    name: "Electronics",
    icon: Smartphone,
    description: "High-end electronics and technology",
  },
  {
    id: "sports",
    name: "Sports & Recreation",
    icon: Trophy,
    description: "Premium sports and recreation equipment",
  },
  {
    id: "collectibles",
    name: "Art & Collectibles",
    icon: Palette,
    description: "Artwork, antiques, collectibles",
  },
  {
    id: "jewelry",
    name: "Jewelry & Luxury",
    icon: Gem,
    description: "Fine jewelry and luxury items",
  },
  {
    id: "metals",
    name: "Metals Exchange",
    icon: Coins,
    description: "Physical gold/silver and more (USD)",
  },
  {
    id: "local-food",
    name: "Local Food & Artisan",
    icon: Package,
    description: "Local foods and handmade goods",
  },
  {
    id: "other",
    name: "Other High-Value Items",
    icon: Package,
    description: "Other premium equipment and valuables",
  },
];

function isSellFormCategorySlug(value: string): value is SellFormCategorySlug {
  return (
    value !== "real-estate" &&
    value !== "metals" &&
    value !== "building-materials" &&
    value in SHARED_SELL_CATEGORY_FIELDS
  );
}

const RENTAL_PORTALS: Array<{
  id: Exclude<ExchangePortalSlug, "">;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: typeof Building2;
}> = [
  {
    id: "rental-property",
    title: "Rental Property",
    description: "Residential and commercial rentals that stay separate from HomeScout Listings.",
    href: "/exchange/rental-property",
    cta: "Browse rental property",
    icon: Building2,
  },
  {
    id: "rental-equipment",
    title: "Rental Equipment",
    description:
      "Short-term and long-term equipment rental inventory for tools, machines, and fleets.",
    href: "/exchange/rental-equipment",
    cta: "Browse rental equipment",
    icon: Wrench,
  },
];

const RENTAL_PROPERTY_FIELDS: SellField[] = [
  {
    key: "propertyUse",
    label: "Property Use",
    placeholder: "Choose residential or commercial",
    required: true,
    options: [
      { value: "residential", label: "Residential" },
      { value: "commercial", label: "Commercial" },
    ],
  },
  {
    key: "propertyType",
    label: "Property Type",
    placeholder: "House, apartment, office, warehouse",
    required: true,
  },
  {
    key: "leaseTerm",
    label: "Lease Term",
    placeholder: "Month-to-month, 12 months, NNN, flexible",
    required: true,
  },
  {
    key: "availability",
    label: "Availability",
    placeholder: "Available now, available next month, build-out pending",
    required: true,
  },
];

const RENTAL_EQUIPMENT_FIELDS: SellField[] = [
  {
    key: "rentalCadence",
    label: "Rental Cadence",
    placeholder: "Day, week, month, project-based",
    required: true,
    options: [
      { value: "daily", label: "Daily" },
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "project", label: "Project-Based" },
    ],
  },
  {
    key: "availability",
    label: "Availability",
    placeholder: "In yard now, available after current rental, seasonal",
    required: true,
  },
  {
    key: "delivery",
    label: "Delivery / Pickup",
    placeholder: "Pickup only, delivery available, operator included",
    required: true,
  },
];

export default function Exchange() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [activePortal, setActivePortal] = useState<ExchangePortalSlug>("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [priceRange, setPriceRange] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [contactItem, setContactItem] = useState<ExchangeItem | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryOffer, setInquiryOffer] = useState("");

  // Sales section filters
  const [salesSearchQuery, setSalesSearchQuery] = useState("");
  const [salesCategory, setSalesCategory] = useState("");
  const [dealType, setDealType] = useState("");
  const [salesSortBy, setSalesSortBy] = useState("newest");

  const [route, navigate] = useLocation();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const categoryParam = String(params.get("category") || params.get("cat") || "").trim();
      const tabParam = String(params.get("tab") || "").trim();
      const portalParam = String(params.get("portal") || "").trim();

      if (tabParam && (tabParam === "browse" || tabParam === "sell")) {
        setActiveTab(tabParam);
      }

      if (portalParam === "rental-property" || portalParam === "rental-equipment") {
        setActivePortal(portalParam);
        if (!tabParam) {
          setActiveTab("sell");
        }
        if (portalParam === "rental-property") {
          setSellCategorySlug("real-estate");
        } else {
          setSellCategorySlug("construction");
        }
      }

      if (categoryParam) {
        setSelectedCategory(categoryParam);
      }
    } catch {
      // ignore malformed query
    }
  }, []);

  // Real estate has its own portal (HomeScout). Keep the Exchange category for discoverability,
  // but route users into the dedicated surface.
  useEffect(() => {
    if (selectedCategory === "real-estate") {
      navigate("/homescout-listings");
    }
  }, [selectedCategory, navigate]);

  const locationCtx = useLocationContext();
  const stateCode = locationCtx.stateCode as string | undefined;
  const countyFips = locationCtx.countyFips as string | undefined;
  const countyCommitted = hasCountyContext(locationCtx as any);
  const [searchScope, setSearchScope] = useState<ExchangeSearchScope>(
    countyCommitted ? "local" : stateCode ? "state" : "nationwide"
  );

  useEffect(() => {
    if (searchScope === "local" && !countyCommitted) {
      setSearchScope(stateCode ? "state" : "nationwide");
      return;
    }
    if (searchScope === "state" && !stateCode) {
      setSearchScope("nationwide");
    }
  }, [searchScope, countyCommitted, stateCode]);

  // Sell tab draft state (prefill from Scout)
  const [sellTitle, setSellTitle] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellDescription, setSellDescription] = useState("");
  const [sellLocation, setSellLocation] = useState("");
  const [sellImages, setSellImages] = useState<string[]>([]);
  const [sellCategorySlug, setSellCategorySlug] = useState<ExchangeCategorySlug | "">("");
  const [sellSpecs, setSellSpecs] = useState<Record<string, string>>({});
  const [vehicleVinDecodePending, setVehicleVinDecodePending] = useState(false);

  // Set / Collection mode (Tools + Collectibles)
  type SetItem = { name: string; description: string; price: string; imageUrl: string };
  const [isSetMode, setIsSetMode] = useState(false);
  const [setItems, setSetItems] = useState<SetItem[]>([]);
  const [setItemUploadingIdx, setSetItemUploadingIdx] = useState<number | null>(null);
  const isSetCategory = sellCategorySlug === "tools" || sellCategorySlug === "collectibles";
  const addSetItem = () =>
    setSetItems((prev) => [...prev, { name: "", description: "", price: "", imageUrl: "" }]);
  const removeSetItem = (idx: number) => setSetItems((prev) => prev.filter((_, i) => i !== idx));
  const updateSetItem = (idx: number, patch: Partial<SetItem>) =>
    setSetItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  const [cottageFoodAttestation, setCottageFoodAttestation] = useState(false);
  const [hasScoutDraft, setHasScoutDraft] = useState(false);
  const selectedSellFlow =
    sellCategorySlug !== "" ? SHARED_SELL_CATEGORY_FLOWS[sellCategorySlug] : null;
  const baseSellFields =
    sellCategorySlug !== "" && isSellFormCategorySlug(sellCategorySlug)
      ? SHARED_SELL_CATEGORY_FIELDS[sellCategorySlug]
      : [];
  const selectedSellFields =
    sellCategorySlug === "real-estate" && activePortal === "rental-property"
      ? RENTAL_PROPERTY_FIELDS
      : activePortal === "rental-equipment"
        ? [...baseSellFields, ...RENTAL_EQUIPMENT_FIELDS]
        : baseSellFields;

  const decodeVehicleVin = async () => {
    const rawVin = String(sellSpecs.vin || "")
      .trim()
      .toUpperCase();
    if (rawVin.length !== 17) {
      toast({
        title: "VIN must be 17 characters",
        description: "Enter a full VIN to auto-fill vehicle details.",
        variant: "destructive",
      });
      return;
    }

    setVehicleVinDecodePending(true);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(rawVin)}?format=json`
      );
      if (!res.ok) throw new Error("VIN service unavailable");
      const payload = await res.json().catch(() => null);
      const row = payload?.Results?.[0] || {};
      const make = String(row?.Make || "").trim();
      const model = String(row?.Model || "").trim();
      const year = String(row?.ModelYear || "").trim();

      setSellSpecs((prev) => ({
        ...prev,
        vin: rawVin,
        make: make || prev.make || "",
        model: model || prev.model || "",
        year: year || prev.year || "",
      }));

      if (!sellTitle.trim() && year && make && model) {
        setSellTitle(`${year} ${make} ${model}`.trim());
      }

      toast({
        title: "VIN decoded",
        description: "Vehicle details were auto-filled.",
      });
    } catch (error) {
      toast({
        title: "VIN decode failed",
        description: formatUserFacingErrorMessage(error, "Fill details manually and continue."),
        variant: "destructive",
      });
    } finally {
      setVehicleVinDecodePending(false);
    }
  };

  const { data: marketplaceCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/marketplace/categories"],
    retry: false,
  });

  const exchangeSlugToMarketplaceCategoryName: Record<string, string> = useMemo(
    () => SHARED_EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME,
    []
  );

  const resolveMarketplaceCategoryId = useMemo(() => {
    const byName = new Map<string, string>();
    for (const c of marketplaceCategories || []) {
      const name = String((c as any)?.name || "")
        .trim()
        .toLowerCase();
      const id = String((c as any)?.id || "").trim();
      if (name && id) byName.set(name, id);
    }

    return (exchangeSlug: string): string | null => {
      const desiredName = exchangeSlugToMarketplaceCategoryName[exchangeSlug] || "";
      if (!desiredName) return null;
      return byName.get(desiredName.toLowerCase()) || null;
    };
  }, [exchangeSlugToMarketplaceCategoryName, marketplaceCategories]);

  // Fetch exchange items
  const { data: items, isLoading } = useQuery<ExchangeItem[]>({
    queryKey: [
      "/api/exchange/items",
      selectedCategory,
      searchQuery,
      sortBy,
      priceRange,
      conditionFilter,
      searchScope,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "all") {
        params.append("categoryId", selectedCategory);
      }
      // Exchange can broaden beyond local. Scope controls how strongly locality is applied.
      if (searchScope === "local") {
        if (stateCode) params.append("stateCode", stateCode);
        if (countyFips) params.append("countyFips", countyFips);
      } else if (searchScope === "state") {
        if (stateCode) params.append("stateCode", stateCode);
      }
      // Search query support
      if (searchQuery) params.append("search", searchQuery);
      if (sortBy) params.append("sort", sortBy);
      if (priceRange) {
        const raw = String(priceRange);
        if (raw.endsWith("+")) {
          const min = Number(raw.slice(0, -1));
          if (Number.isFinite(min)) params.append("priceMin", String(min));
        } else if (raw.includes("-")) {
          const [minRaw, maxRaw] = raw.split("-", 2);
          const min = Number(minRaw);
          const max = Number(maxRaw);
          if (Number.isFinite(min)) params.append("priceMin", String(min));
          if (Number.isFinite(max)) params.append("priceMax", String(max));
        }
      }
      if (conditionFilter && conditionFilter !== "any") params.append("condition", conditionFilter);

      const response = await fetch(`/api/exchange/items?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch items");
      const json = await response.json();

      return json;
    },
    enabled: activeTab === "browse",
  });

  const { data: categoryCountItems = [] } = useQuery<ExchangeItem[]>({
    queryKey: ["/api/exchange/items", "category-counts", stateCode, countyFips, searchScope],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchScope === "local") {
        if (stateCode) params.append("stateCode", stateCode);
        if (countyFips) params.append("countyFips", countyFips);
      } else if (searchScope === "state") {
        if (stateCode) params.append("stateCode", stateCode);
      }
      const response = await fetch(`/api/exchange/items?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch category counts");
      return response.json();
    },
    enabled: activeTab === "browse" || activeTab === "categories",
  });

  const createListingMutation = useMutation({
    mutationFn: async (body: any) => {
      return apiRequest("POST", "/api/marketplace/listings", body);
    },
    onSuccess: () => {
      setSellPrice("");
      setSellDescription("");
      setSellLocation("");
      setSellImages([]);
      setSellCategorySlug("");
      setSellSpecs({});
      toast({
        title: "Listing submitted",
        description: "Your listing was submitted and is pending approval before going live.",
      });

      queryClient.invalidateQueries({
        queryKey: [
          "/api/exchange/items",
          selectedCategory,
          searchQuery,
          sortBy,
          priceRange,
          conditionFilter,
        ],
      });

      setActiveTab("browse");
    },
    onError: (error: any) => {
      const message =
        (error && (error.message || (error as any).toString())) || "Failed to create listing";
      toast({
        title: "Could not publish listing",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Fetch Exchange promotions (all business types)
  const { data: exchangePromotions, isLoading: exchangePromotionsLoading } = useQuery<
    ExchangePromotion[]
  >({
    queryKey: ["/api/exchange/promotions", salesSearchQuery, salesSortBy, countyFips],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (salesSearchQuery) params.append("search", salesSearchQuery);
      if (salesSortBy) params.append("sort", salesSortBy);
      if (countyFips) params.append("county", countyFips);

      const response = await fetch(`/api/exchange/promotions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch promotions");
      return response.json();
    },
    enabled: activeTab === "promotions",
  });

  // Favorites / watchlist
  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ["/api/marketplace/favorites"],
    queryFn: async () => apiRequest("GET", "/api/marketplace/favorites"),
    enabled: isAuthenticated,
  });

  const favoriteListingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const favorite of favorites || []) {
      const idCandidate =
        favorite?.listingId ??
        favorite?.listing_id ??
        favorite?.marketplaceListingId ??
        favorite?.marketplace_listing_id;
      if (idCandidate) ids.add(String(idCandidate));
    }
    return ids;
  }, [favorites]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (payload: { listingId: string; wasSaved: boolean }) => {
      if (payload.wasSaved) {
        return apiRequest("DELETE", `/api/marketplace/favorites/${payload.listingId}`);
      }
      return apiRequest("POST", "/api/marketplace/favorites", { listingId: payload.listingId });
    },
    onSuccess: (_res, payload) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/favorites"] });
      toast({
        title: payload.wasSaved ? "Removed from saved" : "Saved listing",
        description: payload.wasSaved
          ? "Listing removed from your watchlist."
          : "Listing added to your watchlist.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not update saved listings",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const inquiryMutation = useMutation({
    mutationFn: async (payload: { listingId: string; message: string; offerAmount?: number }) => {
      return apiRequest("POST", "/api/marketplace/inquiries", payload);
    },
    onSuccess: () => {
      toast({
        title: "Request sent",
        description: "Your request is now waiting for seller review.",
      });
      setContactItem(null);
      setInquiryMessage("");
      setInquiryOffer("");
    },
    onError: (error: any) => {
      toast({
        title: "Could not send request",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  // Fetch company promotions
  const { data: companyPromotions, isLoading: companyPromotionsLoading } = useQuery<
    CompanyPromotion[]
  >({
    queryKey: ["/api/exchange/company-promotions", salesSearchQuery, dealType, salesSortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (salesSearchQuery) params.append("search", salesSearchQuery);
      if (dealType) params.append("dealType", dealType);
      if (salesSortBy) params.append("sort", salesSortBy);

      const response = await fetch(`/api/exchange/company-promotions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch company promotions");
      return response.json();
    },
    enabled: activeTab === "sales",
  });

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!items) return [];

    const matches = items.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const isSaved = favoriteListingIds.has(String(item.id));
      const matchesSaved = !savedOnly || isSaved;
      return matchesSearch && matchesSaved;
    });

    const shippingReady = (item: ExchangeItem) =>
      item.isLocalPickupOnly !== true || Number.isFinite(Number(item.shippingCost));

    const isStateMatch = (item: ExchangeItem) =>
      Boolean(
        stateCode && String(item.state || "").toUpperCase() === String(stateCode).toUpperCase()
      );

    const isCountyMatch = (item: ExchangeItem) => {
      if (!countyCommitted) return false;
      const locationText = `${item.location} ${item.county || ""}`.toLowerCase();
      const countyName = String(locationCtx.countyName || "")
        .trim()
        .toLowerCase();
      return Boolean(countyName && locationText.includes(countyName));
    };

    return [...matches].sort((a, b) => {
      if (searchScope === "local") {
        const aLocal = isCountyMatch(a) ? 2 : isStateMatch(a) ? 1 : 0;
        const bLocal = isCountyMatch(b) ? 2 : isStateMatch(b) ? 1 : 0;
        if (aLocal !== bLocal) return bLocal - aLocal;
      }

      if (searchScope === "state") {
        const aState = isStateMatch(a) ? 1 : 0;
        const bState = isStateMatch(b) ? 1 : 0;
        if (aState !== bState) return bState - aState;
      }

      if (searchScope === "nationwide") {
        const aShipping = shippingReady(a) ? 1 : 0;
        const bShipping = shippingReady(b) ? 1 : 0;
        if (aShipping !== bShipping) return bShipping - aShipping;
      }

      return 0;
    });
  }, [
    items,
    searchQuery,
    savedOnly,
    favoriteListingIds,
    searchScope,
    stateCode,
    countyCommitted,
    locationCtx.countyName,
  ]);

  const categoryAvailability = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of categoryCountItems || []) {
      const key = String(item?.category || "").trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [categoryCountItems]);

  const sortedExchangeCategories = useMemo(() => {
    return [...EXCHANGE_CATEGORIES].sort((a, b) => {
      const aCount = categoryAvailability.get(a.id) || 0;
      const bCount = categoryAvailability.get(b.id) || 0;
      const aAvailable = aCount > 0 ? 1 : 0;
      const bAvailable = bCount > 0 ? 1 : 0;
      if (aAvailable !== bAvailable) return bAvailable - aAvailable;
      if (aCount !== bCount) return bCount - aCount;
      return a.name.localeCompare(b.name);
    });
  }, [categoryAvailability]);

  const getCategoryHref = (categoryId: string) => {
    if (categoryId === "metals") return "/exchange/metals";
    if (categoryId === "real-estate") return "/homescout-listings";
    // All other categories now have dedicated pages
    const dedicatedSlugs = [
      "business",
      "vehicles",
      "construction",
      "building-materials",
      "tools",
      "furniture",
      "farm",
      "business-equipment",
      "electronics",
      "sports",
      "collectibles",
      "jewelry",
      "local-food",
      "other",
    ];
    if (dedicatedSlugs.includes(categoryId)) return `/exchange/${encodeURIComponent(categoryId)}`;
    return `/exchange?tab=browse&category=${encodeURIComponent(categoryId)}`;
  };

  const getCategoryIcon = (categoryId: string) => {
    const category = EXCHANGE_CATEGORIES.find((cat) => cat.id === categoryId);
    return category ? category.icon : Package;
  };

  const formatPrice = (price: number | null) => {
    if (price == null || !Number.isFinite(price) || price < 0) return "Request quote";
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `$${(price / 1000).toFixed(0)}K`;
    }
    return `$${price.toLocaleString()}`;
  };

  const getConditionBadge = (condition: string) => {
    const colors = {
      new: "bg-green-500",
      like_new: "bg-blue-500",
      "like-new": "bg-blue-500",
      good: "bg-yellow-500",
      fair: "bg-ts-orange",
    };
    return colors[condition as keyof typeof colors] || "bg-tsBg/10";
  };

  const shareLink = async (url: string, title: string, text?: string) => {
    await share({
      path: url,
      title,
      text: text || `Check out ${title} on TradeScout Exchange.`,
      contextLabel: "Share link",
    });
  };

  // Allow Scout to prefill the sell form via
  // /exchange?tab=sell&title=...&description=...&price=...&loc=...
  useEffect(() => {
    if (!route) return;

    const queryIndex = route.indexOf("?");
    if (queryIndex === -1) return;

    const search = route.slice(queryIndex + 1);
    const params = new URLSearchParams(search);

    const tab = params.get("tab");
    const title = params.get("title");
    const description = params.get("description");
    const price = params.get("price");
    const loc = params.get("loc");

    if (tab === "sell") {
      setActiveTab("sell");
    }

    if (title) setSellTitle(title);
    if (description) setSellDescription(description);
    if (price) setSellPrice(price);
    if (loc) setSellLocation(loc);

    // Scout-driven drafts always arrive with the sell tab preselected
    // and at least one of these fields populated. Mark a one-shot
    // "draft created" state so users understand why the form is filled.
    if (tab === "sell" && (title || description || price || loc)) {
      setHasScoutDraft(true);
    }
  }, [route]);

  const activeCategoryMeta = EXCHANGE_CATEGORIES.find((cat) => cat.id === selectedCategory);
  const localLabel = (() => {
    if (!countyCommitted) return "Set home location";
    if (locationCtx.countyName && stateCode) return `${locationCtx.countyName}, ${stateCode}`;
    if (locationCtx.label) return locationCtx.label;
    if (stateCode) return stateCode;
    return "Home county set";
  })();

  const scopeLabel =
    searchScope === "local"
      ? `Scope: Near me (${localLabel})`
      : searchScope === "state"
        ? `Scope: My state${stateCode ? ` (${stateCode})` : ""}`
        : "Scope: Nationwide";

  const formatListedTime = (dateLike: string) => {
    const ts = new Date(dateLike).getTime();
    if (!Number.isFinite(ts)) return "";
    const diffHours = Math.floor((Date.now() - ts) / (1000 * 60 * 60));
    if (diffHours < 1) return "Just listed";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return new Date(dateLike).toLocaleDateString();
  };

  return (
    <>
      <SEOHelmet
        title="TradeScout Exchange | Buy, Sell, and Discover Local Listings"
        description="Buy, sell, and discover local listings across categories on TradeScout Exchange. Browse local items, post what you want to sell, and explore hyperlocal marketplace activity."
        keywords="tradescout exchange, buy and sell locally, local marketplace, local listings, sell items locally"
        canonical="https://www.thetradescout.com/exchange"
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6">
        <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white">Exchange marketplace</h1>
              <p className="mt-1 text-xs sm:text-sm text-white/70">
                Browse listings, then switch scope to search near you, across your state, or
                nationwide.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                <Button
                  size="sm"
                  variant={searchScope === "local" ? "default" : "ghost"}
                  className={
                    searchScope === "local"
                      ? "bg-ts-orange text-black hover:bg-ts-orange/90"
                      : "text-white/70 hover:text-white"
                  }
                  disabled={!countyCommitted}
                  onClick={() => setSearchScope("local")}
                >
                  Near me
                </Button>
                <Button
                  size="sm"
                  variant={searchScope === "state" ? "default" : "ghost"}
                  className={
                    searchScope === "state"
                      ? "bg-ts-orange text-black hover:bg-ts-orange/90"
                      : "text-white/70 hover:text-white"
                  }
                  disabled={!stateCode}
                  onClick={() => setSearchScope("state")}
                >
                  My state
                </Button>
                <Button
                  size="sm"
                  variant={searchScope === "nationwide" ? "default" : "ghost"}
                  className={
                    searchScope === "nationwide"
                      ? "bg-ts-orange text-black hover:bg-ts-orange/90"
                      : "text-white/70 hover:text-white"
                  }
                  onClick={() => setSearchScope("nationwide")}
                >
                  Nationwide
                </Button>
              </div>
              <Badge variant="outline" className="border-white/10 text-white/70" title={scopeLabel}>
                {scopeLabel}
              </Badge>
              {isAuthenticated && (
                <Link href="/exchange/seller-dashboard">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white/80 hover:text-white hover:bg-white/10"
                  >
                    My Listings
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-4 bg-tsCard border border-white/10 rounded-xl overflow-hidden text-[10px] sm:text-[11px]">
            <TabsTrigger
              value="browse"
              className="flex items-center justify-center px-2 py-1.5 text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/10"
            >
              Browse
            </TabsTrigger>
            <TabsTrigger
              value="promotions"
              className="flex items-center justify-center px-2 py-1.5 text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/10"
            >
              <Megaphone className="h-3 w-3 mr-1" />
              <span>Promos</span>
            </TabsTrigger>
            <TabsTrigger
              value="sales"
              className="flex items-center justify-center px-2 py-1.5 text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/10 relative"
            >
              <Tag className="h-3 w-3 mr-1" />
              <span>Sales</span>
              <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5">
                HOT
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="categories"
              className="flex items-center justify-center px-2 py-1.5 text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/10"
            >
              Categories
            </TabsTrigger>
            <TabsTrigger
              value="sell"
              className="flex items-center justify-center px-2 py-1.5 text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/10"
            >
              Sell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">Rental Portals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {RENTAL_PORTALS.map((portal) => {
                    const IconComponent = portal.icon;
                    return (
                      <Link key={portal.id} href={portal.href}>
                        <Card className="h-full cursor-pointer bg-tsCard/95 border-white/10 hover:border-ts-orange/30 transition-colors">
                          <CardContent className="flex h-full items-start gap-4 p-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ts-orange/15 text-ts-orange">
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold text-white">{portal.title}</h3>
                              <p className="mt-1 text-sm text-white/60">{portal.description}</p>
                              <div className="mt-3 inline-flex items-center gap-2 text-sm text-ts-orange">
                                <span>{portal.cta}</span>
                                <ArrowRight className="h-4 w-4" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">Categories</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mobile-first: avoid horizontal scrolling; wrap into a compact grid. */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  <Card
                    className={`w-full bg-tsCard/95 border-white/10 hover:border-ts-orange/30 transition-colors cursor-pointer ${
                      !selectedCategory ? "border-ts-orange/30" : ""
                    }`}
                    onClick={() => {
                      setSelectedCategory("");
                      setActiveTab("browse");
                      navigate("/exchange?tab=browse");
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-ts-orange/15 rounded-lg flex items-center justify-center">
                          <Package className="h-5 w-5 text-ts-orange" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">All</div>
                          <div className="hidden sm:block text-[11px] text-white/60 truncate">
                            Browse everything
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {sortedExchangeCategories.map((category) => {
                    const IconComponent = category.icon;
                    const active = selectedCategory === category.id;
                    const availableCount = categoryAvailability.get(category.id) || 0;
                    return (
                      <Card
                        key={category.id}
                        className={`w-full bg-tsCard/95 border-white/10 hover:border-ts-orange/30 transition-colors cursor-pointer ${
                          active ? "border-ts-orange/30" : ""
                        }`}
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setActiveTab("browse");
                          navigate(getCategoryHref(category.id));
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-ts-orange/15 rounded-lg flex items-center justify-center">
                              <IconComponent className="h-5 w-5 text-ts-orange" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-white truncate">
                                {category.name}
                              </div>
                            </div>
                            <div className="shrink-0">
                              <Badge
                                variant="outline"
                                className="border-white/15 text-white/70 text-[10px]"
                              >
                                {availableCount}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-end gap-2 text-xs text-white/60">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-white/10 text-white/70"
                    onClick={() => setActiveTab("sell")}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Sell
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-[260px,1fr] gap-4">
              <Card className="bg-tsCard border-white/10 h-fit xl:sticky xl:top-20">
                <CardHeader className="pb-1">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Filter className="h-4 w-4 text-ts-orange" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/60" />
                    <Input
                      placeholder="Search items"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-10 bg-white/5 border-white/10 text-white text-sm"
                    />
                  </div>

                  <Select value={priceRange} onValueChange={setPriceRange}>
                    <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm">
                      <SelectValue placeholder="Price Range" />
                    </SelectTrigger>
                    <SelectContent className="bg-tsCard border-white/10">
                      <SelectItem value="">Any Price</SelectItem>
                      <SelectItem value="0-1000">Under $1K</SelectItem>
                      <SelectItem value="1000-5000">$1K - $5K</SelectItem>
                      <SelectItem value="5000-25000">$5K - $25K</SelectItem>
                      <SelectItem value="25000-100000">$25K - $100K</SelectItem>
                      <SelectItem value="100000+">$100K+</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={conditionFilter} onValueChange={setConditionFilter}>
                    <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm">
                      <SelectValue placeholder="Condition" />
                    </SelectTrigger>
                    <SelectContent className="bg-tsCard border-white/10">
                      <SelectItem value="any">Any Condition</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="like_new">Like New</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent className="bg-tsCard border-white/10">
                      <SelectItem value="date_desc">Newest First</SelectItem>
                      <SelectItem value="price_asc">Price: Low to High</SelectItem>
                      <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 border-white/15 text-white/70 text-sm"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCategory("");
                        setPriceRange("");
                        setConditionFilter("");
                        setSortBy("date_desc");
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      className="flex-1 h-9 bg-ts-orange hover:bg-ts-orange-dark text-sm"
                      onClick={() => setActiveTab("sell")}
                    >
                      Sell
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-tsCard px-3 py-2">
                  <div className="text-sm text-white/70">
                    <span className="font-semibold text-white">{filteredItems?.length ?? 0}</span>{" "}
                    results
                    {activeCategoryMeta ? (
                      <span className="text-white/60"> in {activeCategoryMeta.name}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={savedOnly ? "default" : "outline"}
                      className={
                        savedOnly
                          ? "h-7 bg-ts-orange hover:bg-ts-orange-dark text-white"
                          : "h-7 border-white/15 text-white/70"
                      }
                      onClick={() => setSavedOnly((prev) => !prev)}
                    >
                      <Heart className="h-3 w-3 mr-1" />
                      {savedOnly ? "Saved only" : "All listings"}
                    </Button>
                    <div className="text-xs text-white/60">Marketplace-style local board</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <Card key={i} className="bg-tsCard border-white/10 animate-pulse">
                        <div className="aspect-square bg-white/10 rounded-t-lg"></div>
                        <CardContent className="p-3">
                          <div className="h-4 bg-white/10 rounded mb-2"></div>
                          <div className="h-4 bg-white/10 rounded mb-2"></div>
                          <div className="h-3 bg-white/10 rounded w-2/3"></div>
                        </CardContent>
                      </Card>
                    ))
                  ) : filteredItems?.length > 0 ? (
                    filteredItems.map((item) => {
                      const IconComponent = getCategoryIcon(item.category);
                      const isProfileOffer = item.sourceType === "profile_offer";
                      const isProfileCatalog = item.sourceType === "profile_catalog";
                      const isProfileLinked = isProfileOffer || isProfileCatalog;
                      const detailCategory = item.category || "other";
                      const detailPath = `/exchange/${detailCategory}/${item.id}`;
                      return (
                        <Card
                          key={item.id}
                          className="bg-tsCard border-white/10 hover:border-ts-orange/30 transition-colors overflow-hidden"
                        >
                          <div
                            className="relative cursor-pointer"
                            onClick={() => navigate(detailPath)}
                          >
                            {item.images && item.images.length > 0 ? (
                              <div className="aspect-square bg-tsCard overflow-hidden">
                                <img
                                  src={item.images[0]}
                                  alt={item.title}
                                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                />
                              </div>
                            ) : (
                              <div className="aspect-square bg-white/5 flex items-center justify-center">
                                <IconComponent className="h-12 w-12 text-white/60" />
                              </div>
                            )}
                            {isProfileCatalog ? (
                              <Badge className="absolute top-2 right-2 bg-sky-600">
                                Profile catalog
                              </Badge>
                            ) : item.featured ? (
                              <Badge className="absolute top-2 right-2 bg-ts-orange">
                                Featured
                              </Badge>
                            ) : null}
                            {!isProfileCatalog && (
                              <Badge
                                className={`absolute top-2 left-2 ${getConditionBadge(item.condition)}`}
                              >
                                {item.condition}
                              </Badge>
                            )}
                          </div>
                          <CardContent className="p-3">
                            <p className="text-lg sm:text-xl font-bold text-white mb-1">
                              {formatPrice(item.price)}
                            </p>
                            <h3
                              className="font-semibold text-white mb-1 line-clamp-2 leading-tight text-sm cursor-pointer hover:text-ts-orange transition-colors"
                              onClick={() => navigate(detailPath)}
                            >
                              {item.title}
                            </h3>
                            <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                <span className="line-clamp-1">{item.location}</span>
                              </div>
                              <span>
                                {isProfileCatalog
                                  ? "Managed request"
                                  : formatListedTime(item.createdAt)}
                              </span>
                            </div>

                            {!isProfileCatalog && (
                              <div className="mb-2 flex flex-wrap gap-1">
                                {item.isLocalPickupOnly ? (
                                  <Badge
                                    variant="outline"
                                    className="border-white/10 text-[10px] text-white/65"
                                  >
                                    Local pickup
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-500/30 text-[10px] text-emerald-300"
                                  >
                                    Shipping available
                                  </Badge>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex items-center">
                                <div className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center mr-2">
                                  <span className="text-[11px] text-white">
                                    {item.seller.name[0]}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[11px] text-white/70 truncate">
                                    {item.seller.name}
                                  </p>
                                  <div className="flex items-center text-[10px] text-white/60">
                                    {item.seller.verified ? (
                                      <span className="text-emerald-400">Verified seller</span>
                                    ) : (
                                      <span>{isProfileCatalog ? "Business profile" : "Seller profile"}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {!isProfileLinked && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`h-8 w-8 p-0 ${
                                      favoriteListingIds.has(String(item.id))
                                        ? "text-rose-400 hover:text-rose-300"
                                        : "text-white/70 hover:text-white"
                                    }`}
                                    onClick={() => {
                                      if (!isAuthenticated) {
                                        navigate("/pre-scout-setup?mode=signin");
                                        return;
                                      }
                                      const wasSaved = favoriteListingIds.has(String(item.id));
                                      toggleFavoriteMutation.mutate({
                                        listingId: String(item.id),
                                        wasSaved,
                                      });
                                    }}
                                  >
                                    <Heart
                                      className={`h-3 w-3 ${
                                        favoriteListingIds.has(String(item.id))
                                          ? "fill-current"
                                          : ""
                                      }`}
                                    />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-white/70 hover:text-white"
                                  onClick={() =>
                                    shareLink(
                                      detailPath,
                                      item.title || "Exchange listing",
                                      item.description
                                    )
                                  }
                                >
                                  <Share2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-8 px-2.5 bg-ts-orange hover:bg-ts-orange-dark text-xs"
                                  onClick={() => {
                                    if (isProfileLinked) {
                                      navigate(detailPath);
                                      return;
                                    }
                                    if (!isAuthenticated) {
                                      navigate("/pre-scout-setup?mode=signin");
                                      return;
                                    }
                                    setContactItem(item);
                                    setInquiryMessage(
                                      `Hi, I would like a quote for \"${item.title}\".`
                                    );
                                  }}
                                >
                                  {isProfileOffer
                                    ? "Buy"
                                    : isProfileCatalog
                                      ? "View Catalog"
                                      : "Request Quote"}
                                </Button>
                              </div>
                            </div>

                            <div className="mt-2 text-[10px] text-white/60 flex items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {item.views}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {item.favorites}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="col-span-full">
                      <EmptyState
                        icon={<Search />}
                        title="No items found"
                        description="Try broader filters or switch categories."
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="promotions" className="space-y-6">
            {/* Promotions Search */}
            <Card className="bg-tsCard border-white/10">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-white/60" />
                    <Input
                      placeholder="Search promotions..."
                      value={salesSearchQuery}
                      onChange={(e) => setSalesSearchQuery(e.target.value)}
                      className="pl-10 bg-white/10 border-white/15 text-white"
                    />
                  </div>

                  <Select value={salesSortBy} onValueChange={setSalesSortBy}>
                    <SelectTrigger className="bg-white/10 border-white/15 text-white">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent className="bg-tsCard border-white/10">
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="ending_soon">Ending Soon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Promotions Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <Megaphone className="h-6 w-6 mr-2 text-ts-orange" />
                  Promotions
                </h2>
                <Button
                  className="bg-ts-orange hover:bg-ts-orange-dark"
                  onClick={() => navigate("/promotions")}
                >
                  Create Promotion
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exchangePromotionsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="bg-tsCard border-white/10 animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-white/10 rounded mb-4"></div>
                        <div className="h-6 bg-white/10 rounded mb-2"></div>
                        <div className="h-4 bg-white/10 rounded mb-4"></div>
                        <div className="h-4 bg-white/10 rounded w-3/4"></div>
                      </CardContent>
                    </Card>
                  ))
                ) : exchangePromotions && exchangePromotions.length > 0 ? (
                  exchangePromotions.map((promo) => (
                    <Card
                      key={promo.id}
                      className="bg-tsCard border-white/10 hover:border-ts-orange/30 transition-colors"
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-ts-orange rounded-lg flex items-center justify-center mr-3">
                              <Megaphone className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">{promo.businessName}</h3>
                              {promo.isFeatured ? (
                                <Badge className="mt-1 bg-ts-orange/20 text-ts-orange border-ts-orange/30 text-xs">
                                  Featured
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          {promo.expiresAt && (
                            <Badge variant="outline" className="border-ts-orange/30 text-ts-orange">
                              <Clock className="h-3 w-3 mr-1" />
                              Expires {new Date(promo.expiresAt).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>

                        <h4 className="text-lg font-semibold text-white mb-2">{promo.title}</h4>
                        <p className="text-white/70 text-sm mb-3">{promo.description}</p>

                        <div className="bg-ts-orange/10 border border-ts-orange/30 rounded-lg p-3 mb-4">
                          <div className="flex items-center mb-2">
                            <Percent className="h-4 w-4 text-ts-orange mr-2" />
                            <span className="text-ts-orange font-semibold">
                              {promo.offerDetails}
                            </span>
                          </div>
                          {promo.promoCode && (
                            <div className="flex items-center justify-between bg-white/10 rounded p-2">
                              <span className="text-sm text-white/70">Promo Code:</span>
                              <div className="flex items-center">
                                <code className="bg-white/10 px-2 py-1 rounded text-ts-orange font-mono text-sm mr-2">
                                  {promo.promoCode}
                                </code>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-white/60">
                            {promo.viewCount} views • {promo.leadCount} leads
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white/60 hover:text-white"
                              onClick={() =>
                                shareLink(
                                  `/exchange?tab=promotions&promo=${encodeURIComponent(promo.slug || promo.id)}`,
                                  promo.title,
                                  promo.description
                                )
                              }
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-ts-orange hover:bg-ts-orange-dark"
                              onClick={() => {
                                if (promo.ctaUrl) {
                                  window.open(promo.ctaUrl, "_blank", "noopener,noreferrer");
                                  return;
                                }
                                navigate("/messages");
                              }}
                            >
                              {promo.ctaLabel || "View Offer"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-3 text-center py-12">
                    <Megaphone className="h-12 w-12 text-white/60 mx-auto mb-4" />
                    <p className="text-white/60 mb-4">No promotions found.</p>
                    <Button className="bg-ts-orange hover:bg-ts-orange-dark">
                      Create the first promotion
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            {/* Store Sales Search */}
            <Card className="bg-tsCard border-white/10">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-white/60" />
                    <Input
                      placeholder="Search store sales and deals..."
                      value={salesSearchQuery}
                      onChange={(e) => setSalesSearchQuery(e.target.value)}
                      className="pl-10 bg-white/10 border-white/15 text-white"
                    />
                  </div>

                  <Select value={salesCategory} onValueChange={setSalesCategory}>
                    <SelectTrigger className="bg-white/10 border-white/15 text-white">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-tsCard border-white/10">
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="tools">Tools & Hardware</SelectItem>
                      <SelectItem value="lumber">Lumber & Materials</SelectItem>
                      <SelectItem value="equipment">Equipment & Machinery</SelectItem>
                      <SelectItem value="electrical">Electrical Supplies</SelectItem>
                      <SelectItem value="plumbing">Plumbing Supplies</SelectItem>
                      <SelectItem value="paint">Paint & Finishing</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={dealType} onValueChange={setDealType}>
                    <SelectTrigger className="bg-white/10 border-white/15 text-white">
                      <SelectValue placeholder="Deal Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-tsCard border-white/10">
                      <SelectItem value="all">All Deals</SelectItem>
                      <SelectItem value="percentage_off">Percentage Off</SelectItem>
                      <SelectItem value="dollar_off">Dollar Amount Off</SelectItem>
                      <SelectItem value="bogo">Buy One Get One</SelectItem>
                      <SelectItem value="clearance">Clearance</SelectItem>
                      <SelectItem value="contractor_special">Business Special</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={salesSortBy} onValueChange={setSalesSortBy}>
                    <SelectTrigger className="bg-white/10 border-white/15 text-white">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent className="bg-tsCard border-white/10">
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="ending_soon">Ending Soon</SelectItem>
                      <SelectItem value="biggest_savings">Biggest Savings</SelectItem>
                      <SelectItem value="most_popular">Most Popular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Store Sales Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <Building className="h-6 w-6 mr-2 text-blue-500" />
                  Store Sales & Deals
                </h2>
                <Button
                  variant="outline"
                  className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                >
                  Advertise with Us
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {companyPromotionsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="bg-tsCard border-white/10 animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-16 bg-white/10 rounded mb-4"></div>
                        <div className="h-6 bg-white/10 rounded mb-2"></div>
                        <div className="h-4 bg-white/10 rounded mb-4"></div>
                        <div className="h-4 bg-white/10 rounded w-3/4"></div>
                      </CardContent>
                    </Card>
                  ))
                ) : companyPromotions && companyPromotions.length > 0 ? (
                  companyPromotions.map((promotion) => (
                    <Card
                      key={promotion.id}
                      className="bg-tsCard border-white/10 hover:border-blue-500/50 transition-colors"
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center">
                            <div className="w-16 h-16 bg-tsBg rounded-lg flex items-center justify-center mr-3">
                              {promotion.companyLogo ? (
                                <img
                                  src={promotion.companyLogo}
                                  alt={promotion.companyName}
                                  className="w-12 h-12 object-contain"
                                />
                              ) : (
                                <Building className="h-8 w-8 text-white/60" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">{promotion.companyName}</h3>
                              {promotion.isFeatured && (
                                <Badge className="bg-blue-500 text-white text-xs">Featured</Badge>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="border-red-500/50 text-red-400">
                            <Clock className="h-3 w-3 mr-1" />
                            Ends {new Date(promotion.expiresAt).toLocaleDateString()}
                          </Badge>
                        </div>

                        <h4 className="text-lg font-semibold text-white mb-2">{promotion.title}</h4>
                        <p className="text-white/70 text-sm mb-3">{promotion.description}</p>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-blue-400 font-semibold text-lg">
                              {promotion.dealDetails}
                            </span>
                            {promotion.discountValue && (
                              <Badge className="bg-red-500 text-white">
                                Save{" "}
                                {promotion.dealType === "percentage_off"
                                  ? `${promotion.discountValue}%`
                                  : `$${promotion.discountValue}`}
                              </Badge>
                            )}
                          </div>
                          {promotion.originalPrice && promotion.salePrice && (
                            <div className="flex items-center space-x-2">
                              <span className="text-white/60 line-through">
                                ${promotion.originalPrice}
                              </span>
                              <span className="text-green-400 font-bold text-lg">
                                ${promotion.salePrice}
                              </span>
                            </div>
                          )}
                          {promotion.promoCode && (
                            <div className="flex items-center justify-between bg-white/10 rounded p-2 mt-2">
                              <span className="text-sm text-white/70">Use Code:</span>
                              <div className="flex items-center">
                                <code className="bg-white/10 px-2 py-1 rounded text-blue-400 font-mono text-sm mr-2">
                                  {promotion.promoCode}
                                </code>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-white/60">
                            {promotion.viewCount} views • {promotion.redemptionCount} used
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white/60 hover:text-white"
                              onClick={() =>
                                shareLink(
                                  `/exchange?tab=sales&companyPromo=${encodeURIComponent(promotion.slug || promotion.id)}`,
                                  promotion.title,
                                  promotion.description
                                )
                              }
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Shop Now
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-3 text-center py-12">
                    <Building className="h-12 w-12 text-white/60 mx-auto mb-4" />
                    <p className="text-white/60 mb-4">No store promotions available.</p>
                    <Button
                      variant="outline"
                      className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                    >
                      Partner with Us
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="text-xs text-white/60">
              Categories with live inventory are listed first. Tap any category to open its Exchange
              page.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedExchangeCategories.map((category) => {
                const IconComponent = category.icon;
                const availableCount = categoryAvailability.get(category.id) || 0;
                return (
                  <Card
                    key={category.id}
                    className="bg-tsCard border-white/10 hover:border-ts-orange/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedCategory(category.id);
                      navigate(getCategoryHref(category.id));
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                          <IconComponent className="h-6 w-6 text-ts-orange" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-white truncate">{category.name}</h3>
                          <p className="text-xs text-white/60 truncate">{category.description}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-white/15 text-white/70 text-[10px]"
                        >
                          {availableCount}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="sell" className="space-y-6">
            <Card className="bg-tsCard border-white/10">
              <CardHeader>
                <CardTitle className="text-white">List Your Item</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {activePortal === "rental-property" ? (
                  <div className="rounded-lg border border-ts-orange/40 bg-ts-orange/10 px-4 py-3 text-sm text-white/85">
                    <div className="font-semibold text-white">Rental Property Listing</div>
                    <div className="mt-1 text-white/70">
                      This flow is for residential and commercial rental property inside Exchange.
                      It stays separate from HomeScout Listings.
                    </div>
                  </div>
                ) : null}
                {activePortal === "rental-equipment" ? (
                  <div className="rounded-lg border border-ts-orange/40 bg-ts-orange/10 px-4 py-3 text-sm text-white/85">
                    <div className="font-semibold text-white">Rental Equipment Listing</div>
                    <div className="mt-1 text-white/70">
                      Use this flow for rental-ready equipment, tools, and commercial-use inventory
                      with rate and availability details.
                    </div>
                  </div>
                ) : null}

                {hasScoutDraft ? (
                  <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    Draft loaded from Scout.
                  </div>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title" className="text-white">
                        Item Title
                      </Label>
                      <Input
                        id="title"
                        placeholder={
                          selectedSellFlow?.sampleTitle ||
                          "Example: 16ft enclosed trailer with ramp"
                        }
                        className="bg-white/10 border-white/15 text-white"
                        value={sellTitle}
                        onChange={(e) => setSellTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="category" className="text-white">
                        Category
                      </Label>
                      <Select
                        value={sellCategorySlug}
                        onValueChange={(value) => {
                          const category = EXCHANGE_CATEGORIES.find((c) => c.id === value);
                          if (!category) return;
                          if (category.id === "metals") {
                            navigate("/exchange/metals");
                            return;
                          }
                          if (category.id === "real-estate" && activePortal !== "rental-property") {
                            navigate("/homescout-listings");
                            return;
                          }
                          if (category.id !== "real-estate" && !isSellFormCategorySlug(value))
                            return;
                          setSellCategorySlug(value as ExchangeCategorySlug);
                          setSellSpecs({});
                          setIsSetMode(false);
                          setSetItems([]);
                          setCottageFoodAttestation(false);
                        }}
                      >
                        <SelectTrigger className="bg-white/10 border-white/15 text-white">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-tsCard border-white/10">
                          {EXCHANGE_CATEGORIES.filter(
                            (category) => category.id !== "building-materials"
                          ).map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2 border-white/15 text-white/80 hover:bg-white/10"
                        onClick={() =>
                          navigate(
                            activePortal === "rental-property"
                              ? "/exchange/rental-property"
                              : "/homescout/new"
                          )
                        }
                      >
                        {activePortal === "rental-property"
                          ? "Open Rental Property Portal"
                          : "Sell a Home on HomeScout"}
                      </Button>
                    </div>

                    <div>
                      <Label htmlFor="price" className="text-white">
                        {activePortal === "rental-property"
                          ? "Rental Rate"
                          : activePortal === "rental-equipment"
                            ? "Rental Rate"
                            : "Price"}
                      </Label>
                      <Input
                        id="price"
                        type="number"
                        placeholder={
                          activePortal === "rental-property"
                            ? "Monthly or advertised rental rate (USD)"
                            : activePortal === "rental-equipment"
                              ? "Daily, weekly, or listed rental rate (USD)"
                              : "Asking price (USD)"
                        }
                        className="bg-white/10 border-white/15 text-white"
                        value={sellPrice}
                        onChange={(e) => setSellPrice(e.target.value)}
                      />
                    </div>

                    {sellCategorySlug !== "" &&
                      selectedSellFields.map((field: SellField) => (
                        <div key={field.key}>
                          <Label htmlFor={`spec-${field.key}`} className="text-white">
                            {field.label}
                          </Label>
                          {field.options ? (
                            <Select
                              value={sellSpecs[field.key] || ""}
                              onValueChange={(value) =>
                                setSellSpecs((prev) => ({ ...prev, [field.key]: value }))
                              }
                            >
                              <SelectTrigger className="bg-white/10 border-white/15 text-white">
                                <SelectValue placeholder={field.placeholder} />
                              </SelectTrigger>
                              <SelectContent className="bg-tsCard border-white/10">
                                {field.options.map((option: { value: string; label: string }) => (
                                  <SelectItem
                                    key={`${field.key}-${option.value}`}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={`spec-${field.key}`}
                              type={field.type || "text"}
                              placeholder={field.placeholder}
                              className="bg-white/10 border-white/15 text-white"
                              value={sellSpecs[field.key] || ""}
                              onChange={(e) =>
                                setSellSpecs((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                            />
                          )}
                          {sellCategorySlug === "vehicles" && field.key === "vin" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2 border-white/15 text-white/80 hover:bg-white/10"
                              onClick={() => void decodeVehicleVin()}
                              disabled={vehicleVinDecodePending}
                            >
                              {vehicleVinDecodePending ? "Decoding..." : "Decode VIN"}
                            </Button>
                          ) : null}
                        </div>
                      ))}
                  </div>

                  {/* ── Prohibited items policy notice ── */}
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                    <span className="font-semibold text-amber-300">Policy reminder: </span>
                    {EXCHANGE_PROHIBITED_POLICY_NOTICE}
                  </div>

                  {/* ── Cottage food law attestation (Local Food only) ── */}
                  {sellCategorySlug === "local-food" &&
                    (() => {
                      const rules = getCottageFoodRules(
                        (user as any)?.state || (user as any)?.stateAbbr || null
                      );
                      const stateCode = String(
                        (user as any)?.state || (user as any)?.stateAbbr || ""
                      )
                        .toUpperCase()
                        .trim();
                      return (
                        <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-4 space-y-3">
                          <p className="text-sm font-semibold text-blue-200">
                            Cottage Food Law Compliance
                          </p>
                          {!stateCode ? (
                            <p className="text-xs text-red-300">
                              Your profile does not have a state on file. Please update your profile
                              with your state before listing Local Food items.
                            </p>
                          ) : !rules ? (
                            <p className="text-xs text-red-300">
                              Cottage food law data is not available for state "{stateCode}".
                              Contact support to verify your eligibility.
                            </p>
                          ) : (
                            <>
                              <p className="text-xs text-blue-100">
                                <span className="font-semibold">{stateCode} cottage food law</span>{" "}
                                — {rules.notes}
                              </p>
                              <p className="text-xs text-blue-100">
                                <span className="font-semibold">Allowed products:</span>{" "}
                                {rules.allowedProducts.join(", ")}.
                              </p>
                              {rules.saleLimitUSD && (
                                <p className="text-xs text-amber-200">
                                  Annual sales cap: ${rules.saleLimitUSD.toLocaleString()}
                                </p>
                              )}
                              {rules.directSaleOnly && (
                                <p className="text-xs text-amber-200">
                                  Direct-to-consumer sales only — your listing fulfillment must be
                                  local pickup or local delivery.
                                </p>
                              )}
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cottageFoodAttestation}
                                  onChange={(e) => {
                                    setCottageFoodAttestation(e.target.checked);
                                    setSellSpecs((prev) => ({
                                      ...prev,
                                      cottageFoodAttestation: e.target.checked ? "true" : "",
                                    }));
                                  }}
                                  className="mt-0.5 h-4 w-4 accent-blue-400"
                                />
                                <span className="text-xs text-blue-100">
                                  I confirm that my product complies with {stateCode} cottage food
                                  law, that I am legally permitted to sell it in my state, and that
                                  my listing includes the required cottage food label information.
                                </span>
                              </label>
                            </>
                          )}
                        </div>
                      );
                    })()}

                  {/* ── Set / Collection mode toggle (Tools + Collectibles only) ── */}
                  {isSetCategory && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Label className="text-white">
                          {sellCategorySlug === "collectibles"
                            ? "Collection?"
                            : "Selling as a set?"}
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSetMode((prev) => !prev);
                            setSetItems([]);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isSetMode ? "bg-ts-orange" : "bg-white/20"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isSetMode ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <span className="text-xs text-white/50">
                          {isSetMode
                            ? sellCategorySlug === "collectibles"
                              ? "Listing as a collection — enter each item below"
                              : "Listing as a set — enter each item below"
                            : sellCategorySlug === "collectibles"
                              ? "Single item"
                              : "Single item / bundle"}
                        </span>
                      </div>

                      {isSetMode && (
                        <div className="space-y-3">
                          <p className="text-xs text-white/50">
                            Add each item in the{" "}
                            {sellCategorySlug === "collectibles" ? "collection" : "set"} (min 3).
                            Each item needs 1 photo. Individual prices are optional — leave blank if
                            selling as a unit only.
                          </p>

                          {setItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-white/70">
                                  Item {idx + 1}
                                </span>
                                {setItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSetItem(idx)}
                                    className="text-xs text-red-400 hover:text-red-300"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>

                              <Input
                                placeholder="Item name (required)"
                                className="bg-white/10 border-white/15 text-white text-sm"
                                value={item.name}
                                onChange={(e) => updateSetItem(idx, { name: e.target.value })}
                              />
                              <Input
                                placeholder="Brief description (optional)"
                                className="bg-white/10 border-white/15 text-white text-sm"
                                value={item.description}
                                onChange={(e) =>
                                  updateSetItem(idx, { description: e.target.value })
                                }
                              />
                              <Input
                                type="number"
                                placeholder="Individual price (optional, USD)"
                                className="bg-white/10 border-white/15 text-white text-sm"
                                value={item.price}
                                onChange={(e) => updateSetItem(idx, { price: e.target.value })}
                              />

                              {/* Per-item photo */}
                              {item.imageUrl ? (
                                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-white/10">
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name || `Item ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateSetItem(idx, { imageUrl: "" })}
                                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-xs text-white"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/15 text-xs text-white/70 hover:bg-white/10 cursor-pointer">
                                  <UploadIcon className="h-3 w-3" />
                                  {setItemUploadingIdx === idx ? "Uploading..." : "Add photo"}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={setItemUploadingIdx !== null}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      setSetItemUploadingIdx(idx);
                                      try {
                                        const { publicUrl } = await uploadObject(file);
                                        updateSetItem(idx, { imageUrl: publicUrl });
                                      } catch {
                                        toast({
                                          title: "Upload failed",
                                          description: "Could not upload photo. Try again.",
                                          variant: "destructive",
                                        });
                                      } finally {
                                        setSetItemUploadingIdx(null);
                                        e.target.value = "";
                                      }
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          ))}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-white/15 text-white/80 hover:bg-white/10"
                            onClick={addSetItem}
                          >
                            + Add item
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="description" className="text-white">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        placeholder={
                          selectedSellFlow?.descriptionPrompt ||
                          "Describe condition, age, and what's included..."
                        }
                        className="bg-white/10 border-white/15 text-white min-h-32"
                        value={sellDescription}
                        onChange={(e) => setSellDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="location" className="text-white">
                        Location
                      </Label>
                      <Input
                        id="location"
                        placeholder="Where can buyers pick it up? (City, State)"
                        className="bg-white/10 border-white/15 text-white"
                        value={sellLocation}
                        onChange={(e) => setSellLocation(e.target.value)}
                      />
                    </div>
                    {/* In set mode, photos are per-item — hide the global photo uploader */}
                    {!isSetMode && (
                      <div>
                        <Label className="text-white">Images</Label>
                        <div className="border-2 border-dashed border-white/15 rounded-lg p-4 text-center space-y-4">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <Plus className="h-10 w-10 text-white/60" />
                            <p className="text-white/60">
                              {getExchangePhotoHint(sellCategorySlug)}
                            </p>
                            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-sm text-white/70 hover:bg-white/10 cursor-pointer">
                              <UploadIcon className="h-4 w-4" />
                              <span>Choose Files</span>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const photoMax = getExchangePhotoMaximum(sellCategorySlug);
                                  const remaining =
                                    photoMax !== undefined ? photoMax - sellImages.length : 999;
                                  const files = Array.from(e.target.files || []).slice(
                                    0,
                                    remaining
                                  );
                                  const uploaded: string[] = [];
                                  for (const file of files) {
                                    try {
                                      const { publicUrl } = await uploadObject(file);
                                      uploaded.push(publicUrl);
                                    } catch (err) {
                                      console.error("Image upload failed", err);
                                    }
                                  }
                                  if (uploaded.length) {
                                    const cap = photoMax !== undefined ? photoMax : 999;
                                    setSellImages((prev) => [...prev, ...uploaded].slice(0, cap));
                                  }
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>

                          {sellImages.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                              {sellImages.map((url, idx) => (
                                <div
                                  key={url + idx}
                                  className="relative group rounded-lg overflow-hidden border border-white/10"
                                >
                                  <img
                                    src={url}
                                    alt="Listing"
                                    className="w-full h-24 object-cover"
                                  />
                                  <button
                                    type="button"
                                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() =>
                                      setSellImages((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}{" "}
                    {/* end !isSetMode photo block */}
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <Button
                    className="bg-ts-orange hover:bg-ts-orange-dark"
                    disabled={createListingMutation.isPending}
                    onClick={() => {
                      if (!isAuthenticated) {
                        toast({
                          title: "Sign in required",
                          description:
                            "You need an account to publish a listing. Please sign in and try again.",
                          variant: "destructive",
                        });
                        return;
                      }

                      if (!stateCode || !countyFips) {
                        toast({
                          title: "Location needed",
                          description:
                            "Set your community location first so we can place this listing on the right local board.",
                          variant: "destructive",
                        });
                        return;
                      }

                      if (!sellTitle.trim()) {
                        toast({
                          title: "Add a title",
                          description: "Give your listing a clear title before publishing.",
                          variant: "destructive",
                        });
                        return;
                      }

                      const numericPrice = Number(sellPrice);
                      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
                        toast({
                          title: "Add a valid price",
                          description: "Enter a positive price so buyers know what you are asking.",
                          variant: "destructive",
                        });
                        return;
                      }

                      if (!sellCategorySlug) {
                        toast({
                          title: "Choose a category",
                          description:
                            "Pick the closest category so the right people see your listing.",
                          variant: "destructive",
                        });
                        return;
                      }

                      const resolvedCategoryId = resolveMarketplaceCategoryId(sellCategorySlug);
                      if (!resolvedCategoryId) {
                        toast({
                          title: "Categories still loading",
                          description: "Please try again in a moment.",
                          variant: "destructive",
                        });
                        return;
                      }

                      const requiredFieldKeys =
                        activePortal === "rental-property"
                          ? RENTAL_PROPERTY_FIELDS.filter((field) => field.required).map(
                              (field) => field.key
                            )
                          : activePortal === "rental-equipment"
                            ? Array.from(
                                new Set([
                                  ...getRequiredExchangeFieldKeys(sellCategorySlug),
                                  ...RENTAL_EQUIPMENT_FIELDS.filter((field) => field.required).map(
                                    (field) => field.key
                                  ),
                                ])
                              )
                            : getRequiredExchangeFieldKeys(sellCategorySlug);

                      const requiredCategoryFields = requiredFieldKeys.filter(
                        (key) => !String(sellSpecs[key] || "").trim()
                      );
                      if (requiredCategoryFields.length > 0) {
                        const categoryFields = selectedSellFields;
                        toast({
                          title: "Finish required fields",
                          description: requiredCategoryFields
                            .map(
                              (key) =>
                                categoryFields.find((field: SellField) => field.key === key)
                                  ?.label || key
                            )
                            .slice(0, 2)
                            .join(", "),
                          variant: "destructive",
                        });
                        return;
                      }
                      // Set/Collection validation
                      if (isSetMode) {
                        if (setItems.length < 3) {
                          toast({
                            title: "Add at least 3 items",
                            description: `A ${sellCategorySlug === "collectibles" ? "collection" : "set"} requires a minimum of 3 items.`,
                            variant: "destructive",
                          });
                          return;
                        }
                        const missingName = setItems.findIndex((it) => !it.name.trim());
                        if (missingName !== -1) {
                          toast({
                            title: `Item ${missingName + 1} needs a name`,
                            description: "Every item in the set must have a name.",
                            variant: "destructive",
                          });
                          return;
                        }
                        const missingPhoto = setItems.findIndex((it) => !it.imageUrl);
                        if (missingPhoto !== -1) {
                          toast({
                            title: `Item ${missingPhoto + 1} needs a photo`,
                            description: "Each item in the set requires 1 photo.",
                            variant: "destructive",
                          });
                          return;
                        }
                      }

                      const categoryValidation =
                        activePortal === "rental-property"
                          ? sellImages.length < 3
                            ? { message: "Add at least 3 photos for a rental property listing." }
                            : null
                          : isSetMode
                            ? null // set mode validation handled above
                            : validateExchangeCategoryListing({
                                category: sellCategorySlug,
                                imageCount: sellImages.length,
                                specs: sellSpecs,
                              });
                      if (categoryValidation) {
                        toast({
                          title: "Complete category details",
                          description: categoryValidation.message,
                          variant: "destructive",
                        });
                        return;
                      }

                      const mappedCondition = selectedSellFlow?.defaultCondition || "good";

                      const body: any = {
                        title: sellTitle.trim(),
                        description: sellDescription.trim() || sellTitle.trim(),
                        price: numericPrice,
                        categoryId: resolvedCategoryId,
                        state: stateCode,
                        county: countyFips,
                        condition: mappedCondition,
                        isLocalPickupOnly: true,
                        willShip: false,
                        images: sellImages,
                        locationVisibility: "meetup_only",
                      };

                      const specPayload = Object.entries(sellSpecs).reduce<Record<string, string>>(
                        (acc, [key, value]) => {
                          const trimmed = String(value || "").trim();
                          if (trimmed) acc[key] = trimmed;
                          return acc;
                        },
                        {}
                      );
                      if (Object.keys(specPayload).length > 0) {
                        body.specifications = {
                          category: sellCategorySlug,
                          portal:
                            activePortal === "rental-property"
                              ? "rental_property"
                              : activePortal === "rental-equipment"
                                ? "rental_equipment"
                                : undefined,
                          ...specPayload,
                        };
                      }

                      if (sellCategorySlug === "vehicles") {
                        const parsedYear = Number(String(sellSpecs.year || ""));
                        const parsedMileage = Number(String(sellSpecs.mileage || ""));
                        body.brand = String(sellSpecs.make || "").trim() || undefined;
                        body.model = String(sellSpecs.model || "").trim() || undefined;
                        body.year = Number.isFinite(parsedYear) ? parsedYear : undefined;
                        body.mileage = Number.isFinite(parsedMileage) ? parsedMileage : undefined;
                      }

                      if (sellCategorySlug === "construction") {
                        const parsedHours = Number(String(sellSpecs.hours || ""));
                        body.hours = Number.isFinite(parsedHours) ? parsedHours : undefined;
                        body.model = String(sellSpecs.serialNumber || "").trim() || undefined;
                      }

                      if (sellCategorySlug === "tools") {
                        body.brand = String(sellSpecs.brand || "").trim() || undefined;
                        body.model = String(sellSpecs.model || "").trim() || undefined;
                      }

                      if (sellCategorySlug === "electronics") {
                        body.brand = String(sellSpecs.brand || "").trim() || undefined;
                        body.model = String(sellSpecs.model || "").trim() || undefined;
                      }

                      if (sellCategorySlug === "farm") {
                        const parsedHours = Number(String(sellSpecs.hours || ""));
                        body.hours = Number.isFinite(parsedHours) ? parsedHours : undefined;
                      }

                      if (sellCategorySlug === "business-equipment") {
                        body.brand = String(sellSpecs.brand || "").trim() || undefined;
                        body.model = String(sellSpecs.model || "").trim() || undefined;
                      }

                      if (sellCategorySlug === "other") {
                        body.brand = String(sellSpecs.brand || "").trim() || undefined;
                        body.model = String(sellSpecs.model || "").trim() || undefined;
                      }

                      if (sellLocation.trim()) {
                        body.city = sellLocation.trim();
                      }

                      // Set / Collection mode: embed items in specifications and use item photos as listing images
                      if (isSetMode && setItems.length >= 3) {
                        const listingType =
                          sellCategorySlug === "collectibles" ? "collection" : "bundle";
                        const mappedItems = setItems.map((it, index) => ({
                          id: `bundle-item-${index + 1}`,
                          name: it.name.trim(),
                          description: it.description.trim() || undefined,
                          condition: mappedCondition,
                          fallbackValue: it.price ? Number(it.price) || undefined : undefined,
                          imageUrl: it.imageUrl,
                        }));
                        body.listingType = listingType;
                        body.bundlePurchaseMode = "must_buy_all";
                        body.bundleItems = mappedItems;
                        body.specifications = {
                          ...(body.specifications || {}),
                          listingType,
                          setItems: mappedItems.map((item) => ({
                            name: item.name,
                            description: item.description,
                            price: item.fallbackValue,
                            imageUrl: item.imageUrl,
                          })),
                        };
                        // Use item images as the listing's image array (one per item)
                        body.images = mappedItems.map((it) => it.imageUrl);
                      }

                      createListingMutation.mutate(body);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={Boolean(contactItem)}
          onOpenChange={(open) => {
            if (!open) {
              setContactItem(null);
              setInquiryMessage("");
              setInquiryOffer("");
            }
          }}
        >
          <DialogContent className="bg-tsCard border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">Request Quote</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-tsCard/95 px-3 py-2">
                <p className="text-xs text-white/60">Listing</p>
                <p className="text-sm font-semibold text-white">{contactItem?.title || "Item"}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Request</Label>
                <Textarea
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Tell the seller what you need and ask for a quote..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Offer amount (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  value={inquiryOffer}
                  onChange={(e) => setInquiryOffer(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Example: 2200"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="border-white/15 text-white/70"
                  onClick={() => {
                    setContactItem(null);
                    setInquiryMessage("");
                    setInquiryOffer("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-ts-orange hover:bg-ts-orange-dark"
                  disabled={
                    inquiryMutation.isPending ||
                    !contactItem?.id ||
                    inquiryMessage.trim().length < 4
                  }
                  onClick={() => {
                    if (!contactItem?.id) return;
                    const offerValue = Number(inquiryOffer);
                    inquiryMutation.mutate({
                      listingId: String(contactItem.id),
                      message: inquiryMessage.trim(),
                      offerAmount:
                        Number.isFinite(offerValue) && offerValue > 0 ? offerValue : undefined,
                    });
                  }}
                >
                  {inquiryMutation.isPending ? "Sending..." : "Send Request"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
