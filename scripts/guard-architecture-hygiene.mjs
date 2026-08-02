import fs from "node:fs/promises";
import path from "node:path";

function pass(name, detail) {
  return { name, status: "PASS", detail };
}

function fail(name, detail) {
  return { name, status: "FAIL", detail };
}

async function fileSizeBytes(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  // The ceilings were recorded from Git's canonical LF source. Windows
  // checkouts may materialize CRLF, which adds one byte per line without
  // adding architecture. Normalize only line endings before applying the
  // existing ceiling so real source growth still fails closed.
  return Buffer.byteLength(source.replace(/\r\n/g, "\n"), "utf8");
}

function formatBytes(value) {
  return `${value.toLocaleString("en-US")} B`;
}

async function checkMonolithCaps(repoRoot) {
  const checks = [];
  const caps = [
    {
      relPath: "server/routes.ts",
      maxBytes: 1003469,
      rationale: "Must not grow while route extraction is in progress",
    },
    {
      relPath: "server/routes/direct-connect.ts",
      maxBytes: 406831,
      rationale: "Must not grow while Direct Connect route extraction is in progress",
    },
    {
      relPath: "server/storage.ts",
      maxBytes: 286722,
      rationale: "Must not grow while repository split is in progress",
    },
    {
      relPath: "shared/schema.ts",
      maxBytes: 419904,
      rationale: "Must not grow while schema domain extraction is in progress",
    },
  ];

  for (const cap of caps) {
    const absPath = path.join(repoRoot, cap.relPath);
    const size = await fileSizeBytes(absPath);
    if (size <= cap.maxBytes) {
      checks.push(
        pass(
          `size:${cap.relPath}`,
          `${formatBytes(size)} LF-normalized <= ${formatBytes(cap.maxBytes)} (${cap.rationale})`
        )
      );
    } else {
      checks.push(
        fail(
          `size:${cap.relPath}`,
          `${formatBytes(size)} LF-normalized > ${formatBytes(cap.maxBytes)} (${cap.rationale})`
        )
      );
    }
  }

  return checks;
}

async function checkDeprecatedAuthSurface(repoRoot) {
  const checks = [];
  const deprecatedReplitAuth = path.join(repoRoot, "server", "replitAuth.ts");

  try {
    await fs.access(deprecatedReplitAuth);
    checks.push(
      fail(
        "deprecated:server/replitAuth.ts",
        "Deprecated Replit auth module exists in live server path"
      )
    );
  } catch {
    checks.push(
      pass(
        "deprecated:server/replitAuth.ts",
        "No live Replit auth module detected in server/"
      )
    );
  }

  const deviceAuthVariants = ["device-auth.ts", "deviceAuth.ts"];
  const serverDir = path.join(repoRoot, "server");
  const found = [];
  for (const name of deviceAuthVariants) {
    const candidate = path.join(serverDir, name);
    try {
      await fs.access(candidate);
      found.push(name);
    } catch {
      // file absent
    }
  }

  if (found.length > 1) {
    checks.push(
      fail(
        "duplicate:device-auth-variant",
        `Multiple server device auth variants present: ${found.join(", ")}`
      )
    );
  } else if (found.length === 1) {
    checks.push(
      pass(
        "duplicate:device-auth-variant",
        `Single server device auth implementation present: ${found[0]}`
      )
    );
  } else {
    checks.push(
      fail(
        "duplicate:device-auth-variant",
        "No server device auth implementation found (expected one of deviceAuth.ts/device-auth.ts)"
      )
    );
  }

  return checks;
}

async function run() {
  const repoRoot = process.cwd();
  const checks = [
    ...(await checkMonolithCaps(repoRoot)),
    ...(await checkDeprecatedAuthSurface(repoRoot)),
  ];

  for (const check of checks) {
    console.log(`${check.status} ${check.name}: ${check.detail}`);
  }

  const hasFailure = checks.some((check) => check.status === "FAIL");
  if (hasFailure) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error("FAIL architecture_hygiene:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
