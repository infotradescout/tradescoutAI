import { describe, expect, it } from "vitest";
import { finalizeScoutResponse } from "../scout/scoutResponseContract";
import {
  SCOUT_RESULT_CONTRACT_VERSION,
  inferScoutResultIntentV1,
} from "../scout/scoutResultContractV1";

describe("Scout result contract v1", () => {
  it("emits the complete versioned server-owned shape for every Scout response", () => {
    const result = finalizeScoutResponse(
      {
        message: "I found the applicable permit guidance.",
        suggestedActions: ["Compare the permit steps"],
        actions: [
          {
            type: "NAVIGATE",
            label: "Open permit guide",
            to: "/guides/permits",
            primary: true,
          },
        ],
        publicEntities: [
          {
            type: "guide",
            id: "permit-guide",
            href: "/guides/permits",
          },
        ],
        knowledge: {
          sources: [
            {
              title: "County permit office",
              url: "https://example.gov/permits",
              type: "official",
            },
          ],
        },
      },
      {
        requestMessage: "What permit do I need for this work?",
        workingMemoryUpdate: {
          applied: true,
          kind: "decision",
        },
      }
    ) as any;

    expect(result.contract_version).toBe(SCOUT_RESULT_CONTRACT_VERSION);
    expect(result.intent).toBe("code_query");
    expect(result.answer).toBe(result.message);
    expect(result.ambiguity_options).toEqual([]);
    expect(result.entities).toEqual([
      {
        id: "permit-guide",
        type: "guide",
        url: "/guides/permits",
      },
    ]);
    expect(result.evidence).toEqual([
      expect.objectContaining({
        title: "County permit office",
        url: "https://example.gov/permits",
        type: "official",
      }),
    ]);
    expect(result.allowed_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action_id: "act_1",
          type: "NAVIGATE",
          label: "Open permit guide",
          target: "/guides/permits",
          requires_confirmation: false,
        }),
        expect.objectContaining({
          type: "ASK_SCOUT",
          label: "Compare the permit steps",
        }),
      ])
    );
    expect(result.working_memory_update).toEqual({
      applied: true,
      kind: "decision",
    });
  });

  it("keeps internal evidence visible without inventing a URL", () => {
    const result = finalizeScoutResponse(
      {
        message: "This came from TradeScout data.",
        knowledge: { sources: ["TradeScout Database (contractors)"] },
      },
      { requestMessage: "Find a roofer near me." }
    ) as any;

    expect(result.intent).toBe("provider_search");
    expect(result.evidence[0]).toMatchObject({
      title: "TradeScout Database (contractors)",
      url: null,
    });
  });

  it("turns server ambiguity choices into real allowed actions", () => {
    const result = finalizeScoutResponse(
      {
        message: "Choose the kind of help you want.",
      },
      { requestMessage: "Help me" }
    ) as any;

    expect(result.ambiguity_options).toHaveLength(3);
    const allowedIds = new Set(
      result.allowed_actions.map((action: { action_id: string }) => action.action_id)
    );
    for (const option of result.ambiguity_options) {
      expect(allowedIds.has(option.action_id)).toBe(true);
    }
  });

  it("classifies the three bounded Scout intent families on the server", () => {
    expect(inferScoutResultIntentV1("Find a licensed electrician near me").intent).toBe(
      "provider_search"
    );
    expect(inferScoutResultIntentV1("What code applies to this panel?").intent).toBe(
      "code_query"
    );
    expect(inferScoutResultIntentV1("Update my project listing").intent).toBe(
      "asset_action"
    );
    expect(
      inferScoutResultIntentV1(
        "Do I need a permit to replace an electrical service panel in Pensacola, FL?"
      ).intent
    ).toBe("code_query");
    expect(
      inferScoutResultIntentV1(
        "Remove pressure washing and add roof inspection photography to my profile services."
      ).intent
    ).toBe("asset_action");
  });
});
