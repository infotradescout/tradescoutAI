import fs from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Execute the actual registered handler with a controlled storage boundary.
// This proves request/update semantics; it does not stand in for PostgreSQL.
const source = ts.createSourceFile(
  "routes.ts",
  fs.readFileSync("server/routes.ts", "utf8"),
  ts.ScriptTarget.Latest,
  true
);
let handlerSource = "";
function visit(node: ts.Node) {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(source) === "app.put" &&
    ts.isStringLiteral(node.arguments[0]) &&
    node.arguments[0].text === "/api/user/profile"
  ) {
    handlerSource = node.arguments.at(-1)!.getText(source);
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (!handlerSource) throw new Error("Profile update handler not found");
const compiled = ts.transpileModule(`const handler = ${handlerSource};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

describe("profile basics update preserves location", () => {
  it("saves a name and phone without erasing omitted canonical location fields", async () => {
    const user: any = {
      id: "sender-1",
      firstName: "Old",
      phone: "2255550199",
      stateCode: "LA",
      countyFips: "22105",
      countyId: "county-22105",
      countyName: "Tangipahoa",
    };
    const updateUser = vi.fn(async (_id, changes) => {
      for (const [key, value] of Object.entries(changes))
        if (value !== undefined) user[key] = value;
      return user;
    });
    const handler = new Function(
      "storage",
      "sanitizeUserForResponse",
      "CURRENT_PROFILE_VERSION",
      `${compiled}; return handler;`
    )({ updateUser }, (value: any) => value, 1);
    const res = { json: vi.fn(), status: vi.fn() };
    await handler(
      {
        user: { id: "sender-1" },
        body: { firstName: "Jordan", lastName: "Example", phone: "2255550100" },
      },
      res
    );
    expect(updateUser).toHaveBeenCalledWith(
      "sender-1",
      expect.objectContaining({ firstName: "Jordan", phone: "2255550100" })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Jordan",
        phone: "2255550100",
        stateCode: "LA",
        countyFips: "22105",
        countyId: "county-22105",
        countyName: "Tangipahoa",
      })
    );
  });
});
