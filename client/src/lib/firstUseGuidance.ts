export const TRADE_SCOUT_PRODUCT_EXPLANATION =
  "TradeScout organizes local work before contact happens.";

export const TRADE_SCOUT_PRODUCT_EXPLANATION_SHORT =
  "Scout shows what is happening. HomeID keeps the record. Direct Connect creates the request.";

export const SCOUT_GUIDANCE_TEXT =
  "Scout shows local activity, saved context, HomeID updates, request history, and items worth reviewing.";

export const HOMEID_GUIDANCE_TEXT =
  "HomeID stores property details, systems, documents, requests, completed work, and evidence in one place.";

export const DIRECT_CONNECT_GUIDANCE_TEXT =
  "Direct Connect lets you prepare and submit a clear local work request before anyone is contacted.";

export type FirstUsefulStepOption = {
  id: string;
  label: string;
  description: string;
  href: string;
};

export const FIRST_USE_STEP_OPTIONS: FirstUsefulStepOption[] = [
  {
    id: "fix_improve",
    label: "Fix or improve my home",
    description: "Open Direct Connect and start a request with HomeID link context.",
    href: "/direct-connect?intent=fix_improve&homeContext=prompt_link",
  },
  {
    id: "keep_track",
    label: "Keep track of my home",
    description: "Open HomeID and add your first detail.",
    href: "/homes",
  },
  {
    id: "create_request",
    label: "Create a local work request",
    description: "Start a request and submit when ready.",
    href: "/direct-connect",
  },
  {
    id: "review_activity",
    label: "Review local activity",
    description: "Open Scout to review local context and updates.",
    href: "/scout",
  },
  {
    id: "continue_saved",
    label: "Continue something I started",
    description: "Open Scout and continue your saved context.",
    href: "/scout?tab=continue",
  },
  {
    id: "just_looking",
    label: "Just looking",
    description: "Browse Scout without starting a request.",
    href: "/scout",
  },
];
