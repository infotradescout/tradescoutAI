/* global console, process, setTimeout, clearTimeout */
import { fileURLToPath } from "url";
import path from "path";
import { loadConfig } from "./agent-config.js";
import { createLogger } from "./agent-logger.js";
import { readJson, writeJson, ensureDir, jitteredDelay, nowIso, sleep } from "./agent-utils.js";
import { createBuilderAgent } from "./agents/builder.agent.js";
import { createFixerAgent } from "./agents/fixer.agent.js";
import { createVerifierAgent } from "./agents/verifier.agent.js";
import { createSynthesizerAgent } from "./agents/synthesizer.agent.js";
import { classifyAgentCompletion } from "./completion-state.js";
import { auditGitArtifact } from "./git-artifact-audit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const intentsFile = path.join(__dirname, "memory", "intents.json");
const outcomesFile = path.join(__dirname, "memory", "outcomes.json");

const agentFactories = {
  builder: createBuilderAgent,
  fixer: createFixerAgent,
  verifier: createVerifierAgent,
  synthesizer: createSynthesizerAgent,
};

async function main() {
  const backlogFile = path.join(__dirname, "backlog.json");
  const config = loadConfig();

  if (!config.agentsEnabled) {
    console.log("[supervisor] AGENTS_ENABLED is not true. Exiting.");
    process.exit(0);
  }

  await ensureDir(config.logsDir);
  await ensureDir(config.memoryDir);

  const supervisorLogger = await createLogger(
    "supervisor",
    path.join(config.logsDir, "supervisor.log")
  );

  const agents = Object.entries(agentFactories)
    .filter(([id]) => config.agentRole === "all" || id === config.agentRole)
    .map(([id, factory]) => ({ id, instance: factory() }));

  const intentHistory = await readJson(intentsFile, []);
  const outcomes = await readJson(outcomesFile, []);

  const backlogRaw = await readJson(backlogFile, []);
  const backlogArray = Array.isArray(backlogRaw)
    ? backlogRaw
    : Array.isArray(backlogRaw.tasks)
      ? backlogRaw.tasks
      : [];

  const backlogByOwner = backlogArray.reduce((acc, item) => {
    const owner = item.owner || item.agent || "";
    if (!owner) return acc;
    acc[owner] = acc[owner] || [];
    acc[owner].push(item);
    return acc;
  }, {});

  const intentLog = new Map();
  agents.forEach(({ id }) => intentLog.set(id, []));

  const state = new Map();
  const timers = [];
  let shuttingDown = false;

  function recordIntent(agentId) {
    const now = Date.now();
    const entries = intentLog.get(agentId) || [];
    const windowStart = now - 60 * 60 * 1000;
    const recent = entries.filter((t) => t >= windowStart);
    recent.push(now);
    intentLog.set(agentId, recent);
    return recent.length;
  }

  function budgetExceeded(agentId) {
    const entries = intentLog.get(agentId) || [];
    const windowStart = Date.now() - 60 * 60 * 1000;
    const recent = entries.filter((t) => t >= windowStart);
    intentLog.set(agentId, recent);
    return recent.length >= config.intentBudget;
  }

  async function persistMemory() {
    await writeJson(intentsFile, intentHistory);
    await writeJson(outcomesFile, outcomes);
  }

  async function shutdown(reason) {
    if (shuttingDown) return;
    shuttingDown = true;
    await supervisorLogger.error("Shutting down", { reason });
    timers.forEach((t) => clearTimeout(t));
    process.exit(1);
  }

  async function runAgent(agent, queue) {
    if (shuttingDown) return;

    const budgetHit = budgetExceeded(agent.id);
    if (budgetHit) {
      await supervisorLogger.warn("Intent budget reached", { agent: agent.id });
      const delay = jitteredDelay(30000, 30000);
      timers.push(setTimeout(() => runAgent(agent, queue), delay));
      return;
    }

    const task = queue.shift();
    if (!task) {
      await supervisorLogger.info("Agent idle", { agent: agent.id });
      const delay = jitteredDelay();
      timers.push(setTimeout(() => runAgent(agent, queue), delay));
      return;
    }

    const started = Date.now();
    try {
      const actionNumber = recordIntent(agent.id);
      const logger = await createLogger(agent.id, path.join(config.logsDir, `${agent.id}.log`));
      await logger.info("Starting task", { task, actionNumber });

      // Enforce max task duration via timeout
      const timeoutMs = config.taskTimeoutMs > 0 ? config.taskTimeoutMs : config.heartbeatSec * 2000;
      const result = await Promise.race([
        agent.instance.execute(task, logger),
        (async () => {
          await sleep(timeoutMs);
          throw new Error(`Task timeout after ${timeoutMs}ms`);
        })(),
      ]);
      if (!result || !result.artifact) {
        await logger.error("Missing artifact", { task });
        await shutdown("Missing artifact from agent action");
        return;
      }

      // Detect scope override attempts from agents and reject
      if (result.overrideScope) {
        const { write, db } = result.overrideScope;
        const writeViolation = Boolean(write && write !== config.writeScope);
        const dbViolation = Boolean(db && db !== config.dbScope);
        if (writeViolation || dbViolation) {
          await logger.error("Scope violation detected", {
            override: result.overrideScope,
            allowed: { write: config.writeScope, db: config.dbScope },
          });
          await shutdown("Scope violation attempt by agent");
          return;
        }
      }

      if (!result.artifact.type || !result.artifact.uri) {
        await logger.error("Invalid artifact", { result });
        await shutdown("Invalid artifact payload");
        return;
      }

      const reportedArtifact = {
        type: result.artifact.type,
        uri: result.artifact.uri,
        commit: result.artifact.commit || undefined,
        files_changed:
          typeof result.artifact.files_changed === "number"
            ? result.artifact.files_changed
            : undefined,
      };
      const artifactAudit =
        reportedArtifact.type === "git-branch"
          ? auditGitArtifact({
              repoRoot: path.resolve(config.baseDir, ".."),
              artifact: reportedArtifact,
              task,
            })
          : {
              status: "not_applicable",
              reason: "not_git_branch",
              flags: [],
            };
      const classification = classifyAgentCompletion(result, artifactAudit);
      const auditFlags = Array.isArray(artifactAudit.flags)
        ? artifactAudit.flags
        : [];
      const verifiedArtifact =
        artifactAudit.status === "verified"
          ? {
              commit: artifactAudit.commit,
              files_changed: artifactAudit.filesChanged,
            }
          : {};

      const entry = {
        agent_id: agent.id,
        intent: result.intent || task,
        scope: {
          write: config.writeScope,
          db: config.dbScope,
        },
        artifact: {
          type: reportedArtifact.type,
          uri: reportedArtifact.uri,
          ...verifiedArtifact,
        },
        artifact_audit: artifactAudit,
        result: classification,
        started_at: new Date(started).toISOString(),
        ended_at: nowIso(),
        duration_ms: Date.now() - started,
        error:
          classification === "failed"
            ? result.error || artifactAudit.error || artifactAudit.reason
            : null,
        flags: [
          ...(Array.isArray(result.flags) ? result.flags : []),
          ...auditFlags,
        ],
      };

      if (
        reportedArtifact.type === "git-branch" &&
        artifactAudit.status !== "verified"
      ) {
        await logger.warn("Repository artifact rejected", {
          status: artifactAudit.status,
          reason: artifactAudit.reason,
          reported: reportedArtifact,
          audit: artifactAudit,
        });
      }

      if (agent.id === "builder") {
        const meta = state.get(agent.id) || {};
        if (entry.result === "success") {
          state.set(agent.id, { ...meta, noopGuardrailCount: 0 });
        } else {
          const consecutiveNoops =
            (typeof meta.noopGuardrailCount === "number"
              ? meta.noopGuardrailCount
              : 0) + 1;
          state.set(agent.id, {
            ...meta,
            noopGuardrailCount: consecutiveNoops,
          });

          const stamps = intentLog.get(agent.id) || [];
          if (stamps.length > 0) {
            stamps.pop();
            intentLog.set(agent.id, stamps);
          }

          if (consecutiveNoops >= 3) {
            await supervisorLogger.error("BUILDER_HALTED_GUARDRAIL_LOOP", {
              agent: agent.id,
              consecutiveNoops,
              classification: entry.result,
              audit: artifactAudit,
            });
            await shutdown("Builder completion-proof loop");
            return;
          }
        }
      }

      outcomes.push(entry);
      intentHistory.push({ agent_id: agent.id, intent: entry.intent, at: entry.started_at });
      await persistMemory();

      const prevMeta = state.get(agent.id) || {};
      state.set(agent.id, {
        ...prevMeta,
        lastArtifactAt: Date.now(),
        crashes: 0,
        noopGuardrailCount:
          typeof prevMeta.noopGuardrailCount === "number"
            ? prevMeta.noopGuardrailCount
            : 0,
      });

      await logger.info("Task result recorded", { entry });
    } catch (error) {
      const current = state.get(agent.id) || { crashes: 0 };
      const crashes = current.crashes + 1;
      state.set(agent.id, { ...current, crashes });
      await supervisorLogger.error("Agent error", { agent: agent.id, error: error.message });
      if (crashes >= 2) {
        await shutdown("Agent crashed twice");
        return;
      }
    }

    const delay = jitteredDelay();
    timers.push(setTimeout(() => runAgent(agent, queue), delay));
  }

  function startHeartbeat() {
    const delayMs = config.heartbeatSec * 1000;
    const heartbeat = async () => {
      if (shuttingDown) return;
      const snapshot = agents.map(({ id }) => {
        const meta = state.get(id) || {};
        return {
          agent: id,
          lastArtifactAt: meta.lastArtifactAt || null,
          crashes: meta.crashes || 0,
          budgetUsed: (intentLog.get(id) || []).length,
        };
      });
      await supervisorLogger.info("Heartbeat", { snapshot });
      timers.push(setTimeout(heartbeat, delayMs));
    };

    timers.push(setTimeout(heartbeat, delayMs));
  }

  await supervisorLogger.info("Supervisor starting", {
    writeScope: config.writeScope,
    dbScope: config.dbScope,
    intentBudget: config.intentBudget,
    schedulerEnabled: config.schedulerEnabled,
    crawlerDisabled: config.crawlerDisabled,
    verifierChaosMode: config.verifierChaosMode,
    verifierChaosProb: config.verifierChaosProb,
    taskTimeoutMs: config.taskTimeoutMs || config.heartbeatSec * 2000,
  });

  startHeartbeat();

  for (const agent of agents) {
     const seeded = [...(config.tasks[agent.id] || [])];
     const fromBacklog = backlogByOwner[agent.id] ? [...backlogByOwner[agent.id]] : [];
     const queue = [...seeded, ...fromBacklog];
     if (queue.length === 0) {
      await supervisorLogger.info("No pending work", { agent: agent.id });
      continue;
     }
     const delay = jitteredDelay(500, 500);
     timers.push(setTimeout(() => runAgent(agent, queue), delay));
  }
}

main().catch(async (error) => {
  console.error("[supervisor] Fatal", error);
  process.exit(1);
});
