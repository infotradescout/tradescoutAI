type ResponseQualityInput = {
  userMessage: string;
  content: string;
  hasActionOptions: boolean;
};

const FILLER_PATTERNS = [
  /\bi can help with that\b/gi,
  /\bhere'?s what tradescout can do for your community\b/gi,
  /\bi(?: am|'m) here and ready\b/gi,
  /\blet me know if you need anything else\b/gi,
];

const DEAD_END_PATTERNS = [
  /\bi can'?t help\b/i,
  /\bnot sure what to do\b/i,
  /\bno next step\b/i,
  /\btry again later\b/i,
];

const RECOVERY_COPY_PATTERNS = [
  /\bsystem error\b/i,
  /\bhaving trouble generating\b/i,
  /\bcouldn'?t generate\b/i,
  /\bheavy demand\b/i,
  /\brate limit\b/i,
  /\bplease try rephrasing\b/i,
];

const BLOCKED_COPY_PATTERNS = [
  /\bi don'?t have verified live tradescout results\b/i,
  /\bno verified live tradescout results\b/i,
  /\bi don'?t have verified live results\b/i,
  /\bi couldn'?t find reliable information about this in tradescout'?s local data or on the web\b/i,
  /\byou may need to confirm with a local professional or contact your admin for assistance\b/i,
  /\bi can(?:not|'t)\s+directly\s+search\s+the\s+internet\b/i,
  /\bcannot\s+directly\s+search\s+the\s+internet\b/i,
  /\bnext:\s*pick a button below\b/i,
  /\bwhich option should i run first\b/i,
  /\bwhat should i help you with next\b/i,
  /\bdo you want to start with\b/i,
];

function collapseWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

function stripFiller(input: string): string {
  let output = input;
  for (const pattern of FILLER_PATTERNS) {
    output = output.replace(pattern, "");
  }
  return collapseWhitespace(output);
}

function tuneScoutVoice(input: string): string {
  let output = input;

  const replacements: Array<[RegExp, string]> = [
    [/\bI can help you start this search\./gi, "Let's start with the basics."],
    [/\bI can still help you find the next local step\./gi, "Let's find the next local step."],
    [
      /\bTell me what kind of help you need, where you are, and how soon you need it\./gi,
      "Tell me what happened, where it is, and how soon you need it.",
    ],
    [/\bScout can help you\b/gi, "I can help"],
    [/\bScout can\b/gi, "I can"],
    [/\bTradeScout can still move this forward\b/gi, "We can keep this moving"],
    [/\broute the strongest next step\b/gi, "open the best next step"],
    [/\brouting\b/gi, "matching"],
    [/\brouted\b/gi, "matched"],
    [/\broute\b/gi, "open"],
    [/\bwithout bypassing trust gates\b/gi, "without skipping review"],
    [/\btrust gates\b/gi, "review steps"],
    [/\bsafest next step\b/gi, "best next step"],
    [/\bsafely do next\b/gi, "do next"],
    [/\bsafe next step\b/gi, "best next step"],
    [/\bverified live TradeScout results\b/gi, "local results"],
    [/\bPick one of these results\b/gi, "Choose what fits"],
  ];

  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }

  return collapseWhitespace(output);
}

function appearsDeadEnd(input: string): boolean {
  return DEAD_END_PATTERNS.some((pattern) => pattern.test(input));
}

function isRecoveryCopy(input: string): boolean {
  return RECOVERY_COPY_PATTERNS.some((pattern) => pattern.test(input));
}

function hasActionableLanguage(input: string): boolean {
  return /\b(next|choose|open|opening|start|use|tap|click|go to|continue|ready)\b/i.test(input);
}

function hasBlockedCopy(input: string): boolean {
  return BLOCKED_COPY_PATTERNS.some((pattern) => pattern.test(input));
}

function normalizeSemanticSentence(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDuplicateMeaning(a: string, b: string): boolean {
  return normalizeSemanticSentence(a) === normalizeSemanticSentence(b);
}

function collapseRepeatedSentenceFragments(input: string): string {
  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentences.length <= 1) return input;

  const deduped: string[] = [];

  for (const sentence of sentences) {
    if (deduped.some((existing) => isDuplicateMeaning(existing, sentence))) continue;
    deduped.push(sentence);
  }

  return deduped.join(" ");
}

function rewriteChoiceQuestions(input: string): string {
  let output = input;
  const replacements: Array<[RegExp, string]> = [
    [
      /\bdo you want to start with ([^?]+?) or ([^?]+?)\?/gi,
      "Here are the best next steps: $1, or $2.",
    ],
    [/\bdo you want ([^?]+?) or ([^?]+?)\?/gi, "Here are the best next steps: $1, or $2."],
    [/\bwhich option should i run first\?/gi, "Choose what fits."],
    [/\bwhat should i help you with next\?/gi, "Choose what fits."],
  ];

  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }

  return collapseWhitespace(output);
}

function summarizeWhenActionsCarryTheWork(input: string, hasActionOptions: boolean): string {
  if (!hasActionOptions) return input;

  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentences.length <= 2) return input;

  const summary = sentences.slice(0, 2).join(" ");
  return /[.!?]$/.test(summary) ? summary : `${summary}.`;
}

function appendFollowUpQuestion(input: string, hasActionOptions: boolean): string {
  const trimmed = collapseWhitespace(input);
  if (!trimmed)
    return hasActionOptions
      ? "Ready to open it?"
      : "I can still help you find the next local step.";
  if (trimmed.includes("?")) return trimmed;
  if (hasActionOptions) return trimmed;
  if (!hasActionOptions) return `${trimmed} Want me to find the next local step?`;
  return trimmed;
}

function forceConciseAnswer(userMessage: string, content: string): string {
  const lower = userMessage.trim().toLowerCase();
  const isShortPrompt = lower.length > 0 && lower.length <= 120;
  const startsWithShortWh = /^(what|why|who|where|when|how)\b/.test(lower);
  if (!isShortPrompt || !startsWithShortWh) return content;

  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length <= 3) return content;

  const concise = sentences.slice(0, 3).join(" ");
  return /[.!?]$/.test(concise) ? concise : `${concise}.`;
}

export function enforceResponseQualityContract(input: ResponseQualityInput): string {
  const { userMessage, content, hasActionOptions } = input;

  let output = collapseWhitespace(content || "");
  output = stripFiller(output);
  output = collapseRepeatedSentenceFragments(output);
  output = forceConciseAnswer(userMessage, output);
  output = rewriteChoiceQuestions(output);
  output = summarizeWhenActionsCarryTheWork(output, hasActionOptions);

  if (!output) {
    output = "I can still help you find the next local step.";
  }

  const shouldUseBlockedFallback = appearsDeadEnd(output) || hasBlockedCopy(output);
  output = tuneScoutVoice(output);
  output = rewriteChoiceQuestions(output);
  output = summarizeWhenActionsCarryTheWork(output, hasActionOptions);

  if (shouldUseBlockedFallback) {
    output =
      "Let's start with the basics. Tell me what happened, where it is, and how soon you need it.";
  }

  if (isRecoveryCopy(output)) {
    return collapseWhitespace(output);
  }

  if (hasActionOptions && !hasActionableLanguage(output)) {
    // Still append a follow-up question even when actionable language is missing
    output = appendFollowUpQuestion(output, hasActionOptions);
    return collapseWhitespace(output);
  }

  output = appendFollowUpQuestion(output, hasActionOptions);

  return collapseWhitespace(output);
}
