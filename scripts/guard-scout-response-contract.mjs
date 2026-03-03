import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const checks = [
  {
    file: "client/src/scout/responseQuality.ts",
    mustInclude: [
      "function appendFollowUpQuestion",
      "output = appendFollowUpQuestion(output, hasActionOptions);",
    ],
  },
  {
    file: "client/src/scout/responseQuality.test.ts",
    mustInclude: [
      "appends a follow-up question when response has no question",
      "keeps existing follow-up questions without duplicating",
    ],
  },
  {
    file: "client/src/scout/scoutHumanFeel.test.ts",
    mustInclude: ["expect(turn.message.content.includes(\"?\")).toBe(true);"],
  },
  {
    file: "server/routes/scout.ts",
    mustInclude: [
      "import { ensureFollowUpQuestion } from \"../scout/responseShape\";",
      "return ensureFollowUpQuestion(result);",
    ],
  },
  {
    file: "server/scout/responseShape.ts",
    mustInclude: [
      "export function ensureFollowUpQuestion",
      "What should I help you with next?",
    ],
  },
  {
    file: "server/tests/scout-response-shape.test.ts",
    mustInclude: [
      "adds follow-up question when none exists",
      "preserves existing questions without duplication",
    ],
  },
  {
    file: "server/tests/scout-response-wiring.test.ts",
    mustInclude: ["routes trimResponseToScreenFit through ensureFollowUpQuestion"],
  },
];

const failures = [];

for (const check of checks) {
  const content = read(check.file);
  for (const needle of check.mustInclude) {
    if (!content.includes(needle)) {
      failures.push(`${check.file} is missing: ${needle}`);
    }
  }
}

if (failures.length > 0) {
  console.error("[guard:scout-response-contract] FAILED");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[guard:scout-response-contract] OK");
