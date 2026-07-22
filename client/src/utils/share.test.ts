import { describe, expect, it } from "vitest";
import { inferShareKind } from "./share";

describe("universal share context", () => {
  it.each([
    ["/community/post/post-1", "community_post"],
    ["/u/jw-stone", "profile"],
    ["/business/jw-stone", "business"],
    ["/exchange/tools/listing-1", "listing"],
    ["/contractor-promos/summer-offer", "offer"],
    ["/events/block-party", "event"],
    ["/about", "page"],
  ] as const)("classifies %s as %s", (destination, expected) => {
    expect(inferShareKind(destination)).toBe(expected);
  });
});
