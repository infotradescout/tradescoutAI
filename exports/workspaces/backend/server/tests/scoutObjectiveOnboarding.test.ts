import { describe, expect, it, vi } from "vitest";
import ScoutObjectiveOnboarding, {
  type ObjectiveOnboardingInput,
  type OnboardingObjectiveState,
  type ObjectiveSuggestion,
} from "../services/scoutObjectiveOnboarding";

describe("ScoutObjectiveOnboarding", () => {
  const homeownerInput: ObjectiveOnboardingInput = {
    userId: "user-1",
    role: "homeowner",
    countyFips: "48201",
    stateCode: "TX",
    seasonHint: "spring",
    objectiveStates: [
      {
        objectiveId: "homeowner_local_network",
        status: "completed",
        completionPct: 100,
        updatedAt: "2026-03-08T15:00:00.000Z",
      },
    ],
  };

  it("suggests high-value objectives by role and season", () => {
    const suggestions = ScoutObjectiveOnboarding.suggestObjectives(homeownerInput);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].expectedValueScore).toBeGreaterThanOrEqual(
      suggestions[1]?.expectedValueScore ?? 0
    );
    expect(suggestions.some((s) => s.id === "homeowner_spring_maintenance")).toBe(true);
  });

  it("removes completed objectives from suggestions", () => {
    const suggestions = ScoutObjectiveOnboarding.suggestObjectives(homeownerInput);
    expect(suggestions.some((s) => s.id === "homeowner_local_network")).toBe(false);
  });

  it("builds fast-win cards with urgency and action labels", () => {
    const suggestions = ScoutObjectiveOnboarding.suggestObjectives(homeownerInput);
    const role = "homeowner" as const;
    const cards = ScoutObjectiveOnboarding.buildFastWinCards(
      role,
      suggestions,
      homeownerInput.objectiveStates
    );

    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].actionTarget.startsWith("/")).toBe(true);
    expect(cards.every((card) => ["low", "medium", "high"].includes(card.urgency))).toBe(true);
  });

  it("builds a full onboarding bundle including completion summary", () => {
    const bundle = ScoutObjectiveOnboarding.buildBundle(homeownerInput);

    expect(bundle.role).toBe("homeowner");
    expect(bundle.suggestions.length).toBeGreaterThan(0);
    expect(bundle.fastWins.length).toBeGreaterThan(0);
    expect(bundle.completionSummary.completedCount).toBe(1);
    expect(bundle.completionSummary.completionRate).toBeGreaterThanOrEqual(0);
  });

  it("tracks completion and recommends the next objective", () => {
    const states: OnboardingObjectiveState[] = [
      {
        objectiveId: "homeowner_spring_maintenance",
        status: "in_progress",
        completionPct: 65,
        updatedAt: "2026-03-08T15:00:00.000Z",
      },
    ];

    const suggestions = ScoutObjectiveOnboarding.suggestObjectives(homeownerInput);
    const updateResult = ScoutObjectiveOnboarding.trackCompletion(
      states,
      {
        objectiveId: "homeowner_spring_maintenance",
        completedAt: "2026-03-08T16:00:00.000Z",
      },
      suggestions
    );

    const updated = updateResult.states.find(
      (s) => s.objectiveId === "homeowner_spring_maintenance"
    );
    expect(updated?.status).toBe("completed");
    expect(updateResult.completionRate).toBeGreaterThan(0);
  });

  it("creates completion state when objective did not previously exist", () => {
    const suggestions = ScoutObjectiveOnboarding.suggestObjectives(homeownerInput);
    const updateResult = ScoutObjectiveOnboarding.trackCompletion(
      [],
      {
        objectiveId: "homeowner_trust_baseline",
      },
      suggestions
    );

    expect(updateResult.states.some((s) => s.objectiveId === "homeowner_trust_baseline")).toBe(
      true
    );
  });

  it("returns contractor-focused suggestions for contractor role", () => {
    const suggestions = ScoutObjectiveOnboarding.suggestObjectives({
      userId: "contractor-1",
      role: "contractor",
      countyFips: "06037",
      seasonHint: "summer",
    });

    expect(suggestions.some((s) => s.id.includes("contractor"))).toBe(true);
    expect(suggestions[0].expectedValueScore).toBeGreaterThan(80);
  });

  it("returns admin compliance objective for admin role", () => {
    const suggestions = ScoutObjectiveOnboarding.suggestObjectives({
      userId: "admin-1",
      role: "super_admin",
      countyFips: "36061",
      seasonHint: "fall",
    });

    expect(suggestions[0].id).toContain("admin");
    expect(suggestions[0].category).toMatch(/compliance|community/);
  });

  it("falls back to guest objective when role is absent", () => {
    const suggestions = ScoutObjectiveOnboarding.suggestObjectives({ userId: "guest-1" });

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].id).toContain("guest");
  });

  it("syncs fast win into objectives service through injected port", async () => {
    const objective: ObjectiveSuggestion = {
      id: "homeowner_spring_maintenance",
      title: "Start Spring Maintenance Plan",
      description: "desc",
      category: "seasonal",
      estimatedMinutes: 10,
      expectedValueScore: 90,
      recommendedRoute: "/direct-connect",
      starterPrompt: "Help me start my spring maintenance plan",
    };

    const syncObjective = vi.fn().mockResolvedValue({
      objectiveId: "obj-123",
      isNew: true,
      wasTopicShift: false,
      intentClass: "work_request",
      confidence: 0.88,
    });

    const result = await ScoutObjectiveOnboarding.syncFastWinToObjective(
      {
        userId: "user-1",
        objective,
        role: "homeowner",
        countyFips: "48201",
        stateCode: "TX",
      },
      { syncObjective }
    );

    expect(syncObjective).toHaveBeenCalledTimes(1);
    expect(syncObjective).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        messageText: objective.starterPrompt,
        userRole: "homeowner",
      })
    );
    expect(result?.objectiveId).toBe("obj-123");
  });

  it("keeps fast-win ordering deterministic for same inputs", () => {
    const suggestions = ScoutObjectiveOnboarding.suggestObjectives(homeownerInput);
    const first = ScoutObjectiveOnboarding.buildFastWinCards(
      "homeowner",
      suggestions,
      homeownerInput.objectiveStates
    );
    const second = ScoutObjectiveOnboarding.buildFastWinCards(
      "homeowner",
      suggestions,
      homeownerInput.objectiveStates
    );

    expect(second).toEqual(first);
  });

  it("computes pending count based on suggestions and state", () => {
    const bundle = ScoutObjectiveOnboarding.buildBundle({
      ...homeownerInput,
      objectiveStates: [
        {
          objectiveId: "homeowner_spring_maintenance",
          status: "completed",
          completionPct: 100,
          updatedAt: "2026-03-08T15:00:00.000Z",
        },
        {
          objectiveId: "homeowner_trust_baseline",
          status: "in_progress",
          completionPct: 40,
          updatedAt: "2026-03-08T15:30:00.000Z",
        },
      ],
    });

    expect(bundle.completionSummary.completedCount).toBe(1);
    expect(bundle.completionSummary.inProgressCount).toBe(1);
    expect(bundle.completionSummary.pendingCount).toBeGreaterThanOrEqual(0);
  });

  it("prefers higher value score objectives when suggesting next", () => {
    const suggestions = ScoutObjectiveOnboarding.suggestObjectives(homeownerInput);
    const completedStates: OnboardingObjectiveState[] = suggestions.slice(0, 1).map((s) => ({
      objectiveId: s.id,
      status: "completed",
      completionPct: 100,
      updatedAt: "2026-03-08T16:00:00.000Z",
    }));

    const result = ScoutObjectiveOnboarding.trackCompletion(
      completedStates,
      { objectiveId: suggestions[0]?.id || "none" },
      suggestions
    );

    if (suggestions.length > 1) {
      expect(result.nextRecommendedObjectiveId).toBe(suggestions[1].id);
    }
  });
});

