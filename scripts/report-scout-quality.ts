import fs from "fs";
import path from "path";
import { resolveExplicitNavigationIntent } from "../client/src/scout/localIntents";
import {
  buildConnectionFallback,
  buildExplicitNavigationMessage,
} from "../client/src/scout/messageBuilders";
import { enforceResponseQualityContract } from "../client/src/scout/responseQuality";
import type { ScoutAction, ScoutMessage } from "../client/src/scout/state";

type QualityPrompt = {
  prompt: string;
  expectsRoute: string;
};

type SimulatedTurn = {
  message: ScoutMessage;
  actions: ScoutAction[];
  mode: "explicit_nav" | "fallback";
};

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "SCOUT_QUALITY_REPORT.md");

const prompts: QualityPrompt[] = [
  { prompt: "Open Direct Connect", expectsRoute: "/direct-connect" },
  { prompt: "Take me to community", expectsRoute: "/community" },
  { prompt: "Show me marketplace", expectsRoute: "/exchange" },
  { prompt: "I need a plumber near me", expectsRoute: "/direct-connect/pros" },
  { prompt: "Find a contractor for roof repair", expectsRoute: "/direct-connect/pros" },
  { prompt: "I want to buy tools", expectsRoute: "/exchange" },
  { prompt: "Help me post in community", expectsRoute: "/community" },
  { prompt: "Open notes", expectsRoute: "/notes" },
];

function simulateTurn(userPrompt: string): SimulatedTurn {
  const explicit = resolveExplicitNavigationIntent(userPrompt);
  if (explicit) {
    const message = buildExplicitNavigationMessage({ to: explicit.to, label: explicit.label });
    const primary = message.clusters?.[0]?.primaryAction;
    return {
      message,
      actions: primary ? [primary] : [],
      mode: "explicit_nav",
    };
  }

  const { message, actions } = buildConnectionFallback(
    {
      contractorsRoute: "/contractors",
      communityRoute: "/community",
      exchangeRoute: "/exchange",
    },
    userPrompt
  );

  return { message, actions, mode: "fallback" };
}

function evaluatePrompt(item: QualityPrompt) {
  const turn = simulateTurn(item.prompt);
  const qualityContent = enforceResponseQualityContract({
    userMessage: item.prompt,
    content: turn.message.content,
    hasActionOptions: turn.actions.length > 0,
  });

  const lower = qualityContent.toLowerCase();
  const hasExpectedRoute = turn.actions.some((a) => a.to === item.expectsRoute);
  const hasActionableLanguage = /\b(next|open|choose|continue|start|go to)\b/i.test(qualityContent);
  const noDeadEnd =
    !lower.includes("can't help") &&
    !lower.includes("not sure what to do") &&
    !lower.includes("no next step");
  const noFiller =
    !lower.includes("i can help with that") &&
    !lower.includes("here's what tradescout can do for your community");

  const checks = [
    { name: "route", pass: hasExpectedRoute },
    { name: "actionable", pass: hasActionableLanguage },
    { name: "no_dead_end", pass: noDeadEnd },
    { name: "no_filler", pass: noFiller },
  ];

  const score = checks.filter((c) => c.pass).length;

  return {
    prompt: item.prompt,
    mode: turn.mode,
    score,
    max: checks.length,
    checks,
    output: qualityContent,
    routes: turn.actions.map((a) => a.to).filter(Boolean),
  };
}

function run() {
  const rows = prompts.map(evaluatePrompt);
  const totalScore = rows.reduce((sum, row) => sum + row.score, 0);
  const totalMax = rows.reduce((sum, row) => sum + row.max, 0);
  const percent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  const lines: string[] = [];
  lines.push("# Scout Quality Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Quality score: ${totalScore}/${totalMax} (${percent}%)`);
  lines.push(`- Prompt count: ${rows.length}`);
  lines.push("- Contract: direct output, actionable step, no dead-end, no filler");
  lines.push("");
  lines.push("## Prompt Results");
  lines.push("| Prompt | Mode | Score | Expected Route Present | Output Preview |");
  lines.push("| --- | --- | --- | --- | --- |");

  for (const row of rows) {
    const expectedRoutePresent = row.checks.find((c) => c.name === "route")?.pass ? "yes" : "no";
    const preview = row.output.replace(/\|/g, "\\|").slice(0, 90);
    lines.push(
      `| ${row.prompt} | ${row.mode} | ${row.score}/${row.max} | ${expectedRoutePresent} | ${preview} |`
    );
  }

  lines.push("");
  lines.push("## Detailed Checks");
  lines.push("");
  for (const row of rows) {
    lines.push(`### ${row.prompt}`);
    lines.push(`- Mode: ${row.mode}`);
    lines.push(`- Routes: ${row.routes.length ? row.routes.join(", ") : "(none)"}`);
    lines.push(
      `- Checks: ${row.checks.map((c) => `${c.name}=${c.pass ? "pass" : "fail"}`).join(", ")}`
    );
    lines.push(`- Output: ${row.output}`);
    lines.push("");
  }

  fs.writeFileSync(OUTPUT, `${lines.join("\n")}\n`, "utf8");
  console.log(`[scout-quality] wrote ${path.relative(ROOT, OUTPUT)} | score=${percent}%`);
}

run();
