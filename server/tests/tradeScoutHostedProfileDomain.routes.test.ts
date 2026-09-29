import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const profile = {
    id: "profile-1",
    slug: "north-shore-repair",
    ownerUserId: "owner-1",
    status: "published",
    seoMeta: { title: "North Shore Repair" } as Record<string, unknown>,
  };
  const state = {
    role: "head_admin",
    profile,
    selectQueue: [] as any[][],
    savedSeoMeta: null as Record<string, unknown> | null,
  };
  const tx: any = {
    execute: vi.fn(async () => ({})),
    select: vi.fn(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(async () => state.selectQueue.shift() || []),
      };
      return chain;
    }),
    update: vi.fn(() => {
      const chain: any = {
        set: vi.fn((value: { seoMeta: Record<string, unknown> }) => {
          state.savedSeoMeta = value.seoMeta;
          return chain;
        }),
        where: vi.fn(() => chain),
        returning: vi.fn(async () => [{ ...state.profile, seoMeta: state.savedSeoMeta }]),
      };
      return chain;
    }),
  };
  const database: any = {
    select: vi.fn(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(async () => []),
      };
      return chain;
    }),
    transaction: vi.fn(async (work: (transaction: any) => unknown) => work(tx)),
  };
  return {
    state,
    tx,
    database,
    storage: {
      getProfileById: vi.fn(async () => state.profile),
      getProfileBySlugPublic: vi.fn(async () => state.profile),
    },
  };
});

vi.mock("../auth", () => ({
  isAuthenticated: (req: any, _res: any, next: () => void) => {
    req.user = { id: "staff-1", role: mocks.state.role };
    next();
  },
}));
vi.mock("../storage", () => ({ storage: mocks.storage }));
vi.mock("../db", () => ({ db: mocks.database, pool: { query: vi.fn() } }));
vi.mock("../services/indexNowService", () => ({ notifyIndexNow: vi.fn() }));

import { profilesRouter } from "../routes/profiles";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(profilesRouter);
  return instance;
}

const route = "/api/profiles/profile-1/tradescout-domain";
const hostedDomain = "north-shore-repair.thetradescout.com";

describe("staff-activated TradeScout profile host", () => {
  const previousReady = process.env.TRADESCOUT_HOSTED_PROFILE_DOMAINS_READY;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.role = "head_admin";
    mocks.state.profile = {
      id: "profile-1",
      slug: "north-shore-repair",
      ownerUserId: "owner-1",
      status: "published",
      seoMeta: { title: "North Shore Repair" },
    };
    mocks.state.selectQueue = [];
    mocks.state.savedSeoMeta = null;
    mocks.storage.getProfileById.mockImplementation(async () => mocks.state.profile);
    mocks.storage.getProfileBySlugPublic.mockImplementation(async () => mocks.state.profile);
    process.env.TRADESCOUT_HOSTED_PROFILE_DOMAINS_READY = "true";
  });

  afterEach(() => {
    if (previousReady === undefined) delete process.env.TRADESCOUT_HOSTED_PROFILE_DOMAINS_READY;
    else process.env.TRADESCOUT_HOSTED_PROFILE_DOMAINS_READY = previousReady;
  });

  it("keeps domain activation out of owner self-service", async () => {
    mocks.state.role = "business_owner";
    const response = await request(app()).patch(route).send({ enabled: true });
    expect(response.status).toBe(403);
    expect(mocks.storage.getProfileById).not.toHaveBeenCalled();
  });

  it("requires the operator's DNS and TLS readiness assertion", async () => {
    process.env.TRADESCOUT_HOSTED_PROFILE_DOMAINS_READY = "false";
    const response = await request(app()).patch(route).send({ enabled: true });
    expect(response.status).toBe(503);
    expect(mocks.database.transaction).not.toHaveBeenCalled();
  });

  it("does not activate a private or unreleased profile", async () => {
    mocks.storage.getProfileBySlugPublic.mockResolvedValueOnce(undefined);
    const response = await request(app()).patch(route).send({ enabled: true });
    expect(response.status).toBe(409);
    expect(mocks.database.transaction).not.toHaveBeenCalled();
  });

  it("preserves an existing customer domain", async () => {
    mocks.state.selectQueue.push([
      { id: "profile-1", slug: "north-shore-repair", seoMeta: { customDomain: "repair.example" } },
    ]);
    const response = await request(app()).patch(route).send({ enabled: true });
    expect(response.status).toBe(409);
    expect(mocks.state.savedSeoMeta).toBeNull();
  });

  it("rejects another claim to the same host before writing", async () => {
    mocks.state.selectQueue.push(
      [{ id: "profile-1", slug: "north-shore-repair", seoMeta: { title: "North Shore Repair" } }],
      [{ id: "other-profile" }]
    );
    const response = await request(app()).patch(route).send({ enabled: true });
    expect(response.status).toBe(409);
    expect(mocks.state.savedSeoMeta).toBeNull();
  });

  it("activates only the slug-derived host while preserving profile SEO metadata", async () => {
    mocks.state.selectQueue.push(
      [{ id: "profile-1", slug: "north-shore-repair", seoMeta: { title: "North Shore Repair" } }],
      [], [], []
    );
    const response = await request(app()).patch(route).send({ enabled: true });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ enabled: true, domain: hostedDomain });
    expect(mocks.state.savedSeoMeta).toEqual({
      title: "North Shore Repair",
      customDomain: hostedDomain,
    });
  });

  it("can release a TradeScout host without deleting the profile", async () => {
    mocks.state.selectQueue.push([{
      id: "profile-1",
      slug: "north-shore-repair",
      seoMeta: { title: "North Shore Repair", customDomain: hostedDomain },
    }]);
    const response = await request(app()).patch(route).send({ enabled: false });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ enabled: false, domain: null });
    expect(mocks.state.savedSeoMeta).toEqual({ title: "North Shore Repair" });
  });
});
