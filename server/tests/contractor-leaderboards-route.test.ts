import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerContractorLeaderboardRoutes,
  type ContractorLeaderboardRouteStorage,
} from "../routes/contractor-leaderboards";

const storage = {
  getMonthlyLeaderboard: vi.fn(),
  getLifetimeLeaderboard: vi.fn(),
  getContractorLeaderboardPosition: vi.fn(),
} as unknown as ContractorLeaderboardRouteStorage;

function buildApp() {
  const app = express();
  registerContractorLeaderboardRoutes(app, storage);
  return app;
}

describe("contractor leaderboard routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards explicit monthly filters with the existing numeric coercion", async () => {
    vi.mocked(storage.getMonthlyLeaderboard).mockResolvedValueOnce([{ rank: 1 }]);

    const response = await request(buildApp()).get(
      "/api/leaderboard/monthly?month=7&year=2026&limit=4&state=TX&county=Travis%20County"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ rank: 1 }]);
    expect(storage.getMonthlyLeaderboard).toHaveBeenCalledWith(7, 2026, 4, "TX", "Travis County");
  });

  it("preserves the current month, year, and limit defaults", async () => {
    vi.mocked(storage.getMonthlyLeaderboard).mockResolvedValueOnce([]);
    const now = new Date();

    const response = await request(buildApp()).get("/api/leaderboard/monthly");

    expect(response.status).toBe(200);
    expect(storage.getMonthlyLeaderboard).toHaveBeenCalledWith(
      now.getMonth() + 1,
      now.getFullYear(),
      20,
      undefined,
      undefined
    );
  });

  it("forwards lifetime filters and returns the storage payload", async () => {
    vi.mocked(storage.getLifetimeLeaderboard).mockResolvedValueOnce([{ contractorId: "c-1" }]);

    const response = await request(buildApp()).get(
      "/api/leaderboard/lifetime?limit=8&state=LA&county=Orleans"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ contractorId: "c-1" }]);
    expect(storage.getLifetimeLeaderboard).toHaveBeenCalledWith(8, "LA", "Orleans");
  });

  it("uses the existing lifetime defaults", async () => {
    vi.mocked(storage.getLifetimeLeaderboard).mockResolvedValueOnce([]);

    const response = await request(buildApp()).get("/api/leaderboard/lifetime");

    expect(response.status).toBe(200);
    expect(storage.getLifetimeLeaderboard).toHaveBeenCalledWith(20, undefined, undefined);
  });

  it("looks up a contractor position by the route parameter", async () => {
    vi.mocked(storage.getContractorLeaderboardPosition).mockResolvedValueOnce({ rank: 3 });

    const response = await request(buildApp()).get("/api/leaderboard/contractor/contractor-7");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ rank: 3 });
    expect(storage.getContractorLeaderboardPosition).toHaveBeenCalledWith("contractor-7");
  });

  it.each([
    {
      path: "/api/leaderboard/monthly",
      method: "getMonthlyLeaderboard" as const,
      message: "Failed to fetch monthly leaderboard",
    },
    {
      path: "/api/leaderboard/lifetime",
      method: "getLifetimeLeaderboard" as const,
      message: "Failed to fetch lifetime leaderboard",
    },
    {
      path: "/api/leaderboard/contractor/contractor-7",
      method: "getContractorLeaderboardPosition" as const,
      message: "Failed to fetch contractor position",
    },
  ])("preserves the $path error envelope", async ({ path, method, message }) => {
    vi.mocked(storage[method]).mockRejectedValueOnce(new Error("storage failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const response = await request(buildApp()).get(path);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message });
      expect(errorSpy).toHaveBeenCalledOnce();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
