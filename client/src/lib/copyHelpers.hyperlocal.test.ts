import { describe, expect, it } from "vitest";
import { getUserLocationLabel } from "./copyHelpers";

describe("getUserLocationLabel hyperlocal priority", () => {
  it("prefers explicit home location label before county", () => {
    const user = {
      countyName: "Escambia County",
      stateCode: "FL",
      city: "Pensacola",
      state: "FL",
      preferences: {
        geo: {
          homeLocation: {
            label: "East Hill, Pensacola",
          },
        },
      },
    } as any;

    expect(getUserLocationLabel(user)).toBe("East Hill, Pensacola");
  });

  it("prefers city/state/zip before county fallback", () => {
    const user = {
      countyName: "Escambia County",
      stateCode: "FL",
      city: "Pensacola",
      state: "FL",
      zipCode: "32501",
    } as any;

    expect(getUserLocationLabel(user)).toBe("Pensacola, FL 32501");
  });
});
