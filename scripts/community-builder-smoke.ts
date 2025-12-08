/*
Minimal end-to-end smoke test for the Community Builder system.

Usage:
  BASE_URL=http://localhost:5000 \
  BUILDER_COOKIE="connect.sid=..." \
  ADMIN_COOKIE="connect.sid=..." \
  tsx scripts/community-builder-smoke.ts

Required auth:
- BUILDER_COOKIE: session cookie for a normal builder user
- ADMIN_COOKIE: session cookie for an admin user (for approval/verification)

What it verifies:
1) Builder profile can be created/updated
2) Contribution can be proposed
3) Admin can see pending contributions
4) Admin can approve + verify the contribution
5) Builder sees updated status

KPI: Script exits 0 and prints "SMOKE TEST PASSED".
*/

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const BUILDER_COOKIE = process.env.BUILDER_COOKIE;
const ADMIN_COOKIE = process.env.ADMIN_COOKIE;

if (!BUILDER_COOKIE || !ADMIN_COOKIE) {
  console.error("Missing BUILDER_COOKIE or ADMIN_COOKIE env vars.");
  process.exit(1);
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH";

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: Record<string, unknown>,
  cookie?: string
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} failed: ${res.status} ${res.statusText} => ${text}`);
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    throw new Error(`Failed to parse JSON for ${method} ${path}: ${(err as Error).message}`);
  }
}

interface ContributionResponse {
  id: string;
  status?: string;
}

async function main() {
  const suffix = Date.now();

  console.log(`1) Upsert builder profile...`);
  const profile = await request("POST", "/api/community-builder/profile", {
    businessName: `Smoke Builder ${suffix}`,
    countyId: "demo-county", // replace with a real county id
    description: "Smoke test builder profile",
    payoutEmail: "smoke@example.com",
  }, BUILDER_COOKIE);
  console.log(`   ✔ profile id: ${(profile as { id?: string }).id ?? "unknown"}`);

  console.log(`2) Submit contribution...`);
  const contribution = await request<ContributionResponse>("POST", "/api/community-builder/contributions", {
    countyId: "demo-county", // replace with a real county id
    title: `Smoke Contribution ${suffix}`,
    description: "Community builder smoke test contribution",
    type: "service_hours",
    estimatedValue: "1000.00",
    estimatedHours: "10",
    impact: "Smoke test impact",
    tags: ["smoke", "test"],
  }, BUILDER_COOKIE);
  console.log(`   ✔ contribution id: ${contribution.id}`);

  console.log(`3) Admin sees pending contributions...`);
  const pending = await request<{ items?: { id: string }[] }>("GET", "/api/admin/community-builder/contributions/pending", undefined, ADMIN_COOKIE);
  if (!pending.items || !pending.items.find((c) => c.id === contribution.id)) {
    throw new Error("Contribution not visible in pending queue");
  }
  console.log(`   ✔ contribution appears in pending queue`);

  console.log(`4) Admin approves contribution...`);
  await request("POST", `/api/admin/community-builder/contributions/${contribution.id}/approve`, {
    notes: "Smoke test approve",
  }, ADMIN_COOKIE);
  console.log(`   ✔ approved`);

  console.log(`5) Admin verifies contribution...`);
  await request("POST", `/api/admin/community-builder/contributions/${contribution.id}/verify`, {
    actualValue: "950.00",
    actualHours: "9",
    notes: "Smoke test verify",
  }, ADMIN_COOKIE);
  console.log(`   ✔ verified`);

  console.log(`6) Builder sees updated status...`);
  const detail = await request<ContributionResponse>("GET", `/api/community-builder/contributions/${contribution.id}`, undefined, BUILDER_COOKIE);
  const status = (detail as { status?: string }).status;
  if (!status || status.toLowerCase() !== "verified") {
    throw new Error(`Expected status 'verified', got '${status}'`);
  }
  console.log(`   ✔ status is verified`);

  console.log("SMOKE TEST PASSED");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED", err);
  process.exit(1);
});
