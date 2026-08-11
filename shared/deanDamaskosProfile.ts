export const DEAN_DAMASKOS_PROFILE_SLUG = "dean-damaskos" as const;

export const DEAN_DAMASKOS_PROFILE_CONTENT = {
  companyName: "Financial Planning",
  roleLine: "Financial Advisor",
  locationLabel: "New York",
  heroTitle: "Build wealth with intention. Protect the life around it.",
  heroText:
    "Dean helps individuals and business owners bring retirement planning, wealth accumulation, and asset protection into one clearer financial conversation.",
  portraitUrl: "/images/profiles/dean-damaskos/dean-damaskos.webp",
  portraitAlt: "Dean Damaskos",
  focusAreas: [
    {
      eyebrow: "01 / Future",
      title: "Retirement planning",
      body: "Clarify the life you want to fund, organize the decisions ahead, and build a retirement strategy around your priorities and timeline.",
    },
    {
      eyebrow: "02 / Enterprise",
      title: "Business owner strategies",
      body: "Connect business decisions with personal financial goals so growth, continuity, and the owner's long-term plan are considered together.",
    },
    {
      eyebrow: "03 / Growth",
      title: "Wealth accumulation",
      body: "Create a deliberate framework for building wealth over time while keeping risk, liquidity, and changing goals in view.",
    },
    {
      eyebrow: "04 / Resilience",
      title: "Asset protection",
      body: "Identify exposures, organize safeguards, and coordinate the right professional conversations around the assets you have worked to build.",
    },
  ],
  process: [
    {
      step: "Listen",
      detail: "Start with your goals, responsibilities, concerns, and the decisions already on your mind.",
    },
    {
      step: "Map",
      detail: "Bring the moving parts into one view: retirement, business, wealth, protection, and timing.",
    },
    {
      step: "Plan",
      detail: "Turn priorities into a practical sequence of decisions instead of a stack of disconnected products.",
    },
    {
      step: "Review",
      detail: "Revisit the plan as life, business conditions, responsibilities, and opportunities change.",
    },
  ],
  biography: [
    "Dean's financial-services focus covers retirement planning, business owner strategies, wealth accumulation, and asset protection.",
    "For a business owner, the company and the household rarely live in separate financial worlds. Planning needs to account for both without losing sight of the people, responsibilities, and future the work is meant to support.",
    "Dean's role is to help make that picture easier to discuss and the next decision easier to understand. The starting point is a real conversation about what matters, what is changing, and what needs attention now.",
  ],
  principles: [
    { title: "Clarity", body: "Make the choices and tradeoffs understandable." },
    { title: "Stewardship", body: "Treat the plan as personal, because it is." },
    { title: "Continuity", body: "Keep the strategy connected as life and business evolve." },
  ],
  sourceBasis: [
    {
      label: "Dean Damaskos - professional background",
      url: "https://www.linkedin.com/in/dean-damaskos",
    },
  ],
  disclosure:
    "This profile provides general information, not personalized financial, investment, tax, insurance, or legal advice. Services, products, professional affiliations, registrations, and availability should be confirmed directly with Dean before making a financial decision.",
} as const;

export const DEAN_DAMASKOS_PROFILE_BLOCKS = [
  { type: "siteTemplate", data: { id: "financial-advisor" } },
  {
    type: "hero",
    data: {
      title: DEAN_DAMASKOS_PROFILE_CONTENT.heroTitle,
      text: DEAN_DAMASKOS_PROFILE_CONTENT.heroText,
      imageUrl: DEAN_DAMASKOS_PROFILE_CONTENT.portraitUrl,
      operatorName: "Dean Damaskos",
      locationLabel: DEAN_DAMASKOS_PROFILE_CONTENT.locationLabel,
    },
  },
  { type: "financialAdvisorProfile", data: DEAN_DAMASKOS_PROFILE_CONTENT },
  {
    type: "services",
    data: {
      items: [
        "Retirement planning",
        "Business owner strategies",
        "Wealth accumulation",
        "Asset protection",
      ],
    },
  },
] as const;
