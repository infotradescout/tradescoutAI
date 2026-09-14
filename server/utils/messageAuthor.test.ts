import { describe, expect, it } from "vitest";
import { participantMessageMetadata } from "./messageAuthor";

describe("participant message authorship", () => {
  it.each(["homeowner", "contractor"] as const)(
    "replaces a claimed staff author with the authenticated %s",
    (kind) => {
      expect(
        participantMessageMetadata(
          { author: { kind: "staff", userId: "admin" }, quoteId: "quote-1" },
          "participant",
          kind
        )
      ).toEqual({ author: { kind, userId: "participant" }, quoteId: "quote-1" });
    }
  );
  it.each([null, '{"author":{"kind":"staff"}}', ["staff"]])(
    "does not deserialize client text or arrays into authority",
    (metadata) => {
      expect(participantMessageMetadata(metadata, "participant", "homeowner")).toEqual({
        author: { kind: "homeowner", userId: "participant" },
      });
    }
  );
});
