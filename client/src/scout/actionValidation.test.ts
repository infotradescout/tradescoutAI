import { describe, expect, it } from "vitest";
import { resolveLatestScoutTurnActionTruth, validateAction } from "./actionValidation";
import { scoutReducer, type ScoutAction, type ScoutMessage, type ScoutState } from "./state";
import type {
  ScoutAllowedActionV1,
  ScoutAmbiguityOptionV1,
  ScoutResultContractV1,
} from "@shared/types/scout";

let messageSequence = 0;

const userMessage = (content = "I need flooring help"): ScoutMessage => ({
  id: `user-${(messageSequence += 1)}`,
  role: "user",
  content,
  timestamp: "2026-08-21T10:00:00.000Z",
});

const assistantMessage = (overrides: Partial<ScoutMessage> = {}): ScoutMessage => ({
  id: `assistant-${(messageSequence += 1)}`,
  role: "assistant",
  content: "Here is the latest result.",
  timestamp: "2026-08-21T10:00:01.000Z",
  ...overrides,
});

const allowedAction = (overrides: Partial<ScoutAllowedActionV1> = {}): ScoutAllowedActionV1 => ({
  action_id: `action-${(messageSequence += 1)}`,
  type: "NAVIGATE",
  label: "Open Community",
  target: "/community",
  primary: true,
  requires_confirmation: false,
  ...overrides,
});

const resultContract = (
  actions: ScoutAllowedActionV1[],
  ambiguity: ScoutAmbiguityOptionV1[] = []
): ScoutResultContractV1 => ({
  contract_version: "scout_result.v1",
  intent: "provider_search",
  ambiguity_options: ambiguity,
  entities: [],
  evidence: [],
  answer: "Here is the latest result.",
  allowed_actions: actions,
  working_memory_update: {},
});

describe("actionValidation", () => {
  it("allows pre-scout setup navigation", () => {
    const action = validateAction({
      type: "NAVIGATE",
      label: "Create account",
      to: "/pre-scout-setup?mode=create",
    });

    expect(action).toEqual({
      type: "NAVIGATE",
      label: "Create account",
      to: "/pre-scout-setup?mode=create",
      path: "/pre-scout-setup?mode=create",
    });
  });

  it("allows auth provider callback routes", () => {
    const action = validateAction({
      type: "NAVIGATE",
      label: "Continue with Google",
      to: "/api/auth/google",
    });

    expect(action).toEqual({
      type: "NAVIGATE",
      label: "Continue with Google",
      to: "/api/auth/google",
      path: "/api/auth/google",
    });
  });

  it("blocks unallowlisted internal routes", () => {
    const action = validateAction({
      type: "NAVIGATE",
      label: "Unknown route",
      to: "/totally-unknown-route",
    });

    expect(action).toBeNull();
  });

  it("allows normal user Scout and Supply Run routes", () => {
    for (const to of [
      "/homes",
      "/vehicles",
      "/messages",
      "/utilities/supply-run",
      "/utilities/supply-run/new?supplierUrl=https%3A%2F%2Fexample.com%2Fproduct",
      "/finances/materials",
    ]) {
      const action = validateAction({
        type: "NAVIGATE",
        label: "Open",
        to,
      });

      expect(action?.to).toBe(to);
    }
  });

  it("allows tool calls that the Scout action router owns", () => {
    const action = validateAction({
      type: "CALL_TOOL",
      label: "Helpful",
      payload: { name: "ads.feedback", adId: "ad_1", rating: "helpful" },
    });

    expect(action?.type).toBe("CALL_TOOL");
  });

  it("blocks unsupported tool calls", () => {
    const action = validateAction({
      type: "CALL_TOOL",
      label: "Send message",
      payload: { name: "messages.send", text: "Hello" },
    });

    expect(action).toBeNull();
  });
});

