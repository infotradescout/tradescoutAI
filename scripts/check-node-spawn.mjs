import { spawnSync } from "node:child_process";

function canSpawn() {
  if (process.platform === "win32") {
    const r = spawnSync("cmd", ["/c", "echo", "ok"], { windowsHide: true });
    return !r.error;
  }

  const r = spawnSync("sh", ["-lc", "echo ok"], { stdio: "ignore" });
  return !r.error;
}

if (!canSpawn()) {
  // This most commonly shows up as EPERM in locked-down Windows environments and breaks Vite/Vitest
  // because they rely on spawning the esbuild binary.
  console.error(
    [
      "",
      "TradeScout build/test cannot run in this environment because Node.js is not allowed to spawn child processes.",
      "",
      "Symptoms you may see:",
      "- `Error: spawn EPERM` while loading `vite.config.ts` (build/dev)",
      "- `Error: spawn EPERM` while loading `vitest.config.ts` (tests)",
      "",
      "Fix options:",
      "1) Use a machine/environment where Node can spawn child processes (recommended):",
      "   - WSL2 (Ubuntu) or a Linux CI runner (GitHub Actions already uses Ubuntu).",
      "2) On locked-down Windows machines, ask IT/Security to allow `node.exe` to create child processes.",
      "   This is often an EDR/WDAC/AppLocker policy restriction.",
      "",
      "Quick self-test:",
      "  node -e \"require('child_process').spawnSync('cmd',['/c','echo','ok']);\"",
      "",
    ].join("\n")
  );
  process.exit(1);
}
