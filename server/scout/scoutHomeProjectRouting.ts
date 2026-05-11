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

function buildProsPath(tradeTopic: string, countyCode?: string, stateCode?: string): string {
  const params = new URLSearchParams();

  if (tradeTopic) {
    params.set("trade", tradeTopic);
  }

  if (typeof countyCode === "string" && countyCode.trim().length > 0) {
    params.set("county", countyCode.trim());
  }

  if (typeof stateCode === "string" && stateCode.trim().length > 0) {
    params.set("state", stateCode.trim().toUpperCase());
  }

  const query = params.toString();
  return query ? `/direct-connect/pros?${query}` : "/direct-connect/pros";
}

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
    /(roofing|roofer|roof\b|shingle|roof deck|underlayment|flashing|ridge vent|soffit vent|drip edge|hail damage|wind damage|roof leak)/.test(
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

  if (!tradeTopic || (!homeownerProjectVerb && !proBusinessContext)) {
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

  const prosPath = buildProsPath(tradeTopic, normalizedCounty, normalizedState);

  if (tradeTopic === "decking") {
    if (proBusinessContext) {
      return {
        intent: "client_project_decking",
        message:
          "Got it. If this deck is for a client, start with the job scope and material/quote prep. Scout can help draft the pieces, but you approve anything before it is sent.",
        suggestedActions: ["Scope the client deck job", "Start materials or quote prep"],
        actions: [
          {
            type: "NAVIGATE",
            label: "Scope the client deck job",
            to: "/project-tracker",
            path: "/project-tracker",
            subtitle: "Open project planning",
            primary: true,
          },
          {
            type: "NAVIGATE",
            label: "Start a material run",
            to: "/utilities/supply-run",
            path: "/utilities/supply-run",
            subtitle: "Use a material list or supplier link",
          },
          {
            type: "NAVIGATE",
            label: "Open invoices",
            to: "/finances",
            path: "/finances",
            subtitle: "Draft and review before sending",
          },
        ],
        metadata: {
          intent: "client_project_decking",
          decision: "Handled through deterministic project support for client deck work.",
        },
      };
    }

    return {
      intent: "home_project_decking",
      message: `Got it. A deck can start two ways: plan the project first, or compare deck help${localityFragment}. Contact only opens when you choose a specific pro.`,
      suggestedActions: ["Plan the deck project", "Find deck help"],
      actions: [
        {
          type: "NAVIGATE",
          label: "Plan the deck project",
          to: "/project-tracker",
          path: "/project-tracker",
          subtitle: "Scope, materials, and permit checks",
          primary: true,
        },
        {
          type: "NAVIGATE",
          label: "Find deck help",
          to: prosPath,
          path: prosPath,
          subtitle: "Compare local options",
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
    message: `Got it. I can show ${tradeTopic} pros${localityFragment} right now without requiring an account. You'll only be asked to sign in when you choose to open contact with a specific pro.`,
    suggestedActions: ["Start or plan this project", `Show ${tradeTopic} pros in my area`],
    actions: [
      planningAction,
      {
        type: "NAVIGATE",
        label: `Show ${tradeTopic} pros`,
        to: prosPath,
        path: prosPath,
        subtitle: "Open directory",
      },
    ],
    metadata: {
      intent: `home_project_${tradeTopic}`,
      decision: `Handled through deterministic homeowner-project routing for ${tradeTopic} intent.`,
    },
  };
}
