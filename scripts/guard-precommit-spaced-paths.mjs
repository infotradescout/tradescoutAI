import { readFileSync } from "node:fs";
import { join } from "node:path";

const preCommitPath = join(process.cwd(), ".husky", "pre-commit");
const source = readFileSync(preCommitPath, "utf8");

const requiredSnippets = [
  "git diff --cached --name-only -z --diff-filter=ACMR",
  "xargs -0 npx eslint --fix --",
  "xargs -0 npx prettier --write --",
  "xargs -0 git add --",
];

const forbiddenSnippets = [
  "npx eslint --fix $ESLINT_FILES",
  "prettier --write $FORMAT_FILES",
  "git add $FORMAT_FILES",
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
const presentForbidden = forbiddenSnippets.filter((snippet) => source.includes(snippet));

if (missing.length > 0 || presentForbidden.length > 0) {
  console.error("[guard:precommit-spaced-paths] FAILED");
  for (const snippet of missing) {
    console.error(`- missing required snippet: ${snippet}`);
  }
  for (const snippet of presentForbidden) {
    console.error(`- found forbidden snippet: ${snippet}`);
  }
  process.exit(1);
}

console.log("[guard:precommit-spaced-paths] OK");