describe("ScoutObjectiveOnboarding matrix coverage", () => {
  const roles = ["homeowner", "contractor", "realtor", "super_admin", "guest", "other"];
  const seasons = ["spring", "summer", "fall", "winter"] as const;
  const withCounty = [true, false] as const;
  const withCompletionSeed = [true, false] as const;

  const matrix = roles.flatMap((role) =>
    seasons.flatMap((seasonHint) =>
      withCounty.flatMap((countyPresent) =>
        withCompletionSeed.map((completionSeed) => ({
          role,
          seasonHint,
          countyPresent,
          completionSeed,
        }))
      )
    )
  );

  it.each(matrix)(
    "builds stable bundle for role=%s season=%s county=%s",
    ({ role, seasonHint, countyPresent, completionSeed }) => {
      const input: ObjectiveOnboardingInput = {
        userId: `matrix_${role}_${seasonHint}_${countyPresent ? "c" : "n"}`,
        role,
        seasonHint,
        countyFips: countyPresent ? "48201" : undefined,
        stateCode: countyPresent ? "TX" : undefined,
        objectiveStates: completionSeed
          ? [
              {
                objectiveId: "homeowner_local_network",
                status: "completed",
                completionPct: 100,
                updatedAt: "2026-03-08T18:00:00.000Z",
              },
            ]
          : [],
      };

      const suggestions = ScoutObjectiveOnboarding.suggestObjectives(input);
      const bundle = ScoutObjectiveOnboarding.buildBundle(input);
      const fastWins = ScoutObjectiveOnboarding.buildFastWinCards(
        bundle.role,
        suggestions,
        input.objectiveStates
      );

      expect(bundle.suggestions.length).toBeGreaterThan(0);
      expect(bundle.fastWins.length).toBeGreaterThan(0);
      expect(bundle.completionSummary.pendingCount).toBeGreaterThanOrEqual(0);
      expect(
        bundle.suggestions.every(
          (s) =>
            s.expectedValueScore >= 0 &&
            s.expectedValueScore <= 100 &&
            s.recommendedRoute.startsWith("/")
        )
      ).toBe(true);
      expect(fastWins.every((card) => card.valueScore >= 1 && card.valueScore <= 100)).toBe(true);
    }
  );
});
