export const DEAN_DAMASKOS_PROFILE_SLUG = "dean-damaskos" as const;

/**
 * Conservative defaults for Dean's TradeScout profile.
 *
 * The public source describes Dean as a "Financial Wealth Strategist" and
 * identifies Torque Financial. It does not establish an investment-adviser or
 * broker registration, so this copy deliberately avoids those regulated
 * titles and makes no performance, product, licensing, or fiduciary claims.
 */
export const DEAN_DAMASKOS_PROFILE_CONTENT = {
  companyName: "Torque Financial",
  roleLine: "Financial Wealth Strategist",
  locationLabel: "",
  heroTitle: "Protect what you have built. Plan for what comes next.",
  heroText:
    "Dean describes his work as helping individuals, families, employees, and business owners have clearer conversations about protection, benefits, retirement, and long-term financial priorities.",
  portraitUrl: "",
  portraitAlt: "Dean Damaskos",
  focusAreas: [
    {
      eyebrow: "01 / Business",
      title: "Business protection",
      body: "Discuss continuity risks, responsibilities, and protection priorities for the people and operations a business depends on.",
    },
    {
      eyebrow: "02 / Team",
      title: "Employee benefits",
      body: "Explore benefit and retirement-plan questions for a team without assuming a particular product, price, or outcome.",
    },
    {
      eyebrow: "03 / Future",
      title: "Retirement planning",
      body: "Organize goals, timing, income needs, and risk questions before evaluating possible next steps.",
    },
    {
      eyebrow: "04 / Strategy",
      title: "Wealth strategy",
      body: "Bring protection and long-term wealth priorities into one conversation grounded in the client's circumstances.",
    },
  ],
  biography: [
    "Dean's public website describes a career path from automotive work to information technology and, later, full-time financial-services work.",
    "He presents Torque Financial as a resource for working families, employees, and business owners who want to discuss protection, retirement, benefits, and long-term priorities in plain language.",
  ],
  principles: [
    { title: "Plain language", body: "Make the questions and tradeoffs easier to understand." },
    { title: "Personal context", body: "Begin with the person, household, or business—not a product." },
    { title: "Confirmed next steps", body: "Verify services, credentials, terms, and availability before acting." },
  ],
  sourceBasis: [
    {
      label: "Dean Damaskos public website",
      url: "https://deandamaskos.com/",
    },
  ],
  disclosure:
    "This profile summarizes Dean's public website and provides general information only. TradeScout has not independently verified licenses, registrations, affiliations, product availability, or suitability. Nothing here is an offer, recommendation, or personalized financial, investment, tax, insurance, or legal advice. Request current disclosures and confirm credentials before making a financial decision.",
} as const;

export const DEAN_DAMASKOS_PROFILE_BLOCKS = [
  { type: "siteTemplate", data: { id: "financial-professional" } },
  {
    type: "hero",
    data: {
      title: DEAN_DAMASKOS_PROFILE_CONTENT.heroTitle,
      text: DEAN_DAMASKOS_PROFILE_CONTENT.heroText,
      operatorName: "Dean Damaskos",
    },
  },
  { type: "financialProfessionalProfile", data: DEAN_DAMASKOS_PROFILE_CONTENT },
  {
    type: "services",
    data: {
      items: [
        "Business protection",
        "Employee benefits",
        "Retirement planning",
        "Wealth strategy",
      ],
    },
  },
] as const;
