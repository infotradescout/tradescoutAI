// COMMUNITY_TONE defines shared language fragments for how TradeScout
// talks about accountability, locality, and transparency in community
// contexts. These phrases:
// - MAY describe where recommendations are visible and who can see them.
// - MAY emphasize that endorsements are tied to real people and place.
// - MUST NOT imply consensus, correctness, or that "the community" agrees.
// - MUST NOT overstate approval, guarantees, or majority opinion.
// They are connective tissue for explaining visibility and locality only,
// never a claim that something is objectively right or universally trusted.
export const COMMUNITY_TONE = {
  accountability: "visible and accountable, not anonymous",
  locality: "people in your area",
  transparency: "out in the open",
} as const;

export type CommunityToneKey = keyof typeof COMMUNITY_TONE;
