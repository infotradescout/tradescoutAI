export const DEAN_DAMASKOS_PROFILE_SLUG = "dean-damaskos" as const;

export const DEAN_DAMASKOS_PROFILE_CONTENT = {
  companyName: "Aureus Crown Investments",
  roleLine: "Co-Founder | Partner | Acquisitions Specialist",
  locationLabel: "Saratoga Springs, New York",
  heroTitle: "Disciplined acquisitions. Human relationships. Full-cycle focus.",
  heroText:
    "Dean Damaskos brings an operator's eye to multifamily real estate - sourcing opportunities, testing the details, coordinating the deal team, and staying focused through disposition.",
  portraitUrl: "/images/profiles/dean-damaskos/dean-damaskos.webp",
  portraitAlt: "Dean Damaskos",
  architectureImageUrl: "/images/profiles/dean-damaskos/multifamily-architecture.webp",
  architectureImageAlt: "Multifamily residential architecture",
  focusAreas: [
    {
      eyebrow: "01 / Source",
      title: "Opportunity sourcing",
      body: "Locate multifamily opportunities that fit the team's published acquisition discipline and long-range business plan.",
    },
    {
      eyebrow: "02 / Analyze",
      title: "Deal analysis",
      body: "Review the market, property condition, operating picture, financing context, and value-add thesis before a decision moves forward.",
    },
    {
      eyebrow: "03 / Execute",
      title: "Negotiation and coordination",
      body: "Work across brokers, lenders, attorneys, partners, and due-diligence specialists to keep the transaction clear and accountable.",
    },
    {
      eyebrow: "04 / Complete",
      title: "Full-cycle disposition",
      body: "Carry the acquisition thesis through the asset's business plan and lead the disposition process when the property reaches its exit stage.",
    },
  ],
  process: [
    {
      step: "Market",
      detail: "Population, jobs, supply, demand, and local economic direction.",
    },
    {
      step: "Property",
      detail: "Physical condition, operations, renovation scope, and value-add potential.",
    },
    {
      step: "Capital",
      detail: "Debt, equity, hold period, and alignment with the asset's business plan.",
    },
    {
      step: "Execution",
      detail: "Due diligence, negotiation, closing coordination, and full-cycle follow-through.",
    },
  ],
  biography: [
    "Dean is a co-founder of Aureus Crown Investments and leads acquisition work across locating, analyzing, negotiating, and processing multifamily commercial real estate opportunities.",
    "His earlier work as an automotive mechanic and network engineer shaped a practical approach: understand the system, test the assumptions, find the failure points, and solve the real problem before moving forward.",
    "That same precision carries into the relationships behind a transaction - brokers, lenders, attorneys, operators, and partners working from one clear picture.",
  ],
  principles: [
    { title: "Integrity", body: "Tell the truth about the opportunity and the work." },
    { title: "Commitment", body: "Stay accountable from first review through the full cycle." },
    { title: "Precision", body: "Make the details earn the decision." },
  ],
  sourceBasis: [
    {
      label: "Aureus Crown Investments - Dean Damaskos",
      url: "https://aureuscrowninvestments.com/about-us",
    },
    {
      label: "Aureus Crown Investments - Investment strategy",
      url: "https://aureuscrowninvestments.com/investment-strategy",
    },
    {
      label: "Dean Damaskos - LinkedIn",
      url: "https://www.linkedin.com/in/dean-damaskos",
    },
  ],
  disclosure:
    "This profile is informational only. It is not an offer to sell or a solicitation to buy any security or investment interest, and it is not investment, tax, or legal advice. Any offering is made only through its controlling offering documents and applicable eligibility requirements.",
} as const;

export const DEAN_DAMASKOS_PROFILE_BLOCKS = [
  { type: "siteTemplate", data: { id: "investment-partner" } },
  {
    type: "hero",
    data: {
      title: DEAN_DAMASKOS_PROFILE_CONTENT.heroTitle,
      text: DEAN_DAMASKOS_PROFILE_CONTENT.heroText,
      imageUrl: DEAN_DAMASKOS_PROFILE_CONTENT.architectureImageUrl,
      operatorName: "Dean Damaskos",
      locationLabel: DEAN_DAMASKOS_PROFILE_CONTENT.locationLabel,
    },
  },
  { type: "investmentProfile", data: DEAN_DAMASKOS_PROFILE_CONTENT },
  {
    type: "services",
    data: {
      items: [
        "Multifamily opportunity sourcing",
        "Acquisition analysis",
        "Deal negotiation and coordination",
        "Full-cycle disposition planning",
      ],
    },
  },
] as const;
