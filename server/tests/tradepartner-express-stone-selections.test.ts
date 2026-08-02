import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerTradePartnerExpressRoutes } from "../routes/tradepartner-express";
import { validateExpressStoneSelections } from "../jwStoneExpressSelections";

const app = express();
app.use(express.json());
registerTradePartnerExpressRoutes(app);

const validRequestBody = {
  name: "Alex Smith",
  email: "alex@example.com",
  phone: "555-555-1212",
  requestType: "request_material",
  message: "Please contact me about these stone selections.",
};

describe("JW Stone plural Express Direct Connect selections", () => {
  it("accepts named selections and returns canonical registry labels", () => {
    expect(
      validateExpressStoneSelections({
        profileSlug: "jw-stone",
        stoneSelections: [
          { itemId: "galaxy-white", stoneName: "Galaxy White" },
          { itemId: "white-springs", stoneName: "White Springs" },
          { itemId: "nilo-river", stoneName: "Nilo River" },
        ],
      })
    ).toEqual({
      success: true,
      selections: [
        { itemId: "galaxy-white", stoneName: "Galaxy White" },
        { itemId: "white-springs", stoneName: "White Springs" },
        { itemId: "nilo-river", stoneName: "Nilo River" },
      ],
    });
  });

  it.each(["Customer supplied label", "Unnamed slab", "Trending Selection 05"])(
    "rejects a non-canonical or placeholder client label: %s",
    (stoneName) => {
      const result = validateExpressStoneSelections({
        profileSlug: "jw-stone",
        stoneSelections: [{ itemId: "galaxy-white", stoneName }],
      });

      expect(result).toEqual({ success: false, reason: "stone_name_mismatch" });
      expect(JSON.stringify(result)).not.toContain(stoneName);
    }
  );

  it.each([
    [{ itemId: "trending-selection-05", stoneName: "Trending Selection 05" }],
    [{ itemId: "missing-from-jw-inventory", stoneName: "Galaxy White" }],
  ])("rejects anonymous or unknown inventory selections", (selection) => {
    expect(
      validateExpressStoneSelections({
        profileSlug: "jw-stone",
        stoneSelections: [selection],
      })
    ).toEqual({ success: false, reason: "unknown_or_unnamed_item" });
  });

  it("leaves the legacy singular path with no plural selection metadata", () => {
    expect(
      validateExpressStoneSelections({
        profileSlug: "jw-stone",
      })
    ).toEqual({ success: true, selections: [] });
  });

  it("does not expand plural stone metadata to unrelated profiles", () => {
    expect(
      validateExpressStoneSelections({
        profileSlug: "unrelated-profile",
        stoneSelections: [{ itemId: "galaxy-white", stoneName: "Galaxy White" }],
      })
    ).toEqual({ success: false, reason: "unsupported_profile" });
  });

  it("keeps the plural request schema strict and capped at 24 selections", async () => {
    const tooMany = await request(app)
      .post("/api/tradepartner-profiles/jw-stone/express-request")
      .send({
        ...validRequestBody,
        stoneSelections: Array.from({ length: 25 }, (_, index) => ({
          itemId: `selection-${index + 1}`,
          stoneName: `Selection ${index + 1}`,
        })),
      });
    expect(tooMany.status).toBe(400);

    const unknownNestedField = await request(app)
      .post("/api/tradepartner-profiles/jw-stone/express-request")
      .send({
        ...validRequestBody,
        stoneSelections: [
          { itemId: "galaxy-white", stoneName: "Galaxy White", privateLabel: "do not accept" },
        ],
      });
    expect(unknownNestedField.status).toBe(400);
  });
});
