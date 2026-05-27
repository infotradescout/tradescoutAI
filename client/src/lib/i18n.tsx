import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppLanguage = "en" | "es";

interface TranslationBranch {
  [key: string]: string | TranslationBranch;
}
type TranslationValue = string | TranslationBranch;

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
};

const LANGUAGE_STORAGE_KEY = "ts:language";

const DICTIONARY: Record<AppLanguage, Record<string, TranslationValue>> = {
  en: {
    common: {
      language: "Language",
      english: "English",
      spanish: "Español",
      continue: "Continue",
      back: "Back",
    },
    onboarding: {
      step: "Step {{current}}/{{total}}",
      intentTitle: "What do you need done?",
      assetTitle: "What should TradeScout remember for you?",
      nothingYet: "Nothing yet",
      changeIntent: "Change intent",
      roleAssetHint: "Roles describe why you are here. Assets describe what you manage.",
      intent: {
        fixImprove: "Fix or improve something",
        fixImproveDetail: "Get matched with the right local person for the job.",
        vehicleService: "Service or repair a vehicle",
        vehicleServiceDetail: "Find the right local help for vehicle service and repairs.",
        findPersonBusiness: "Find a person or business",
        findPersonBusinessDetail: "Post what you need and review matches before contact opens.",
        sellList: "Sell or list something",
        sellListDetail: "List items locally and connect with the right buyer.",
        propertyRealEstate: "Help with property or real estate",
        propertyRealEstateDetail: "Route property work to the right local person or business.",
        offerServices: "Offer my services",
        offerServicesDetail: "Set up your service presence and respond to local needs.",
        browseActivity: "Browse local activity",
        browseActivityDetail: "See nearby updates, people, and opportunities.",
        justLooking: "Just looking around",
        justLookingDetail: "Explore now and set up more context later.",
      },
      assets: {
        home: "A home",
        vehicle: "A vehicle",
        project: "A project",
        business: "A business",
        savedSearch: "A saved search",
      },
    },
    scout: {
      title: "Scout",
      setLocation: "Set location",
      tagline: "Find, fix, sell, check, or continue anything local.",
      helper: "Start with search or pick an area below.",
      continueTitle: "Continue where you left off",
      exploreTitle: "Explore around you",
      nearbyTitle: "Nearby right now",
      snapshotTitle: "Local snapshot",
      emptyTitle: "Nothing to continue yet.",
      emptyBody: "Search once, save something, or start a request and Scout will keep it here.",
    },
    directConnect: {
      intent: {
        fixImprove: {
          heading: "Tell us what needs done.",
          prompt: "What do you need fixed, built, repaired, cleaned, or improved?",
        },
        vehicleService: {
          heading: "Vehicle help",
          prompt: "What vehicle service or repair do you need?",
        },
        findPersonBusiness: {
          heading: "Find local help",
          prompt: "Who or what kind of local help are you looking for?",
        },
        sellList: {
          heading: "Sell or list something",
          prompt: "What are you trying to sell or list?",
        },
        propertyRealEstate: {
          heading: "Property help",
          prompt: "What property, listing, client, or real estate need are you working on?",
        },
        offerServices: {
          heading: "Offer your services",
          prompt: "What service do you provide, and where do you work?",
        },
        browseActivity: {
          heading: "See what’s happening nearby",
          prompt: "What kind of local activity do you want to see?",
        },
        browseOnly: {
          heading: "Start anywhere",
          prompt: "Search for local help, listings, services, jobs, people, or places.",
        },
      },
      chips: {
        repair: "Repair",
        cleaning: "Cleaning",
        yardWork: "Yard work",
        remodel: "Remodel",
        emergencyHelp: "Emergency help",
        maintenance: "Maintenance",
        tires: "Tires",
        towHelp: "Tow/help",
        sellVehicle: "Sell vehicle",
        contractor: "Contractor",
        notary: "Notary",
        cleaner: "Cleaner",
        mechanic: "Mechanic",
        localBusiness: "Local business",
        tools: "Tools",
        materials: "Materials",
        vehicle: "Vehicle",
        property: "Property",
        equipment: "Equipment",
        listingPrep: "Listing prep",
        inspection: "Inspection",
        realtorHelp: "Realtor help",
        repairs: "Repairs",
        buyerSellerHelp: "Buyer/seller help",
        homeServices: "Home services",
        vehicleServices: "Vehicle services",
        propertyServices: "Property services",
        other: "Other",
        posts: "Posts",
        events: "Events",
        listings: "Listings",
        requests: "Requests",
        localBusinesses: "Local businesses",
        homeRepair: "Home repair",
        vehicleService: "Vehicle service",
        localHelp: "Local help",
      },
    },
  },
  es: {
    common: {
      language: "Idioma",
      english: "Inglés",
      spanish: "Español",
      continue: "Continuar",
      back: "Atrás",
    },
    onboarding: {
      step: "Paso {{current}}/{{total}}",
      intentTitle: "¿Qué necesitas resolver?",
      assetTitle: "¿Qué debería recordar TradeScout por ti?",
      nothingYet: "Nada por ahora",
      changeIntent: "Cambiar intención",
      roleAssetHint:
        "Los roles describen por qué estás aquí. Los activos describen lo que gestionas.",
      intent: {
        fixImprove: "Arreglar o mejorar algo",
        fixImproveDetail: "Te conectamos con la persona local adecuada para el trabajo.",
        vehicleService: "Servicio o reparación de vehículo",
        vehicleServiceDetail: "Encuentra ayuda local para servicio y reparación de vehículos.",
        findPersonBusiness: "Encontrar una persona o negocio",
        findPersonBusinessDetail:
          "Publica lo que necesitas y revisa opciones antes de abrir contacto.",
        sellList: "Vender o publicar algo",
        sellListDetail: "Publica artículos localmente y conecta con el comprador adecuado.",
        propertyRealEstate: "Ayuda con propiedad o bienes raíces",
        propertyRealEstateDetail:
          "Dirige necesidades de propiedad a la persona o negocio local adecuado.",
        offerServices: "Ofrecer mis servicios",
        offerServicesDetail: "Configura tu perfil de servicio y responde a necesidades locales.",
        browseActivity: "Explorar actividad local",
        browseActivityDetail: "Mira novedades, personas y oportunidades cercanas.",
        justLooking: "Solo estoy explorando",
        justLookingDetail: "Explora ahora y agrega más contexto después.",
      },
      assets: {
        home: "Una casa",
        vehicle: "Un vehículo",
        project: "Un proyecto",
        business: "Un negocio",
        savedSearch: "Una búsqueda guardada",
      },
    },
    scout: {
      title: "Scout",
      setLocation: "Definir ubicación",
      tagline: "Encuentra, repara, vende, revisa o continúa cualquier cosa local.",
      helper: "Empieza con la búsqueda o elige un área abajo.",
      continueTitle: "Continúa donde lo dejaste",
      exploreTitle: "Explora a tu alrededor",
      nearbyTitle: "Cerca de ti ahora",
      snapshotTitle: "Resumen local",
      emptyTitle: "Aún no hay nada para continuar.",
      emptyBody: "Haz una búsqueda, guarda algo o inicia una solicitud y Scout lo mantendrá aquí.",
    },
    directConnect: {
      intent: {
        fixImprove: {
          heading: "Cuéntanos qué necesitas hacer.",
          prompt: "¿Qué necesitas arreglar, construir, reparar, limpiar o mejorar?",
        },
        vehicleService: {
          heading: "Ayuda para vehículo",
          prompt: "¿Qué servicio o reparación de vehículo necesitas?",
        },
        findPersonBusiness: {
          heading: "Encontrar ayuda local",
          prompt: "¿Qué persona o tipo de negocio local estás buscando?",
        },
        sellList: {
          heading: "Vender o publicar algo",
          prompt: "¿Qué estás tratando de vender o publicar?",
        },
        propertyRealEstate: {
          heading: "Ayuda con propiedad",
          prompt: "¿Qué necesidad de propiedad, listado, cliente o bienes raíces tienes?",
        },
        offerServices: {
          heading: "Ofrece tus servicios",
          prompt: "¿Qué servicio ofreces y en qué zona trabajas?",
        },
        browseActivity: {
          heading: "Mira qué está pasando cerca",
          prompt: "¿Qué tipo de actividad local quieres ver?",
        },
        browseOnly: {
          heading: "Empieza donde quieras",
          prompt: "Busca ayuda local, listados, servicios, trabajos, personas o lugares.",
        },
      },
      chips: {
        repair: "Reparación",
        cleaning: "Limpieza",
        yardWork: "Trabajo de jardín",
        remodel: "Remodelación",
        emergencyHelp: "Ayuda urgente",
        maintenance: "Mantenimiento",
        tires: "Llantas",
        towHelp: "Grúa/ayuda",
        sellVehicle: "Vender vehículo",
        contractor: "Contratista",
        notary: "Notario",
        cleaner: "Limpieza",
        mechanic: "Mecánico",
        localBusiness: "Negocio local",
        tools: "Herramientas",
        materials: "Materiales",
        vehicle: "Vehículo",
        property: "Propiedad",
        equipment: "Equipo",
        listingPrep: "Preparación de listado",
        inspection: "Inspección",
        realtorHelp: "Ayuda inmobiliaria",
        repairs: "Reparaciones",
        buyerSellerHelp: "Ayuda comprador/vendedor",
        homeServices: "Servicios del hogar",
        vehicleServices: "Servicios vehiculares",
        propertyServices: "Servicios de propiedad",
        other: "Otro",
        posts: "Publicaciones",
        events: "Eventos",
        listings: "Listados",
        requests: "Solicitudes",
        localBusinesses: "Negocios locales",
        homeRepair: "Reparación del hogar",
        vehicleService: "Servicio de vehículo",
        localHelp: "Ayuda local",
      },
    },
  },
};

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveNestedValue(
  dictionary: Record<string, TranslationValue>,
  key: string
): string | null {
  const parts = key.split(".");
  let cursor: TranslationValue | undefined = dictionary;
  for (const part of parts) {
    if (!cursor || typeof cursor === "string") return null;
    cursor = cursor[part];
  }
  return typeof cursor === "string" ? cursor : null;
}

function applyReplacements(
  template: string,
  replacements?: Record<string, string | number>
): string {
  if (!replacements) return template;
  return Object.entries(replacements).reduce((acc, [token, value]) => {
    const pattern = new RegExp(`{{\\s*${token}\\s*}}`, "g");
    return acc.replace(pattern, String(value));
  }, template);
}

function detectInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === "en" || saved === "es") return saved;
  const nav = String(window.navigator.language || "").toLowerCase();
  if (nav.startsWith("es")) return "es";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => detectInitialLanguage());

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, replacements?: Record<string, string | number>) => {
      const primary = resolveNestedValue(DICTIONARY[language], key);
      const fallback = resolveNestedValue(DICTIONARY.en, key);
      const resolved = primary || fallback || key;
      return applyReplacements(resolved, replacements);
    };
    return {
      language,
      setLanguage: setLanguageState,
      t,
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
