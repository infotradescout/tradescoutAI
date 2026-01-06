import fs from "fs/promises";
import path from "path";
import { ensureDir, nowIso } from "./agent-utils.js";

export async function createLogger(label, filePath) {
  await ensureDir(path.dirname(filePath));

  const write = async (entry) => {
    const line = JSON.stringify({ ts: nowIso(), label, ...entry });
    await fs.appendFile(filePath, line + "\n", "utf-8");
  };

  return {
    info: async (msg, meta = {}) => {
      console.log(`[${label}]`, msg, meta);
      await write({ level: "info", msg, ...meta });
    },
    warn: async (msg, meta = {}) => {
      console.warn(`[${label}]`, msg, meta);
      await write({ level: "warn", msg, ...meta });
    },
    error: async (msg, meta = {}) => {
      console.error(`[${label}]`, msg, meta);
      await write({ level: "error", msg, ...meta });
    },
  };
}
