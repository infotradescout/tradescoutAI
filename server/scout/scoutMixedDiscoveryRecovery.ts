import { buildCommunityPostPath } from "../../shared/communityPostShare";

type CountyPost = {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  createdAt?: unknown;
  hasWorkRequest?: unknown;
};

function displayArea(countyLabel: string | undefined): string {
  const value = String(countyLabel || "").trim();
  return /^[a-z .'-]+, [a-z]{2}$/i.test(value) && value.length <= 80 ? value : "your county";
}

export function buildScoutMixedDiscoveryRecovery(input: {
  countyFips?: string | null;
  countyLabel?: string;
  communityPosts?: CountyPost[];
  now?: Date;
}) {
  if (!input.countyFips) {
    return {
      message:
        "Set your county so Scout can check nearby posts. I have not checked deals, businesses, pages, tools, or other requests yet. Nothing was sent.",
      entities: [],
      actions: [{ type: "NAVIGATE", label: "Set my local area", to: "/settings", primary: true }],
    };
  }

  const now = input.now ?? new Date();
  const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recentPosts = (input.communityPosts || []).filter((post) => {
    if (!buildCommunityPostPath(post.id)) return false;
    const created = new Date(String(post.createdAt || "")).getTime();
    return Number.isFinite(created) && created >= weekStart && created <= now.getTime();
  });

  const entities = recentPosts.slice(0, 3).map((post) => ({
    id: String(post.id),
    type: "community_post",
    name:
      String(post.title || post.content || "County post")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 110) || "County post",
    url: buildCommunityPostPath(post.id),
    match_reasons: [
      post.hasWorkRequest === true ? "Published local request" : "Published county post",
      "From the last 7 days",
    ],
  }));

  const area = displayArea(input.countyLabel);
  const firstSentence = recentPosts.length
    ? `This Scout check found ${recentPosts.length} published county ${recentPosts.length === 1 ? "post" : "posts"} from the last 7 days in ${area}.`
    : `I could not verify a county post from the last 7 days in this Scout result for ${area}.`;

  return {
    message: `${firstSentence} I checked recent county posts only. I have not checked deals, businesses, pages, tools, or other requests yet. Open Community or Businesses to continue; nothing was sent.`,
    entities,
    actions: [
      {
        type: "NAVIGATE",
        label: "Open recent Community",
        to: "/community-feed?geo=local&feed=recent",
        primary: true,
      },
      { type: "NAVIGATE", label: "Browse Businesses", to: "/contractors" },
    ],
  };
}
