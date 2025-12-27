export type BadgeType = "status" | "progress" | "secret";

export type BadgeDef = {
  id: string;
  type: BadgeType;
  xpBurst: number;
  isSecret: boolean;
};

export const Badges: Record<string, BadgeDef> = {
  founder: { id: "founder", type: "status", xpBurst: 1000, isSecret: false },
  verified: { id: "verified", type: "status", xpBurst: 500, isSecret: false },
  community_steward: {
    id: "community_steward",
    type: "status",
    xpBurst: 750,
    isSecret: false,
  },

  explorer: { id: "explorer", type: "progress", xpBurst: 150, isSecret: false },
  conversationalist: {
    id: "conversationalist",
    type: "progress",
    xpBurst: 150,
    isSecret: false,
  },
  helper: { id: "helper", type: "progress", xpBurst: 150, isSecret: false },
  local: { id: "local", type: "progress", xpBurst: 150, isSecret: false },
  regular: { id: "regular", type: "progress", xpBurst: 150, isSecret: false },
  record_keeper: {
    id: "record_keeper",
    type: "progress",
    xpBurst: 150,
    isSecret: false,
  },
  organizer: { id: "organizer", type: "progress", xpBurst: 150, isSecret: false },
  connector: { id: "connector", type: "progress", xpBurst: 150, isSecret: false },

  lurker: { id: "lurker", type: "secret", xpBurst: 100, isSecret: true },
  night_owl: { id: "night_owl", type: "secret", xpBurst: 150, isSecret: true },
  beta_explorer: {
    id: "beta_explorer",
    type: "secret",
    xpBurst: 200,
    isSecret: true,
  },
};
