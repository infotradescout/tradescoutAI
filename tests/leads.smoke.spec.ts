import { test, expect } from "@playwright/test";

test("Lead submit API accepts a valid payload (uses real trade + county IDs)", async ({ page }) => {
  // 1) Get a real trade
  const tradesRes = await page.request.get("/api/trades");
  expect(tradesRes.ok()).toBeTruthy();
  const trades = await tradesRes.json();
  expect(Array.isArray(trades)).toBeTruthy();
  expect(trades.length).toBeGreaterThan(0);

  const trade = trades[0];
  const tradeId = trade?.id;
  expect(typeof tradeId).toBe("string");
  expect(tradeId.length).toBeGreaterThan(0);

  // 2) Get a real state code, then a real county
  const statesRes = await page.request.get("/api/states");
  expect(statesRes.ok()).toBeTruthy();
  const states = await statesRes.json();
  expect(Array.isArray(states)).toBeTruthy();
  expect(states.length).toBeGreaterThan(0);

  const stateCode = states.find((s: any) => s?.code === "IL")?.code || states[0]?.code;
  expect(typeof stateCode).toBe("string");
  expect(stateCode.length).toBe(2);

  const countiesRes = await page.request.get(`/api/counties?state=${encodeURIComponent(stateCode)}`);
  expect(countiesRes.ok()).toBeTruthy();
  const counties = await countiesRes.json();
  expect(Array.isArray(counties)).toBeTruthy();
  expect(counties.length).toBeGreaterThan(0);

  const county = counties[0];
  const countyId = county?.id || county?.fips;
  expect(typeof countyId).toBe("string");
  expect(countyId.length).toBeGreaterThan(0);

  // 3) Submit lead
  const stamp = new Date().toISOString();
  const payload = {
    projectType: trade?.name || trade?.slug || "General",
    countyId,
    tradeId,
    urgency: "planning",
    routingType: "top3",
    description: `Lead smoke ${stamp}`,
  };

  const leadRes = await page.request.post("/api/leads", {
    data: payload,
    headers: { "Content-Type": "application/json" },
  });

  const bodyText = await leadRes.text();
  expect(leadRes.status(), bodyText).toBe(200);
});
