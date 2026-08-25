import { describe, expect, it } from "vitest";
import { resolveProfileServiceAreaHub } from "@shared/profileServiceAreaShare";

function profileAreas(serviceAreas: unknown[]) {
  return [
    {
      type: "localServiceProfile",
      data: {
        serviceAreas,
        services: [
          {
            title: "Land clearing & site preparation",
            description:
              "Open up overgrown or undeveloped ground and prepare the property for its next use or construction phase.",
          },
        ],
      },
    },
  ];
}

describe("service-area location truth", () => {
  it("rejects policy sentences stored beside real locations", () => {
    const hub = resolveProfileServiceAreaHub(
      profileAreas([
        "Hammond",
        "Tangipahoa Parish",
        "Other project areas confirmed after property, jurisdiction, and supplier review",
      ])
    );

    expect(hub?.areas).toEqual(["Hammond", "Tangipahoa Parish"]);
  });

  it.each([
    "Serving all of southeast Louisiana",
    "Within 50 miles of Hammond",
    "Coverage confirmed after site review",
    "Other service areas",
    "Available after jurisdiction review",
  ])("rejects non-location coverage copy: %s", (value) => {
    expect(resolveProfileServiceAreaHub(profileAreas([value]))).toBeNull();
  });

  it.each([
    "St. Tammany Parish",
    "Hammond, Louisiana",
    "New Orleans Metro",
    "District of Columbia",
    "Nationwide",
  ])("keeps concise location labels: %s", (value) => {
    expect(resolveProfileServiceAreaHub(profileAreas([value]))?.areas).toEqual([value]);
  });

  it("rejects sentence-length and multi-location prose as one label", () => {
    expect(
      resolveProfileServiceAreaHub(
        profileAreas([
          "Hammond, Ponchatoula, and surrounding project locations depending on supplier coverage",
        ])
      )
    ).toBeNull();
  });
});
