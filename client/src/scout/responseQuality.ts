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
  /\bi couldn'?t find reliable information about this in tradescout'?s local data or on the web\b/i,
  /\byou may need to confirm with a local professional or contact your admin for assistance\b/i,
  /\bi can(?:not|'t)\s+directly\s+search\s+the\s+internet\b/i,
  /\bcannot\s+directly\s+search\s+the\s+internet\b/i,
  /\bnext:\s*pick a button below\b/i,
  /\bwhich option should i run first\b/i,
  /\bwhat should i help you with next\b/i,
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

function appearsDeadEnd(input: string): boolean {
  return DEAD_END_PATTERNS.some((pattern) => pattern.test(input));
}

function isRecoveryCopy(input: string): boolean {
  return RECOVERY_COPY_PATTERNS.some((pattern) => pattern.test(input));
}

function hasActionableLanguage(input: string): boolean {
  return /\b(next|choose|open|start|use|tap|click|go to|continue)\b/i.test(input);
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

function appendFollowUpQuestion(input: string, hasActionOptions: boolean): string {
  const trimmed = collapseWhitespace(input);
  if (!trimmed)
    return hasActionOptions
      ? "Start a request below."
      : "I can still move this forward with a direct next step.";
  if (trimmed.includes("?")) return trimmed;
  return hasActionOptions ? trimmed : `${trimmed} I can still move this forward.`;
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

  if (!output) {
    output = "I can still move this forward with a direct next step.";
  }

  if (appearsDeadEnd(output) || hasBlockedCopy(output)) {
    output = "I can still move this forward with a direct next step.";
  }

  if (isRecoveryCopy(output)) {
    return collapseWhitespace(output);
  }

  if (hasActionOptions && !hasActionableLanguage(output)) {
    return collapseWhitespace(output);
  }

  output = appendFollowUpQuestion(output, hasActionOptions);

  return collapseWhitespace(output);
}
