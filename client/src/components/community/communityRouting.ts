export type CommunityRoutedCategory = "request" | "forsale";

type CommunityRoutingArgs = {
  category?: string;
  postId: string;
  content: string;
  countyFips?: string;
  countyName?: string;
};

export function buildCommunityRoutedDestination({
  category,
  postId,
  content,
  countyFips,
  countyName,
}: CommunityRoutingArgs): string | null {
  const normalizedPostId = postId.trim();
  const description = content.trim();
  if (!normalizedPostId || !description) return null;

  const title = description.split(/\r?\n/, 1)[0].slice(0, 90) || "Local request";

  if (category === "request") {
    const params = new URLSearchParams({
      intent: "fix_improve",
      source: "community_post",
      postId: normalizedPostId,
      title,
      description,
    });
    if (countyFips?.trim()) params.set("county", countyFips.trim());
    return `/direct-connect?${params.toString()}`;
  }

  if (category === "forsale") {
    const params = new URLSearchParams({
      tab: "sell",
      source: "community_post",
      postId: normalizedPostId,
      title,
      description,
    });
    if (countyName?.trim()) params.set("loc", countyName.trim());
    return `/exchange?${params.toString()}`;
  }

  return null;
}
