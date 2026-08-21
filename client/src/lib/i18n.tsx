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
      outcome: {
        title: "What are you here to accomplish?",
        subtitle:
          "Tell Scout the outcome. If it involves a business you own or manage, share whatever material you already have and Scout will help complete the profile.",
        goalLabel: "What result are you looking for?",
        goalPlaceholder:
          "For example: find a licensed electrician nearby, or build my landscaping business profile from our website and photos.",
        goalHint: "Plain language is enough. This is the only required answer.",
        goalRequired: "Tell us the result you want so Scout knows where to take you.",
        businessSwitch: "This is for a business I own or manage",
        businessSwitchHint: "Use the same flow and add only the business material you have.",
        businessTitle: "Share what you already have",
        businessEvidenceHint:
          "Every field below is optional. Sparse input is valid, and you can improve the profile later.",
        businessNameLabel: "Business name (if you have it)",
        businessNamePlaceholder: "Business or public-facing name",
        businessNameRequired:
          "We need only a business name to create a new profile. Everything else can stay blank.",
        businessSelectionLabel: "Which business should Scout update?",
        businessSelectionPlaceholder: "Choose your business",
        businessSelectionHint:
          "Select one of your existing businesses, then continue on this screen.",
        businessSelectionRequired: "Choose the business you want to update.",
        profileSelectionLabel: "Which existing profile should Scout reuse?",
        profileSelectionPlaceholder: "Choose your profile",
        profileSelectionHint: "Your existing profile content will be preserved and enriched.",
        profileSelectionRequired: "Choose the existing profile you want to reuse.",
        businessNotesLabel: "What should people understand about the business?",
        businessNotesPlaceholder:
          "Paste a description, rough notes, service area, hours, or anything else you know.",
        servicesLabel: "Services",
        servicesPlaceholder: "One per line, or separated by commas",
        servicesHint: "Scout uses up to 50 services, with 180 characters per item.",
        linksLabel: "Links",
        linksPlaceholder: "Website, social profiles, portfolio pages — one per line",
        linksHint:
          "Add up to 20 links. They are source material for profile population. Contact remains protected through Direct Connect; not every source link becomes public.",
        photosLabel: "Photos",
        photosHint: "Add any useful work, team, storefront, product, or logo images.",
        addPhotos: "Add photos",
        removePhoto: "Remove photo",
        uploadingPhoto: "Uploading…",
        photoReady: "Ready",
        photoError: "Upload failed",
        photoLimit: "You can add up to 12 photos here.",
        groundingNotice:
          "Scout uses only the material you provide to complete the profile. It will not invent licenses, reviews, verification, pricing, or trust claims, and onboarding will not change verification status.",
        businessCompletionHint:
          "Your populated profile opens next. Existing verification and discovery rules still apply.",
        expressCompletionHint: "Scout will take you directly to the result you came for.",
        uploading: "Uploading…",
        processing: "Building your result…",
        buildProfile: "Populate my profile",
        getResult: "Get my result",
        submitError: "We couldn't finish onboarding. Your answers are still here; try again.",
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
      outcome: {
        title: "¿Qué quieres lograr hoy?",
        subtitle:
          "Cuéntale a Scout el resultado. Si se trata de un negocio que administras o del que eres dueño, comparte el material que ya tengas y Scout te ayudará a completar el perfil.",
        goalLabel: "¿Qué resultado buscas?",
        goalPlaceholder:
          "Por ejemplo: encontrar un electricista con licencia cerca, o crear el perfil de mi negocio de jardinería con nuestro sitio web y fotos.",
        goalHint:
          "Puedes escribirlo con tus propias palabras. Esta es la única respuesta obligatoria.",
        goalRequired: "Dinos qué resultado quieres para que Scout sepa adónde llevarte.",
        businessSwitch: "Esto es para un negocio que administro o del que soy dueño",
        businessSwitchHint:
          "Usa el mismo proceso y agrega solo el material del negocio que tengas.",
        businessTitle: "Comparte lo que ya tienes",
        businessEvidenceHint:
          "Todos los campos siguientes son opcionales. Puedes dar poca información y mejorar el perfil después.",
        businessNameLabel: "Nombre del negocio (si lo tienes)",
        businessNamePlaceholder: "Nombre comercial o público",
        businessNameRequired:
          "Solo necesitamos el nombre del negocio para crear un perfil nuevo. Todo lo demás puede quedar en blanco.",
        businessSelectionLabel: "¿Qué negocio debe actualizar Scout?",
        businessSelectionPlaceholder: "Elige tu negocio",
        businessSelectionHint:
          "Selecciona uno de tus negocios existentes y continúa en esta misma pantalla.",
        businessSelectionRequired: "Elige el negocio que quieres actualizar.",
        profileSelectionLabel: "¿Qué perfil existente debe reutilizar Scout?",
        profileSelectionPlaceholder: "Elige tu perfil",
        profileSelectionHint: "Se conservará y enriquecerá el contenido de tu perfil existente.",
        profileSelectionRequired: "Elige el perfil existente que quieres reutilizar.",
        businessNotesLabel: "¿Qué debería saber la gente sobre el negocio?",
        businessNotesPlaceholder:
          "Pega una descripción, notas, zona de servicio, horario o cualquier dato que conozcas.",
        servicesLabel: "Servicios",
        servicesPlaceholder: "Uno por línea o separados por comas",
        servicesHint: "Scout usa hasta 50 servicios, con 180 caracteres por elemento.",
        linksLabel: "Enlaces",
        linksPlaceholder: "Sitio web, redes o portafolio — uno por línea",
        linksHint:
          "Agrega hasta 20 enlaces. Sirven como fuentes para completar el perfil. El contacto sigue protegido por Direct Connect; no todos los enlaces se publican.",
        photosLabel: "Fotos",
        photosHint: "Agrega imágenes útiles de trabajos, equipo, local, productos o logotipo.",
        addPhotos: "Agregar fotos",
        removePhoto: "Quitar foto",
        uploadingPhoto: "Subiendo…",
        photoReady: "Lista",
        photoError: "Falló la carga",
        photoLimit: "Puedes agregar hasta 12 fotos aquí.",
        groundingNotice:
          "Scout solo usa el material que proporcionas para completar el perfil. No inventará licencias, reseñas, verificación, precios ni señales de confianza, y este proceso no cambiará la verificación.",
        businessCompletionHint:
          "A continuación se abrirá tu perfil completo. Las reglas actuales de verificación y visibilidad siguen vigentes.",
        expressCompletionHint: "Scout te llevará directamente al resultado que viniste a buscar.",
        uploading: "Subiendo…",
        processing: "Creando tu resultado…",
        buildProfile: "Completar mi perfil",
        getResult: "Obtener mi resultado",
        submitError:
          "No pudimos terminar el proceso. Tus respuestas siguen aquí; inténtalo de nuevo.",
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
