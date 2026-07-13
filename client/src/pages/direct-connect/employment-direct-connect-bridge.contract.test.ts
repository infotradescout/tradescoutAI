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
});
