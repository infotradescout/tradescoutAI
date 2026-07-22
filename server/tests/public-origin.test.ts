import { describe, expect, it } from "vitest";
import { resolveMappedProfileShareOrigin, resolvePublicOrigin } from "../utils/publicOrigin";

function request(headers: Record<string, string>, protocol = "https") {
  return { headers, protocol } as any;
}

describe("resolvePublicOrigin", () => {
  it("does not let X-Forwarded-Host rewrite platform discovery URLs", () => {
    expect(
      resolvePublicOrigin(
        request({
          host: "www.thetradescout.com",
          "x-forwarded-host": "attacker.example",
        })
      )
    ).toBe("https://www.thetradescout.com");
  });

  it("fails unknown non-local hosts closed to the canonical platform origin", () => {
    expect(resolvePublicOrigin(request({ host: "attacker.example" }))).toBe(
      "https://www.thetradescout.com"
    );
  });

  it("preserves a local development origin without consulting forwarded host", () => {
    expect(
      resolvePublicOrigin(
        request({ host: "localhost:5000", "x-forwarded-host": "attacker.example" }, "http")
      )
    ).toBe("http://localhost:5000");
  });

  it("uses only the database-mapped profile host for custom-domain share destinations", () => {
    const mappedRequest = request({
      host: "jwstonelogistics.com",
      "x-forwarded-host": "attacker.example",
    });
    (mappedRequest as any).mappedProfileDomainHost = "jwstonelogistics.com";

    expect(resolveMappedProfileShareOrigin(mappedRequest)).toBe("https://jwstonelogistics.com");
    expect(
      resolveMappedProfileShareOrigin({
        ...mappedRequest,
        mappedProfileDomainHost: "attacker.example/path",
      } as any)
    ).toBeNull();
    expect(
      resolveMappedProfileShareOrigin(
        request({ host: "jwstonelogistics.com", "x-forwarded-host": "jwstonelogistics.com" })
      )
    ).toBeNull();
  });
});
