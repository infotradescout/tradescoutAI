import type { JwStone2BuyerType } from "@/features/jw-stone-2/types";

export type BuyerWorkspaceCopy = {
  label: string;
  shortLabel: string;
  eyebrow: string;
  heading: string;
  introduction: string;
  choiceSummary: string;
};

export const BUYER_WORKSPACES: Record<JwStone2BuyerType, BuyerWorkspaceCopy> = {
  fabricator: {
    label: "Fabricator Desk",
    shortLabel: "Fabricator",
    eyebrow: "Details at working speed",
    heading: "Compare each stone side by side.",
    introduction:
      "Review material, verified finishes, recorded quantities, and full galleries without assuming live stock.",
    choiceSummary: "Technical facts, close galleries, and quick comparison.",
  },
  builder: {
    label: "Builder Project Room",
    shortLabel: "Builder",
    eyebrow: "A project-ready shortlist",
    heading: "Gather the stones worth carrying into the next project conversation.",
    introduction:
      "Build a local project list, review the verified facts together, and contact JW only when you are ready.",
    choiceSummary: "A planning list for project and team review.",
  },
  designer: {
    label: "Designer Selection Board",
    shortLabel: "Designer",
    eyebrow: "Visual selection, grounded in facts",
    heading: "Read the collection through image, movement, and verified specification.",
    introduction:
      "Make a clean visual board from real JW photography, with available material and verified finish details beside it.",
    choiceSummary: "Large imagery and a refined side-by-side board.",
  },
  homeowner: {
    label: "Homeowner Stone Finder",
    shortLabel: "Homeowner",
    eyebrow: "A clearer way into natural stone",
    heading: "Start with what you want the room to feel like.",
    introduction:
      "Explore real stone photographs in plain language, save what stands out, and ask when you want help.",
    choiceSummary: "Simple visual guidance without trade jargon.",
  },
};

export function buyerLabel(buyer: JwStone2BuyerType | null) {
  return buyer ? BUYER_WORKSPACES[buyer].shortLabel : "Choose your path";
}
