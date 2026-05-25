import { describe, expect, it } from "vitest";
import { resolveCanonicalCountyForState } from "./countyNameNormalization";

describe("county name normalization", () => {
  it("normalizes Louisiana Spanish parish labels to canonical parish names", () => {
    const resolved = resolveCanonicalCountyForState("Parroquia de Tangipahoa", "LA");
    expect(resolved).toBeTruthy();
    expect(resolved?.countyName).toBe("Tangipahoa Parish");
    expect(resolved?.countyFips).toBe("22105");
  });

  it("normalizes Tangipahoa aliases in Louisiana", () => {
    const short = resolveCanonicalCountyForState("Tangipahoa", "LA");
    const countySuffix = resolveCanonicalCountyForState("Tangipahoa County", "LA");
    expect(short?.countyName).toBe("Tangipahoa Parish");
    expect(countySuffix?.countyName).toBe("Tangipahoa Parish");
  });
});
