type HomeProjectRouteAction = {
  type: "NAVIGATE";
  label: string;
  to: string;
  path: string;
  subtitle?: string;
  why?: string;
  primary?: boolean;
};

export type HomeProjectRouteResult = {
  intent: string;
  message: string;
  suggestedActions: string[];
  actions: HomeProjectRouteAction[];
  metadata: {
    intent: string;
    decision: string;
  };
};

function detectTradeTopic(message: string): string | null {
  const lower = message.toLowerCase();

  if (
    /(leak|clog|backup|sewer|drain|cleanout|p-trap|ptrap|trap arm|vent stack|sump pump|water heater|tankless|supply line|shutoff valve)/.test(
      lower
    )
  ) {
    return "plumbing";
  }

  if (
    /(panel upgrade|service panel|breaker panel|subpanel|gfci|g.f.c.i|afci|arc-fault|receptacle|outlet|dedicated circuit|240v|240 v|220v|220 v|load calculation|lighting circuit)/.test(
      lower
    )
  ) {
    return "electrical";
  }

  if (
    /(furnace|air handler|condenser|heat pump|mini split|hvac|ac not working|no cooling|no heat|refrigerant|freon)/.test(
      lower
    )
  ) {
    return "hvac";
  }

  if (
    /(shingle|roof deck|underlayment|flashing|ridge vent|soffit vent|drip edge|hail damage|wind damage|roof leak)/.test(
      lower
    )
  ) {
    return "roofing";
  }

  if (
    /(foundation crack|settling|heaving|pier and beam|slab foundation|mudjacking|helical pier|concrete leveling|spalling)/.test(
      lower
    )
  ) {
    return "foundation";
  }

  if (
    /(deck|decking|porch|patio|stairs|railing|guardrail|joist hanger|ledger board|composite deck|treated lumber)/.test(
      lower
    )
  ) {
    return "decking";
  }

  if (/(fence|fencing|gate post|privacy fence|chain link|wood fence|vinyl fence)/.test(lower)) {
    return "fencing";
  }

  if (/(siding|hardie|fiber cement|lap siding|board and batten|soffit|fascia)/.test(lower)) {
    return "siding";
  }

  if (
    /(concrete patio|driveway pour|slab pour|rebar grid|control joints|expansion joint|stamped concrete)/.test(
      lower
    )
  ) {
    return "concrete";
  }

  if (
    /(framing|load-bearing wall|header beam|lintel|rim joist|floor joist|wall stud|sister joist)/.test(
      lower
    )
  ) {
    return "framing";
  }

  return null;
}

export function maybeHandleHomeProjectRouting(args: {
  message: string;
  countyCode?: string;
  stateCode?: string;
}): HomeProjectRouteResult | null {
  const lower = args.message.toLowerCase();
  const tradeTopic = detectTradeTopic(args.message);
  const homeownerProjectVerb =
    /\b(i want|i need|help me|looking to|need to|plan to|trying to|quote|estimate|build|repair|replace|install|remodel|renovate)\b/.test(
      lower
    );
  const proBusinessContext =
    /\b(my client|for a customer|customer wants|my crew|my bid|my estimate|price this job|subcontract|subcontractor|my business|get more work|for my company)\b/.test(
      lower
    );

  if (!tradeTopic || !homeownerProjectVerb || proBusinessContext) {
    return null;
  }

  const normalizedCounty = typeof args.countyCode === "string" ? args.countyCode.trim() : "";
  const normalizedState =
    typeof args.stateCode === "string" ? args.stateCode.trim().toUpperCase() : "";
  let countyLabel = normalizedCounty;
  if (!countyLabel && normalizedState) {
    countyLabel = normalizedState;
  } else if (countyLabel && normalizedState) {
    const endsWithState = new RegExp(`\\b${normalizedState}\\b$`, "i").test(countyLabel);
    if (!endsWithState) {
      countyLabel = `${countyLabel}, ${normalizedState}`;
    }
  }
  const localityFragment = countyLabel ? ` in ${countyLabel}` : "";
  const planningAction: HomeProjectRouteAction = {
    type: "NAVIGATE",
    label: "Start or plan this project",
    to: "/project-tracker",
    path: "/project-tracker",
    subtitle: "Open project planning",
    why: "Best first step when you need to scope work, budget, and timeline before hiring",
    primary: true,
  };

  if (tradeTopic === "decking") {
    return {
      intent: "home_project_decking",
      message: `Got it. For a deck project${localityFragment}, start with:\n- Scope (size, layout, materials)\n- Budget range\n- Timing and permit checks\n\nOnce that is set, I can open deck builders, rental equipment, and local project signals. Want me to run that now?`,
      suggestedActions: [
        "Start or plan this project",
        "Find deck builders near me",
        "Browse rental equipment for this project",
        "Check local deck project signals",
      ],
      actions: [
        planningAction,
        {
          type: "NAVIGATE",
          label: "Find deck builders",
          to: "/direct-connect/pros",
          path: "/direct-connect/pros",
          subtitle: "Open local pros",
          why: "Use this once the scope is clear and you want real builders",
        },
        {
          type: "NAVIGATE",
          label: "Browse rental equipment",
          to: "/exchange/rental-equipment",
          path: "/exchange/rental-equipment",
          subtitle: "Compare tools and machinery",
          why: "Useful if you are pricing DIY, hybrid, or contractor-supported work",
        },
        {
          type: "NAVIGATE",
          label: "Check local deck project signals",
          to: "/community",
          path: "/community",
          subtitle: "See local project chatter",
          why: "Check what neighbors and local operators are seeing before you hire",
        },
      ],
      metadata: {
        intent: "home_project_decking",
        decision:
          "Handled through deterministic homeowner-project routing for deck/decking intent.",
      },
    };
  }

  return {
    intent: `home_project_${tradeTopic}`,
    message: `Got it. For this ${tradeTopic} project${localityFragment}, start with:\n- Scope and requirements\n- Budget range\n- Timeline\n\nAfter that, I can route you into trusted local pros, Exchange options, and local project signals. Want me to run that now?`,
    suggestedActions: [
      "Start or plan this project",
      `Find ${tradeTopic} pros near me`,
      "Browse relevant Exchange options",
      "Check local project signals before I hire",
    ],
    actions: [
      planningAction,
      {
        type: "NAVIGATE",
        label: "Find trusted local pros",
        to: "/direct-connect/pros",
        path: "/direct-connect/pros",
        subtitle: "Open local pros",
        why: `Use this once you want real providers for the ${tradeTopic} work`,
      },
      {
        type: "NAVIGATE",
        label: "Open Exchange",
        to: "/exchange",
        path: "/exchange",
        subtitle: "Compare items, rentals, and listings",
        why: "Useful for materials, rentals, and adjacent project needs",
      },
      {
        type: "NAVIGATE",
        label: "Open community signals",
        to: "/community",
        path: "/community",
        subtitle: "See local project chatter",
        why: "Check local signals before you hire or buy",
      },
    ],
    metadata: {
      intent: `home_project_${tradeTopic}`,
      decision: `Handled through deterministic homeowner-project routing for ${tradeTopic} intent.`,
    },
  };
}
