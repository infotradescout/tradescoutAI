import fs from "fs";
import path from "path";
import { runtimePaths } from "../runtimePaths";

let cachedPrompt: string | null = null;
let lastLoaded: number | null = null;
let cachedEnhancedPrompt: string | null = null;
let lastLoadedEnhanced: number | null = null;

const PROMPT_PATH = path.join(runtimePaths.scoutManualCache, "system_prompt.md");

const ENHANCED_PROMPT_PATH = path.join(
  runtimePaths.scoutManualCache,
  "system_prompt_enhanced.md"
);

// Minimal fallback prompt to keep Scout responding even if the file is missing in production
const DEFAULT_PROMPT = `You are Scout, the TradeScout operating system.
- Always prioritize verified TradeScout data; never invent contractors or prices.
- If data comes from the open web, say so explicitly.
- If no reliable data exists, say you don't have it and avoid guesses.
- Keep answers concise, actionable, and friendly.`;

const DEFAULT_ENHANCED_PROMPT = `You are Scout, the intelligent operating system for the TradeScout ecosystem.
You are designed to operate with increasing autonomy, leveraging structured reasoning, dynamic tool invocation, and continuous learning.

You MUST respond with this JSON shape:
- intent: classified user intent
- state_acknowledgment: current system state
- tool_calls: any tools to invoke
- message: response to the user
- suggestedActions: next steps for the user`;

const RELOAD_INTERVAL_MS = 30_000; // 30s hot reload window

/**
 * Load system prompt with caching and hot reload
 * @param force - If true, bypass cache and reload from disk
 * @param enhanced - If true, load the enhanced prompt; otherwise load the standard prompt
 * @returns System prompt content
 */
export function loadSystemPrompt(
  force = false,
  enhanced = false
): { content: string; version: string } {
  const now = Date.now();

  if (enhanced) {
    // Return cached enhanced prompt if still within reload interval
    if (
      !force &&
      cachedEnhancedPrompt &&
      lastLoadedEnhanced &&
      now - lastLoadedEnhanced < RELOAD_INTERVAL_MS
    ) {
      return { content: cachedEnhancedPrompt, version: getEnhancedPromptVersion() };
    }

    // Verify file exists; if missing, fall back to safe default enhanced prompt
    if (!fs.existsSync(ENHANCED_PROMPT_PATH)) {
      console.warn(
        `[PromptService] system_prompt_enhanced.md missing at ${ENHANCED_PROMPT_PATH}; using built-in default enhanced prompt`
      );
      cachedEnhancedPrompt = DEFAULT_ENHANCED_PROMPT;
      lastLoadedEnhanced = now;
      return { content: DEFAULT_ENHANCED_PROMPT, version: "default-enhanced" };
    }

    // Read from disk
    const content = fs.readFileSync(ENHANCED_PROMPT_PATH, "utf8");
    cachedEnhancedPrompt = content;
    lastLoadedEnhanced = now;

    console.log(`[PromptService] Enhanced system prompt loaded (${content.length} bytes)`);
    return { content, version: getEnhancedPromptVersion() };
  } else {
    // Return cached prompt if still within reload interval
    if (!force && cachedPrompt && lastLoaded && now - lastLoaded < RELOAD_INTERVAL_MS) {
      return { content: cachedPrompt, version: getPromptVersion() };
    }

    // Verify file exists; if missing, fall back to safe default prompt
    if (!fs.existsSync(PROMPT_PATH)) {
      console.warn(
        `[PromptService] system_prompt.md missing at ${PROMPT_PATH}; using built-in default prompt`
      );
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
}

function getPromptVersion(): string {
  try {
    const stats = fs.statSync(PROMPT_PATH);
    return stats.mtime.toISOString();
  } catch {
    return "unknown";
  }
}

function getEnhancedPromptVersion(): string {
  try {
    const stats = fs.statSync(ENHANCED_PROMPT_PATH);
    return stats.mtime.toISOString();
  } catch {
    return "unknown";
  }
}

/**
 * Force reload system prompt from disk
 * @param enhanced - If true, reload the enhanced prompt; otherwise reload the standard prompt
 * @returns System prompt content
 */
export function reloadSystemPrompt(enhanced = false): { content: string; version: string } {
  console.log(`[PromptService] Force reloading ${enhanced ? "enhanced " : ""}system prompt...`);
  return loadSystemPrompt(true, enhanced);
}

/**
 * Get prompt loading status
 */
export function getPromptStatus() {
  return {
    standard: {
      cached: !!cachedPrompt,
      lastLoaded: lastLoaded ? new Date(lastLoaded).toISOString() : null,
      promptPath: PROMPT_PATH,
      exists: fs.existsSync(PROMPT_PATH),
    },
    enhanced: {
      cached: !!cachedEnhancedPrompt,
      lastLoaded: lastLoadedEnhanced ? new Date(lastLoadedEnhanced).toISOString() : null,
      promptPath: ENHANCED_PROMPT_PATH,
      exists: fs.existsSync(ENHANCED_PROMPT_PATH),
    },
    reloadIntervalMs: RELOAD_INTERVAL_MS,
  };
}
