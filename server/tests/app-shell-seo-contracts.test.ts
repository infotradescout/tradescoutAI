import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("app shell SEO contracts", () => {
  it("does not hard-code the homepage canonical in the client shell", () => {
    const source = read("client/index.html");
    const facebookVerificationToken = "3umc5qk60l8zgvcpmmokpa6ovp5dlk";
    const facebookVerificationFile = read("client/public/3umc5qk60l8zgvcpmmokpa6ovp5dlk.html");

    expect(source).not.toContain('<link rel="canonical" href="https://www.thetradescout.com/" />');
    expect(source).toContain('<meta name="robots" content="index, follow" />');
    expect(source).toContain(
      `<meta name="facebook-domain-verification" content="${facebookVerificationToken}" />`
    );
    expect(facebookVerificationFile).toBe(facebookVerificationToken);
  });
});