describe("latest Scout turn action truth", () => {
  it("clears prior controller actions as soon as a new user turn begins", () => {
    const previousAction: ScoutAction = {
      type: "NAVIGATE",
      label: "Old action",
      to: "/community",
      primary: true,
    };
    const state: ScoutState = {
      messages: [userMessage(), assistantMessage()],
      status: "idle",
      error: null,
      lastActions: [previousAction],
    };

    const next = scoutReducer(state, { type: "USER_MESSAGE", content: "One more detail" });

    expect(next.status).toBe("resolving_context");
    expect(next.lastActions).toEqual([]);
    expect(next.messages.at(-1)?.role).toBe("user");
  });

  it("suppresses prior or current actions on a new, busy, or error turn", () => {
    const primary = allowedAction();
    const completed = [
      userMessage(),
      assistantMessage({ resultContract: resultContract([primary]) }),
    ];
    const newTurn = [...completed, userMessage("Here is another constraint")];
    const lastActions: ScoutAction[] = [
      { type: "NAVIGATE", label: primary.label, to: primary.target, primary: true },
    ];

    expect(
      resolveLatestScoutTurnActionTruth({ messages: newTurn, lastActions, status: "idle" })
        .dominantAction
    ).toBeNull();
    for (const status of [
      "resolving_context",
      "checking_documents",
      "executing_action",
      "error",
    ] as const) {
      expect(
        resolveLatestScoutTurnActionTruth({ messages: completed, lastActions, status })
          .dominantAction
      ).toBeNull();
    }
  });

  it("does not resurrect an older action when the latest v1 result has no actions", () => {
    const oldPrimary = allowedAction({ label: "Old primary", target: "/projects" });
    const latest = assistantMessage({
      resultContract: resultContract([]),
      clusters: [
        {
          id: "legacy",
          title: "Legacy",
          kind: "community",
          primaryAction: {
            type: "NAVIGATE",
            label: "Legacy primary",
            to: "/community",
          },
        },
      ],
      frame: {
        truthLines: [],
        actionChips: [
          {
            id: "legacy-frame",
            label: "Legacy frame primary",
            kind: "NAVIGATE",
            target: "/exchange",
            priority: "primary",
          },
        ],
      },
    });
    const truth = resolveLatestScoutTurnActionTruth({
      messages: [
        userMessage("First turn"),
        assistantMessage({ resultContract: resultContract([oldPrimary]) }),
        userMessage("Latest turn"),
        latest,
      ],
      lastActions: [{ type: "NAVIGATE", label: "Old primary", to: "/projects", primary: true }],
      status: "idle",
    });

    expect(truth.source).toBe("v1");
    expect(truth.actions).toEqual([]);
    expect(truth.dominantAction).toBeNull();
  });

  it("never promotes an action while the latest v1 result is ambiguous", () => {
    const primary = allowedAction();
    const truth = resolveLatestScoutTurnActionTruth({
      messages: [
        userMessage(),
        assistantMessage({
          resultContract: resultContract(
            [primary],
            [{ label: "Which Community view?", action_id: primary.action_id }]
          ),
        }),
      ],
      status: "idle",
    });

    expect(truth.actions).toHaveLength(1);
    expect(truth.dominantAction).toBeNull();
  });

  it("filters invalid and downgraded NOOP candidates", () => {
    const truth = resolveLatestScoutTurnActionTruth({
      messages: [
        userMessage(),
        assistantMessage({
          resultContract: resultContract([
            allowedAction({ type: "HACK_THE_MAINFRAME", target: "/community" }),
            allowedAction({ target: "/admin/secret" }),
          ]),
        }),
      ],
      status: "idle",
    });

    expect(truth.actions).toEqual([]);
    expect(truth.dominantAction).toBeNull();
  });

  it("promotes exactly one explicit primary but never zero or multiple primaries", () => {
    const primary = allowedAction({ label: "Open local posts", target: "/community" });
    const secondary = allowedAction({
      label: "Open Exchange",
      target: "/exchange",
      primary: false,
    });
    const messages = [
      userMessage(),
      assistantMessage({ resultContract: resultContract([primary, secondary]) }),
    ];

    expect(
      resolveLatestScoutTurnActionTruth({ messages, status: "idle" }).dominantAction?.label
    ).toBe("Open local posts");

    const noPrimary = assistantMessage({
      resultContract: resultContract([{ ...primary, primary: false }, secondary]),
    });
    expect(
      resolveLatestScoutTurnActionTruth({
        messages: [userMessage(), noPrimary],
        status: "idle",
      }).dominantAction
    ).toBeNull();

    const multiplePrimary = assistantMessage({
      resultContract: resultContract([primary, { ...secondary, primary: true }]),
    });
    expect(
      resolveLatestScoutTurnActionTruth({
        messages: [userMessage(), multiplePrimary],
        status: "idle",
      }).dominantAction
    ).toBeNull();
  });

  it("uses validated legacy cluster or frame actions only when no v1 result exists", () => {
    const clusterTruth = resolveLatestScoutTurnActionTruth({
      messages: [
        userMessage(),
        assistantMessage({
          clusters: [
            {
              id: "local",
              title: "Local options",
              kind: "community",
              primaryAction: {
                type: "NAVIGATE",
                label: "Open local posts",
                to: "/community",
              },
            },
          ],
        }),
      ],
      status: "idle",
    });
    expect(clusterTruth.source).toBe("legacy");
    expect(clusterTruth.dominantAction?.label).toBe("Open local posts");

    const frameTruth = resolveLatestScoutTurnActionTruth({
      messages: [
        userMessage(),
        assistantMessage({
          frame: {
            truthLines: [],
            actionChips: [
              {
                id: "frame-primary",
                label: "Open Exchange",
                kind: "NAVIGATE",
                target: "/exchange",
                priority: "primary",
              },
            ],
          },
        }),
      ],
      status: "idle",
    });
    expect(frameTruth.source).toBe("legacy");
    expect(frameTruth.dominantAction?.label).toBe("Open Exchange");
  });
});
