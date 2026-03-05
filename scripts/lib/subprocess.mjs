import { spawn } from "node:child_process";

function buildCandidates(command) {
  const raw = String(command || "").trim();
  if (!raw) return [];

  return [raw];
}

function quoteCmdArg(value) {
  const raw = String(value ?? "");
  if (raw.length === 0) return '""';
  // Quote when whitespace or cmd metacharacters are present.
  if (!/[\s"&^|<>()%]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '\\"')}"`;
}

function toCmdCommandLine(command, args) {
  const parts = [command, ...(args ?? [])].map(quoteCmdArg);
  return parts.join(" ");
}

export async function spawnCommand(command, args, options = {}) {
  const candidates = buildCandidates(command);
  if (candidates.length === 0) throw new Error("[subprocess] Missing command");

  // Windows: prefer explicit cmd.exe dispatch so `.cmd` shims work without `shell: true`,
  // avoiding Node's DEP0190 warning.
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "cmd.exe";
    const cmdline = toCmdCommandLine(candidates[0], args);
    const child = spawn(comspec, ["/d", "/s", "/c", cmdline], { ...options, shell: false });
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    return child;
  }

  // POSIX: attempt direct spawn and optionally fall back to common extensions.
  const base = candidates[0];
  const tryList =
    /[\\/]/.test(base) || /\.[a-z0-9]+$/i.test(base) ? [base] : [base, `${base}.sh`];

  let lastError = null;
  for (const candidate of tryList) {
    const child = spawn(candidate, args ?? [], { ...options, shell: false });
    const started = await new Promise((resolve, reject) => {
      child.once("spawn", () => resolve(true));
      child.once("error", (error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        if (/** @type {any} */ (err).code === "ENOENT") {
          resolve(false);
          return;
        }
        reject(err);
      });
    });
    if (started) return child;
    lastError = new Error(`Command not found: ${candidate}`);
  }

  throw lastError ?? new Error(`Command not found: ${String(command)}`);
}

export async function runCommand(command, args, options = {}) {
  const child = await spawnCommand(command, args, options);
  return await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
