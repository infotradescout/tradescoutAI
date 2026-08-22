import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/direct-connect/EmploymentBoard.tsx"),
  "utf8"
);

describe("employment to Direct Connect bridge", () => {
  it("preserves the selected opportunity in Direct Connect instead of generating a Scout prompt", () => {
    expect(source).toContain('params.set("intent", "employment")');
    expect(source).toContain('params.set("employmentPostId", post.id)');
    expect(source).toContain('params.set("title", post.title)');
    expect(source).toContain('params.set("description", post.body)');
    expect(source).toContain("navigate(`/direct-connect?${params.toString()}`)");
    expect(source).not.toContain("navigate(`/scout?${params.toString()}`)");
  });

  it("loads viewer application state once and renders the role-aware inspector actions", () => {
    expect(source).toContain('queryFn: () => apiRequest("GET", "/api/employment/my-applications")');
    expect(source).toContain('user?.id || "guest"');
    expect(source).toContain('queryKey: ["/api/identity-verification/status", user?.id]');
    expect(source).toContain("viewApplicantsPost?.isOwner");
    expect(source).not.toContain("Promise.all(");
    expect(source).not.toContain("posts.map((p) => p.id).join");
    expect(source).toContain('data-testid="jobs-inspector-apply"');
    expect(source).toContain('data-testid="jobs-inspector-application-status"');
    expect(source).toContain('data-testid="jobs-inspector-applicants"');
    expect(source).toContain('data-testid="jobs-inspector-close"');
    expect(source).toContain('data-testid="jobs-inspector-start-reply"');
    expect(source).toContain("resolveJobsInspectorLifecycle");
    expect(source).toContain("applicationLookupState={");
    expect(source).toContain("Your application status could not be confirmed");
    expect(source).toContain("if (!workspaceHydrated || !postsSuccess) return;");
    expect(source).toContain("Applicants could not load");
    expect(source).toContain('res.headers.get("X-Data-Disabled")');
  });

  it("keeps the reply gate and mobile verification action from colliding with its copy", () => {
    expect(source).toContain('data-testid="jobs-verification-notice"');
    expect(source).toContain("sm:flex-row sm:items-center sm:justify-between");
    expect(source).toContain("w-full shrink-0");
    expect(source).toContain("disabled={!viewerVerified}");
    expect(source).not.toContain('className="ml-2 h-7');
    expect(source).not.toContain("{app.applicantEmail");
  });
});
