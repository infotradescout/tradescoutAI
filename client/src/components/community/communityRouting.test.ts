import { describe, expect, it } from "vitest";
import { buildCommunityRoutedDestination } from "./communityRouting";

describe("Community outcome routing", () => {
  it("carries a county help signal into a Direct Connect request", () => {
    const destination = buildCommunityRoutedDestination({
      category: "request",
      postId: "post-123",
      content: "Need a licensed electrician\nThe kitchen breaker keeps tripping.",
      countyFips: "12033",
      countyName: "Escambia County",
    });
    const url = new URL(destination!, "https://www.thetradescout.com");

    expect(url.pathname).toBe("/direct-connect");
    expect(url.searchParams.get("intent")).toBe("fix_improve");
    expect(url.searchParams.get("source")).toBe("community_post");
    expect(url.searchParams.get("postId")).toBe("post-123");
    expect(url.searchParams.get("county")).toBe("12033");
    expect(url.searchParams.get("description")).toContain("breaker keeps tripping");
  });

  it("carries a local sale signal into the Exchange listing flow", () => {
    const destination = buildCommunityRoutedDestination({
      category: "forsale",
      postId: "post-456",
      content: "Unused tile saw\nGood condition, pickup only.",
      countyName: "Escambia County",
    });
    const url = new URL(destination!, "https://www.thetradescout.com");

    expect(url.pathname).toBe("/exchange");
    expect(url.searchParams.get("tab")).toBe("sell");
    expect(url.searchParams.get("source")).toBe("community_post");
    expect(url.searchParams.get("postId")).toBe("post-456");
    expect(url.searchParams.get("loc")).toBe("Escambia County");
  });

  it("does not reroute ordinary community signals", () => {
    expect(
      buildCommunityRoutedDestination({
        category: "question",
        postId: "post-789",
        content: "Does anyone know when the road reopens?",
      })
    ).toBeNull();
  });
});
