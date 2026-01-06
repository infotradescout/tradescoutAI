import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadConfig() {
  const env = process.env;
  const agentsEnabled = env.AGENTS_ENABLED === "true";

  return {
    agentsEnabled,
    writeScope: env.AGENT_WRITE_SCOPE || "branches_only",
    dbScope: env.AGENT_DB_SCOPE || "seed_only",
    intentBudget: Number(env.AGENT_INTENT_BUDGET || 10),
    maxParallel: Number(env.AGENT_MAX_PARALLEL || 1),
    heartbeatSec: Number(env.AGENT_HEARTBEAT_SEC || 30),
    schedulerEnabled: env.SCHEDULER_ENABLED === "true",
    crawlerDisabled: env.DISABLE_CRAWLER === "true",
    baseDir: __dirname,
    memoryDir: path.join(__dirname, "memory"),
    logsDir: path.join(__dirname, "logs"),
    tasks: {
      builder: ["Refactor EmptyState usage in admin views"],
      fixer: ["Run npm run build and fix first failure"],
      verifier: ["Test protected routes + 404 behavior"],
      synthesizer: ["Seed 5 counties with 10 users each"],
    },
  };
}
