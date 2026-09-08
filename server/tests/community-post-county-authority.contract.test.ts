import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function communityPostCreateHandler(): string {
  const routes = read("server/routes.ts");
  const start = routes.search(/app\.post\(\r?\n\s*"\/api\/community\/posts"/);
  const end = routes.indexOf('app.get("/api/community/posts/:id"', start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
}

function communityPostCreateIdentityBoundary(): string {
  const routes = read("server/routes.ts");
  const start = routes.indexOf("const requireCommunityPrincipalIdentity =");
  const end = routes.search(/app\.post\(\r?\n\s*"\/api\/community\/posts"/);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
}

describe("Community post county authority contract", () => {
  it("ignores request geography and fails closed before any Community write", () => {
    const routes = read("server/routes.ts");
    const handler = communityPostCreateHandler();
    const identityBoundary = communityPostCreateIdentityBoundary();

    expect(routes).toContain('import { resolveUserCountyWriteContext } from "./locationContext";');
    expect(routes).toMatch(
      /import\s*\{[^}]*\bresolveRequestEffectiveUser\b[^}]*\}\s*from "\.\/utils\/requestEffectiveUser"/
    );
    expect(identityBoundary).toContain("const identityContext = resolveRequestEffectiveUser(req);");
    expect(identityBoundary).toContain('code: "COMMUNITY_IDENTITY_CONTEXT_INVALID"');
    expect(identityBoundary).toContain("if (identityContext.isImpersonating)");
    expect(identityBoundary).toContain('code: "COMMUNITY_IMPERSONATION_WRITE_UNAVAILABLE"');
    expect(identityBoundary).toContain("req.communityCreateIdentity = identityContext;");
    expect(handler).toMatch(
      /isAuthenticated,\s*requireCommunityPrincipalIdentity,\s*requireOnboardingComplete,/
    );
    expect(handler).toContain("const identityContext = req.communityCreateIdentity;");
    expect(handler).toContain("const userId = identityContext.effectiveUserId;");
    expect(handler).toContain("const { title, content, category, images } = req.body;");
    expect(handler).not.toMatch(
      /const\s*\{[^}]*\b(?:scope|stateCode|countyFips)\b[^}]*\}\s*=\s*req\.body/
    );
    expect(handler).not.toMatch(/req\.body\.(?:scope|stateCode|countyFips)/);
    expect(handler).toContain("const countyContext = await resolveUserCountyWriteContext(user");
    expect(handler).toContain("storage.getCountyByFips(countyFips)");
    expect(handler).toContain('code: "COMMUNITY_COUNTY_CONTEXT_REQUIRED"');

    const identityResolutionIndex = identityBoundary.indexOf("const identityContext =");
    const identityRejectionIndex = identityBoundary.indexOf(
      'code: "COMMUNITY_IDENTITY_CONTEXT_INVALID"'
    );
    const impersonationRejectionIndex = identityBoundary.indexOf(
      'code: "COMMUNITY_IMPERSONATION_WRITE_UNAVAILABLE"'
    );
    const identityHandoffIndex = identityBoundary.indexOf(
      "req.communityCreateIdentity = identityContext;"
    );
    const userLookupIndex = handler.indexOf("await storage.getUser(userId)");
    const resolutionIndex = handler.indexOf("const countyContext =");
    const rejectionIndex = handler.indexOf('code: "COMMUNITY_COUNTY_CONTEXT_REQUIRED"');
    const postWriteIndex = handler.indexOf("await storage.createCommunityPost(");
    const reflectionIndex = handler.indexOf("await reflectCommunityAction(");
    const countyNoteIndex = handler.indexOf("await storage.createCountyNote(");

    expect(identityResolutionIndex).toBeGreaterThanOrEqual(0);
    expect(identityRejectionIndex).toBeGreaterThan(identityResolutionIndex);
    expect(impersonationRejectionIndex).toBeGreaterThan(identityRejectionIndex);
    expect(identityHandoffIndex).toBeGreaterThan(impersonationRejectionIndex);
    expect(userLookupIndex).toBeGreaterThanOrEqual(0);
    expect(resolutionIndex).toBeGreaterThanOrEqual(0);
    expect(rejectionIndex).toBeGreaterThan(resolutionIndex);
    expect(postWriteIndex).toBeGreaterThan(rejectionIndex);
    expect(reflectionIndex).toBeGreaterThan(postWriteIndex);
    expect(countyNoteIndex).toBeGreaterThan(reflectionIndex);
  });

  it("binds the post, reflection, and county note to one resolved county context", () => {
    const handler = communityPostCreateHandler();

    expect(handler).toMatch(
      /scope:\s*resolvedScope,\s*stateCode:\s*resolvedStateCode,\s*countyFips:\s*resolvedCountyFips,\s*imageUrls/
    );
    expect(handler).toMatch(
      /extra:\s*\{\s*category:\s*category \|\| null,\s*scope:\s*resolvedScope,\s*stateCode:\s*resolvedStateCode,\s*countyFips:\s*resolvedCountyFips,\s*\}/
    );
    expect(handler).toMatch(
      /await storage\.createCountyNote\(\{\s*countyFips:\s*resolvedCountyFips,/
    );
    expect(handler).toContain("authorId: userId,");
    expect(handler).toContain("actorUserId: String(userId)");
    expect(handler).toContain("authorUserId: String(userId)");
    expect(handler).toContain("deriveCommunityTagsFromContent(title, content, category)");
    expect(handler).toContain("imageUrls,");
    expect(handler).toContain('notifyIndexNow([`/community/posts/${newPost.id}`, "/community"])');
    expect(handler).toContain("res.status(201).json(newPost)");
  });
});
