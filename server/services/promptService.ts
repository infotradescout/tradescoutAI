import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

let cachedPrompt: string | null = null;
let lastLoaded: number | null = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROMPT_PATH = path.join(
  __dirname,
  "..",
  "cache",
  "manual",
  "system_prompt.md"
);

// Minimal fallback prompt to keep Scout responding even if the file is missing in production
const DEFAULT_PROMPT = `You are Scout, the TradeScout operating system.
- Always prioritize verified TradeScout data; never invent contractors or prices.
- If data comes from the open web, say so explicitly.
- If no reliable data exists, say you don't have it and avoid guesses.
- Keep answers concise, actionable, and friendly.`;

const RELOAD_INTERVAL_MS = 30_000; // 30s hot reload window

/**
 * Load system prompt with caching and hot reload
 * @param force - If true, bypass cache and reload from disk
 * @returns System prompt content
 */
export function loadSystemPrompt(force = false): { content: string, version: string } {
  const now = Date.now();

  // Return cached prompt if still within reload interval
  if (!force && cachedPrompt && lastLoaded && now - lastLoaded < RELOAD_INTERVAL_MS) {
    return { content: cachedPrompt, version: getPromptVersion() };
  }

  // Verify file exists; if missing, fall back to safe default prompt
  if (!fs.existsSync(PROMPT_PATH)) {
    console.warn(`[PromptService] system_prompt.md missing at ${PROMPT_PATH}; using built-in default prompt`);
    cachedPrompt = DEFAULT_PROMPT;
    lastLoaded = now;
    return { content: DEFAULT_PROMPT, version: "default" };
  }

  // Read from disk
  const content = fs.readFileSync(PROMPT_PATH, "utf8");
  cachedPrompt = content;
  lastLoaded = now;

  console.log(`[PromptService] System prompt loaded (${content.length} bytes)`);
  return { content, version: getPromptVersion() };
}

function getPromptVersion(): string {
  try {
    const stats = fs.statSync(PROMPT_PATH);
    return stats.mtime.toISOString();
  } catch {
    return "unknown";
  }
}

/**
 * Force reload system prompt from disk
 * @returns System prompt content
 */
export function reloadSystemPrompt(): { content: string, version: string } {
  console.log("[PromptService] Force reloading system prompt...");
  return loadSystemPrompt(true);
}

/**
 * Get prompt loading status
 */
export function getPromptStatus() {
  return {
    cached: !!cachedPrompt,
    lastLoaded: lastLoaded ? new Date(lastLoaded).toISOString() : null,
    reloadIntervalMs: RELOAD_INTERVAL_MS,
    promptPath: PROMPT_PATH,
    exists: fs.existsSync(PROMPT_PATH),
  };
}
