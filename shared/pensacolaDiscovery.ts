import { ISSA_BUILD_PROFILE_SLUG } from "./issaBuildProfile";

/** Owner-confirmed: Pensacola-area kitchen and bathroom work belongs to ISSA Build. */
export const PENSACOLA_PROJECTS = {
  project: {
    title: "Kitchen and bathroom project",
    label: "Start a Request",
    description: "Tell ISSA Build what you want to change in your kitchen or bathroom.",
  },
  kitchens: {
    title: "Kitchen project",
    label: "Plan my kitchen",
    serviceSlug: "kitchen-projects",
    description: "Bring your kitchen plans, room measurements and the changes you want to make.",
  },
  bathrooms: {
    title: "Bathroom project",
    label: "Plan my bathroom",
    serviceSlug: "bathroom-projects",
    description: "Discuss your bathroom, vanity and surface needs with ISSA Build.",
  },
  cabinets: {
    title: "Cabinets",
    label: "Request cabinets",
    serviceSlug: "cabinets",
    description: "Share your cabinet layout, door style, finish and storage needs.",
  },
  countertops: {
    title: "Stone countertops and fabrication",
    label: "Request countertops or fabrication",
    serviceSlug: "countertops-fabrication",
    description:
      "Ask ISSA Build about stone countertops, custom fabrication and installation for your project.",
  },
} as const;
export type PensacolaProjectKind = keyof typeof PENSACOLA_PROJECTS;

export function pensacolaProjectMessage(kind: PensacolaProjectKind): string {
  return `${PENSACOLA_PROJECTS[kind].title} for ISSA Build.\nProject city or ZIP:\nWork needed:\nApproximate dimensions:\nMaterials or finishes in mind:\nDesired timing:`;
}

export function pensacolaProjectRequestHref(kind: PensacolaProjectKind): string {
  const params = new URLSearchParams({
    profile: ISSA_BUILD_PROFILE_SLUG,
    profileName: "ISSA Build",
    subject: "service",
    source: "pensacola-kitchen-bath",
    title: PENSACOLA_PROJECTS[kind].title,
    description: pensacolaProjectMessage(kind),
  });
  // Nearby projects must supply their actual location, rather than inherit Escambia by assumption.
  return `/direct-connect?${params.toString()}`;
}

export const PENSACOLA_DISCOVERY = {
  path: "/pensacola",
  title: "Pensacola Kitchens, Cabinets & Countertops | ISSA Build",
  description:
    "Kitchen and bathroom projects in Pensacola and surrounding areas. Cabinets, stone countertops and fabrication through ISSA Build. Start a project request.",
  heading: "Kitchen and bathroom projects in Pensacola.",
  introduction:
    "Cabinets, stone countertops, fabrication and more—with ISSA Build serving Pensacola and the surrounding areas.",
  profileSlug: ISSA_BUILD_PROFILE_SLUG,
  profileHref: `/u/${ISSA_BUILD_PROFILE_SLUG}`,
  projectKinds: ["kitchens", "bathrooms", "cabinets", "countertops"] as const,
  faqItems: [
    {
      question: "Who handles my kitchen or bathroom project?",
      answer:
        "ISSA Build handles kitchen and bathroom requests from Pensacola and the surrounding areas, including cabinets, countertops and fabrication. TradeScout manages the inquiry so your project details reach the ISSA Build request path.",
    },
    {
      question: "Can I request countertop fabrication too?",
      answer:
        "Yes. Pensacola-area countertop and fabrication requests go to ISSA Build. Include whether you need material selection, fabrication, installation or help with the full project.",
    },
    {
      question: "What if my project is outside Pensacola?",
      answer:
        "Include your actual city or ZIP in the request. ISSA Build serves Pensacola and surrounding areas; confirm the job location, scope, quote and schedule before work is booked.",
    },
  ],
} as const;
