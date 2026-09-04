import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routes = fs.readFileSync(path.resolve(process.cwd(), "client/src/AppRoutes.tsx"), "utf8");

function routeBlock(routePath: string): string {
  const marker = `<Route path="${routePath}">`;
  const start = routes.indexOf(marker);
  expect(start, `${routePath} route should exist`).toBeGreaterThan(-1);
  const end = routes.indexOf("</Route>", start);
  expect(end, `${routePath} route should close`).toBeGreaterThan(start);
  return routes.slice(start, end + "</Route>".length);
}

describe("professional client route gating", () => {
  it.each([
    "/car-sales-new-listing",
    "/car-sales-customers",
    "/car-sales-financing",
    "/car-sales-trade-in",
    "/car-sales-vin-lookup",
    "/car-sales-appointments",
    "/car-sales-follow-up",
  ])("requires the approved canonical car-dealer role for %s", (routePath) => {
    const block = routeBlock(routePath);

    expect(block).toContain('<ProtectedRoute requiredRoles={["car_dealer"]}>');
    expect(block).not.toContain("car_salesman");
  });

  it.each([
    "/realtor-clients",
    "/realtor-market-analysis",
    "/realtor-connections",
    "/realtor-cma",
    "/realtor-appointments",
    "/realtor-contacts",
  ])("requires the approved realtor role for %s", (routePath) => {
    expect(routeBlock(routePath)).toContain('<ProtectedRoute requiredRoles={["realtor"]}>');
  });

  it.each([
    ["/realtor-application", "RealtorApplication"],
    ["/car-salesman-application", "CarSalesmanApplication"],
    ["/car-sales-payment-calculator", "CarSalesPaymentCalculator"],
    ["/realtor-calculator", "RealtorCalculator"],
  ])("keeps the intentional public entry %s outside ProtectedRoute", (routePath, component) => {
    const block = routeBlock(routePath);

    expect(block).toContain(`<LazyPage Component={${component}} />`);
    expect(block).not.toContain("<ProtectedRoute");
  });
});
