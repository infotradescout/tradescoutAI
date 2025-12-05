import fs from "fs";
import path from "path";

let cachedPrompt: string | null = null;
let lastLoaded: number | null = null;

const PROMPT_PATH = path.join(
  __dirname,
  "..",
  "cache",
  "manual",
  "system_prompt.md"
);

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

  // Verify file exists
  if (!fs.existsSync(PROMPT_PATH)) {
    throw new Error(`system_prompt.md not found at ${PROMPT_PATH}`);
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
