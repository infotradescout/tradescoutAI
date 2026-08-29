import { describe, expect, it } from "vitest";
import {
  computeDirectConnectFunnelStalls,
  normalizeDirectConnectFunnelEvent,
  type DirectConnectFunnelEventRow,
  type ExistingDirectConnectFunnelStall,
} from "../services/directConnectFunnelIntegrityCore";

const now = new Date("2026-08-29T18:00:00.000Z");
const windowMs = 30 * 60 * 1000;
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);
const event = (
  eventType: string,
  minutes: number,
  identityKey = "u:1"
): DirectConnectFunnelEventRow => ({ identityKey, eventType, createdAt: ago(minutes) });
const compute = (
  events: DirectConnectFunnelEventRow[],
  alreadyStalled: ExistingDirectConnectFunnelStall[] = []
) => computeDirectConnectFunnelStalls({ events, alreadyStalled, windowMs, now });

describe("Direct Connect server-derived funnel stalls", () => {
  it("normalizes both visibility names into one milestone", () => {
    expect(
      normalizeDirectConnectFunnelEvent("direct_connect_request_visible_to_contractors")
    ).toBe("direct_connect_visible_to_contractors");
  });

  it("stalls at the highest stage actually reached", () => {
    expect(compute([event("direct_connect_request_started", 60)])[0]?.funnelStep).toBe(
      "direct_connect_request_started"
    );

    expect(
      compute([
        event("direct_connect_request_started", 90),
        event("direct_connect_request_review_opened", 60),
      ])[0]?.funnelStep
    ).toBe("direct_connect_request_review_opened");

    expect(
      compute([
        event("direct_connect_request_started", 100),
        event("direct_connect_request_review_opened", 95),
        event("direct_connect_request_submitted", 60),
      ])[0]?.funnelStep
    ).toBe("direct_connect_request_submitted");

    expect(
      compute([
        event("direct_connect_request_started", 120),
        event("direct_connect_request_submitted", 100),
        event("direct_connect_request_visible_to_contractors", 60),
      ])[0]?.funnelStep
    ).toBe("direct_connect_visible_to_contractors");

    expect(
      compute([
        event("direct_connect_request_started", 140),
        event("direct_connect_request_submitted", 130),
        event("direct_connect_visible_to_contractors", 120),
        event("direct_connect_contractor_action_started", 60),
      ])[0]?.funnelStep
    ).toBe("direct_connect_contractor_action_started");
  });

  it("does not stall a completed sequence or a recent active step", () => {
    expect(
      compute([
        event("direct_connect_request_started", 160),
        event("direct_connect_request_review_opened", 150),
        event("direct_connect_request_submitted", 140),
        event("direct_connect_visible_to_contractors", 130),
        event("direct_connect_contractor_action_started", 120),
        event("direct_connect_requester_reply_viewed", 60),
      ])
    ).toEqual([]);

    expect(
      compute([
        event("direct_connect_request_started", 80),
        event("direct_connect_request_review_opened", 10),
      ])
    ).toEqual([]);
  });

  it("evaluates separate request attempts independently", () => {
    const stalls = compute([
      event("direct_connect_request_started", 180),
      event("direct_connect_request_submitted", 175),
      event("direct_connect_requester_reply_viewed", 170),
      event("direct_connect_request_started", 90),
      event("direct_connect_request_review_opened", 60),
    ]);

    expect(stalls).toHaveLength(1);
    expect(stalls[0]).toMatchObject({
      funnelStep: "direct_connect_request_review_opened",
      startedAt: ago(90),
    });
  });

  it("deduplicates the exact attempt and stage while allowing a later-stage stall", () => {
    const startedAt = ago(120);
    const events: DirectConnectFunnelEventRow[] = [
      {
        identityKey: "u:1",
        eventType: "direct_connect_request_started",
        createdAt: startedAt,
      },
      event("direct_connect_request_review_opened", 60),
    ];

    expect(
      compute(events, [
        {
          identityKey: "u:1",
          startedAt,
          funnelStep: "direct_connect_request_review_opened",
        },
      ])
    ).toEqual([]);

    expect(
      compute(
        [...events, event("direct_connect_request_submitted", 40)],
        [
          {
            identityKey: "u:1",
            startedAt,
            funnelStep: "direct_connect_request_review_opened",
          },
        ]
      )[0]?.funnelStep
    ).toBe("direct_connect_request_submitted");
  });

  it("preserves legacy attempt-wide dedupe and rejects pre-start noise", () => {
    const startedAt = ago(120);
    expect(
      compute(
        [
          {
            identityKey: "u:1",
            eventType: "direct_connect_request_started",
            createdAt: startedAt,
          },
          event("direct_connect_request_review_opened", 60),
        ],
        [{ identityKey: "u:1", startedAt }]
      )
    ).toEqual([]);

    expect(
      compute([
        event("direct_connect_request_review_opened", 60),
        event("unrelated_event", 50),
      ])
    ).toEqual([]);
  });

  it("fails closed for invalid timestamps and invalid windows", () => {
    expect(
      computeDirectConnectFunnelStalls({
        events: [
          {
            identityKey: "u:1",
            eventType: "direct_connect_request_started",
            createdAt: new Date("invalid"),
          },
        ],
        alreadyStalled: [],
        windowMs,
        now,
      })
    ).toEqual([]);

    expect(
      computeDirectConnectFunnelStalls({
        events: [event("direct_connect_request_started", 60)],
        alreadyStalled: [],
        windowMs: -1,
        now,
      })
    ).toEqual([]);
  });
});
