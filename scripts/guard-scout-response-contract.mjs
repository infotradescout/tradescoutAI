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
      "function rewriteChoiceQuestions",
      "function summarizeWhenActionsCarryTheWork",
      "output = appendFollowUpQuestion(output, hasActionOptions);",
    ],
  },
  {
    file: "client/src/scout/responseQuality.test.ts",
    mustInclude: [
      "turns two-way choice questions into option summary copy when actions exist",
      "keeps chat as a short summary when cards carry the result",
      "keeps existing follow-up questions without duplicating",
    ],
  },
  {
    file: "client/src/scout/scoutHumanFeel.test.ts",
    mustInclude: [
      'expect(lower.includes("which option should i run first")).toBe(false);',
      'expect(lower.includes("what should i help you with next")).toBe(false);',
      'expect(lower.includes("do you want to start with")).toBe(false);',
    ],
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
      "keeps statement responses when no question exists",
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
