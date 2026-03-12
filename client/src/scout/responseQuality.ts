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

function collapseWhitespace(input: string): string {
  return input
    .replace(/\s+/g, " ")
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

function hasQuestion(input: string): boolean {
  return /\?/.test(input);
}

function appendFollowUpQuestion(input: string, hasActionOptions: boolean): string {
  if (hasQuestion(input)) return input;
  const followUp = hasActionOptions
    ? "Which option should I run first?"
    : "What should I help you with next?";
  return `${input} ${followUp}`;
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
  output = forceConciseAnswer(userMessage, output);

  if (!output) {
    output = "I found the best available path for this.";
  }

  if (appearsDeadEnd(output)) {
    output = "I found the best available path for this.";
  }

  if (isRecoveryCopy(output)) {
    return collapseWhitespace(output);
  }

  if (hasActionOptions && !hasActionableLanguage(output)) {
    // Keep this phrasing neutral and non-jargony. The UI already shows the buttons.
    output = `${output} Next: pick a button below.`;
  }

  output = appendFollowUpQuestion(output, hasActionOptions);

  return collapseWhitespace(output);
}
