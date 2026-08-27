import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const sourceLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const sourcePackages = sourceLock.packages || {};

function packageKey(packageName) {
  return `node_modules/${packageName}`;
}

function resolveDependency(fromKey, dependencyName) {
  let base = fromKey;
  while (true) {
    const candidate = `${base ? `${base}/` : ""}node_modules/${dependencyName}`;
    if (sourcePackages[candidate]) return candidate;
    if (!base) return null;
    const parent = base.replace(/\/?node_modules\/(?:@[^/]+\/)?[^/]+$/, "");
    if (parent === base) return null;
    base = parent;
  }
}

function reachability() {
  const states = new Map();
  const queue = [];
  function enqueue(dependencyName, state, fromKey = "") {
    const key = fromKey ? resolveDependency(fromKey, dependencyName) : packageKey(dependencyName);
    if (!sourcePackages[key]) {
      throw new Error(`package-lock is missing direct dependency ${dependencyName}`);
    }
    const stateKey = `${state.lane}:${state.optional ? "optional" : "required"}`;
    const packageStates = states.get(key) || new Set();
    if (packageStates.has(stateKey)) return;
    packageStates.add(stateKey);
    states.set(key, packageStates);
    queue.push({ key, state });
  }

  for (const dependencyName of Object.keys(packageJson.dependencies || {})) {
    enqueue(dependencyName, { lane: "production", optional: false });
  }
  for (const dependencyName of Object.keys(packageJson.optionalDependencies || {})) {
    enqueue(dependencyName, { lane: "production", optional: true });
  }
  for (const dependencyName of Object.keys(packageJson.devDependencies || {})) {
    enqueue(dependencyName, { lane: "development", optional: false });
  }

  while (queue.length) {
    const { key, state } = queue.shift();
    const entry = sourcePackages[key];
    for (const dependencyName of Object.keys(entry.dependencies || {})) {
      enqueue(dependencyName, state, key);
    }
    for (const dependencyName of Object.keys(entry.optionalDependencies || {})) {
      const resolved = resolveDependency(key, dependencyName);
      if (resolved) enqueue(dependencyName, { ...state, optional: true }, key);
    }
    for (const dependencyName of Object.keys(entry.peerDependencies || {})) {
      if (entry.peerDependenciesMeta?.[dependencyName]?.optional) {
        const resolved = resolveDependency(key, dependencyName);
        if (resolved) enqueue(dependencyName, { ...state, optional: true }, key);
      } else {
        enqueue(dependencyName, state, key);
      }
    }
  }
  return states;
}

const states = reachability();
const selected = new Set(states.keys());
const rootLockEntry = {
  ...(sourcePackages[""] || {}),
  name: packageJson.name,
  version: packageJson.version,
  license: packageJson.license,
  dependencies: packageJson.dependencies,
  devDependencies: packageJson.devDependencies,
  optionalDependencies: packageJson.optionalDependencies,
  overrides: packageJson.overrides,
};

const projectedPackages = { "": rootLockEntry };
for (const key of [...selected].sort()) {
  const entry = { ...sourcePackages[key] };
  delete entry.dev;
  delete entry.optional;
  delete entry.devOptional;
  const packageStates = states.get(key);
  const productionRequired = packageStates.has("production:required");
  const productionOptional = packageStates.has("production:optional");
  const developmentRequired = packageStates.has("development:required");
  const developmentOptional = packageStates.has("development:optional");
  if (!productionRequired && productionOptional && developmentRequired) {
    entry.devOptional = true;
  } else if (!productionRequired && productionOptional) {
    entry.optional = true;
  } else if (!productionRequired && developmentRequired) {
    entry.dev = true;
  } else if (!productionRequired && developmentOptional) {
    entry.dev = true;
    entry.optional = true;
  }
  projectedPackages[key] = entry;
}

const projectedLock = {
  ...sourceLock,
  name: packageJson.name,
  version: packageJson.version,
  packages: projectedPackages,
};
const output = `${JSON.stringify(projectedLock, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (fs.readFileSync(lockPath, "utf8") !== output) {
    console.error("package-lock.json does not match package.json dependency reachability");
    process.exit(1);
  }
  console.log(`Package lock projection passed (${selected.size} package records).`);
} else {
  fs.writeFileSync(lockPath, output);
  console.log(`Projected package lock with ${selected.size} package records.`);
}
