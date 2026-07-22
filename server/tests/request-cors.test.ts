import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSameRequestHttpOrigin,
  normalizeHttpOrigin,
  resolveRequestHttpOrigin,
} from "../utils/requestCors";

function request(headers: Record<string, string>, protocol = "http") {
  return { headers, protocol } as any;
}

describe("request-scoped CORS origin", () => {
  it("allows only the exact current HTTP origin", () => {
    const req = request({
      host: "Profile.Example:8443",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https",
    });

    expect(resolveRequestHttpOrigin(req)).toBe("https://profile.example:8443");
    expect(isSameRequestHttpOrigin(req, "https://profile.example:8443")).toBe(true);
    expect(isSameRequestHttpOrigin(req, "https://profile.example")).toBe(false);
    expect(isSameRequestHttpOrigin(req, "http://profile.example:8443")).toBe(false);
    expect(isSameRequestHttpOrigin(req, "https://other.example:8443")).toBe(false);
  });

  it("normalizes default ports but rejects non-origin URLs and non-HTTP schemes", () => {
    const req = request({ host: "profile.example:443" }, "https");

    expect(isSameRequestHttpOrigin(req, "https://profile.example")).toBe(true);
    expect(normalizeHttpOrigin("https://profile.example/path")).toBeNull();
    expect(normalizeHttpOrigin("https://profile.example/?token=private")).toBeNull();
    expect(normalizeHttpOrigin("javascript:alert(1)")).toBeNull();
  });

  it("ignores forwarded-host, uses the first proxy protocol, and rejects malformed authority", () => {
    const req = request({
      host: "profile.example",
      "x-forwarded-host": "attacker.example, proxy.internal",
      "x-forwarded-proto": "https, http",
    });
    expect(resolveRequestHttpOrigin(req)).toBe("https://profile.example");
    expect(resolveRequestHttpOrigin(request({ host: "profile.example/path" }, "https"))).toBeNull();
  });

  it("requires the routing middleware's mapped-profile marker for dynamic same-origin CORS", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf-8");
    const corsStart = source.indexOf("function corsOptionsForRequest(");
    const corsEnd = source.indexOf("// Always vary by Origin", corsStart);
    const corsSource = source.slice(corsStart, corsEnd);
    const cachedBusinessStart = source.indexOf('if (cached.kind === "business")');
    const cachedBusinessEnd = source.indexOf(
      "const targetHost = CANONICAL_WEB_HOST",
      cachedBusinessStart
    );
    const cachedBusinessSource = source.slice(cachedBusinessStart, cachedBusinessEnd);
    const businessStart = source.indexOf("if (businessSlug) {");
    const businessEnd = source.indexOf("const [account]", businessStart);
    const businessSource = source.slice(businessStart, businessEnd);

    expect(source).toContain("markMappedProfileDomainRequest(req, host)");
    expect(corsSource).toContain("isMappedProfileDomainSameOrigin(req, origin)");
    expect(corsSource).not.toContain("if (isSameRequestHttpOrigin(req, origin))");
    expect(cachedBusinessSource).not.toContain("markMappedProfileDomainRequest");
    expect(businessSource).not.toContain("markMappedProfileDomainRequest");
    expect(source).not.toContain('"https://jwstonelogistics.com"');
    expect(source).not.toContain('"https://www.jwstonelogistics.com"');
  });
});
