export interface ScoutUserFacingSanitizerOptions {
  fallback?: string;
  maxChars?: number;
}

export interface ScoutUserFacingSanitizeResult {
  text: string;
  flags: string[];
  removedLines: number;
}

const DEFAULT_FALLBACK = "Let's keep this practical and local.";

const BLOCKED_RESPONSE_PATTERNS: RegExp[] = [
  /i couldn'?t find reliable information about this in tradescout'?s local data or on the web/i,
  /you may need to confirm with a local professional/i,
  /contact your admin for assistance/i,
  /i can(?:not|'t)\s+directly\s+search\s+the\s+internet/i,
  /cannot\s+directly\s+search\s+the\s+internet/i,
  /what should i help you with next\??/i,
  /which option should i run first\??/i,
  /\bscout\.com\b/i,
  /\b247sports\b/i,
  /\bathletic\s+recruiting\b/i,
  /\bformerly\s+known\s+as\s+scout\.com\b/i,
  /\bassuming\s+this\s+context\b/i,
];

const INTERNAL_LINE_RULES: Array<{ flag: string; pattern: RegExp }> = [
  { flag: "source_marker_removed", pattern: /^\s*source\s*:/i },
  { flag: "docs_reference_removed", pattern: /\[(docs?|source)\]/i },
  { flag: "docs_file_removed", pattern: /\b[\w/-]+\.md\b/i },
  { flag: "knowledge_header_removed", pattern: /^\s*knowledge\s+base\s*:/i },
  { flag: "knowledge_header_removed", pattern: /^\s*available\s+knowledge\s+base\s*:/i },
  { flag: "reasoning_label_removed", pattern: /^\s*reasoning\s*:/i },
  { flag: "reasoning_label_removed", pattern: /^\s*analysis\s*:/i },
  { flag: "reasoning_label_removed", pattern: /^\s*thought[_\s-]*flow\s*:/i },
  { flag: "reasoning_label_removed", pattern: /^\s*decision\s*:/i },
  { flag: "internal_logic_removed", pattern: /^\s*render\s+order\s*:/i },
  { flag: "internal_logic_removed", pattern: /^\s*state\s+injection\b/i },
  { flag: "internal_logic_removed", pattern: /^\s*current\s+state\s*\(/i },
  { flag: "internal_logic_removed", pattern: /\bbehavioral_center\.md\b/i },
  { flag: "internal_logic_removed", pattern: /\bbehavioral\s+center\b/i },
  { flag: "internal_logic_removed", pattern: /^\s*ui\s+emphasis\b/i },
  { flag: "internal_logic_removed", pattern: /^\s*admins?\s*$/i },
  { flag: "internal_logic_removed", pattern: /pick\s+a\s+button\s+below/i },
  { flag: "internal_logic_removed", pattern: /for\s*90%\+\s*of\s*users/i },
  { flag: "internal_logic_removed", pattern: /\bfake\s+homepage\b/i },
];

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripMarkdownSyntax(input: string): string {
  let next = input;

  // Keep code text but strip code-fence wrappers.
  next = next.replace(/```[a-zA-Z0-9_-]*\n?/g, "").replace(/```/g, "");

  // Headings, block quotes, and horizontal rules.
  next = next.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  next = next.replace(/^\s{0,3}>\s?/gm, "");
  next = next.replace(/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/gm, "");

  // Link forms.
  next = next.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  next = next.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");

  // Emphasis and inline code markers.
  next = next.replace(/\*\*([^*]+)\*\*/g, "$1");
  next = next.replace(/__([^_]+)__/g, "$1");
  next = next.replace(/\*([^*\n]+)\*/g, "$1");
  next = next.replace(/_([^_\n]+)_/g, "$1");
  next = next.replace(/`([^`\n]+)`/g, "$1");

  // Ordered list prefixes that look like render-order metadata.
  next = next.replace(/^\s*\d+\.\s+next\s*:/gim, "Next:");
  return next;
}

function trimToMaxChars(input: string, maxChars: number): string {
  if (maxChars <= 0 || input.length <= maxChars) return input;
  const sliced = input.slice(0, Math.max(0, maxChars - 3)).trimEnd();
  return `${sliced}...`;
}

function pushFlag(flags: string[], flag: string) {
  if (!flags.includes(flag)) flags.push(flag);
}

function isInternalSpecDump(input: string): boolean {
  const text = input.toLowerCase();
  const colonCount = (input.match(/:/g) || []).length;
  const numberedStageCount = (input.match(/\bphase\s+\d+\s*:/gi) || []).length;
  const suspiciousSignals = [
    /recommended by this analysis/i,
    /\btrigger examples\s*:/i,
    /\bimplementation trust signals\b/i,
    /\bauto-persist\b/i,
    /\bsafe path\b/i,
    /\bownership pressure\b/i,
    /\bincreases drop-?off\b/i,
  ];

  if (suspiciousSignals.some((pattern) => pattern.test(text))) return true;
  if (numberedStageCount >= 1 && text.length > 180) return true;
  if (colonCount >= 7 && text.length > 260) return true;
  return false;
}

export function sanitizeScoutUserFacingText(
  input: string,
  opts: ScoutUserFacingSanitizerOptions = {}
): ScoutUserFacingSanitizeResult {
  const fallback = opts.fallback === undefined ? DEFAULT_FALLBACK : String(opts.fallback).trim();
  const maxChars = typeof opts.maxChars === "number" ? Math.max(40, opts.maxChars) : 700;
  const raw = String(input || "");
  const flags: string[] = [];

  if (!raw.trim()) {
    return { text: fallback, flags: ["empty_replaced"], removedLines: 0 };
  }

  const markdownStripped = stripMarkdownSyntax(raw);
  if (markdownStripped !== raw) pushFlag(flags, "markdown_removed");
  if (isInternalSpecDump(markdownStripped)) {
    return {
      text: fallback,
      flags: [...flags, "internal_spec_dump_replaced"],
      removedLines: 0,
    };
  }

  const filteredLines: string[] = [];
  let removedLines = 0;

  for (const sourceLine of markdownStripped.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line) {
      if (filteredLines.length > 0 && filteredLines[filteredLines.length - 1] !== "") {
        filteredLines.push("");
      }
      continue;
    }

    let blocked = false;
    for (const rule of INTERNAL_LINE_RULES) {
      if (!rule.pattern.test(line)) continue;
      blocked = true;
      removedLines += 1;
      pushFlag(flags, rule.flag);
      break;
    }
    if (blocked) continue;

    let cleaned = line.replace(/^\s*[-*+]\s+/, "");
    cleaned = cleaned.replace(/\[(docs?|source)\]/gi, "").trim();
    if (!cleaned) {
      removedLines += 1;
      continue;
    }
    filteredLines.push(cleaned);
  }

  let text = filteredLines.join("\n");
  text = normalizeWhitespace(text);
  text = trimToMaxChars(text, maxChars);

  if (BLOCKED_RESPONSE_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      text: fallback,
      flags: [...flags, "blocked_phrase_replaced"],
      removedLines,
    };
  }

  if (!text) {
    return {
      text: fallback,
      flags: [...flags, "empty_replaced_after_scrub"],
      removedLines,
    };
  }

  return { text, flags, removedLines };
}
