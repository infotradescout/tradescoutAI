import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listCommunityCausesByProfileMock,
  getUserMock,
  createCommunityCauseForOwnerMock,
  voteForCommunityCauseMock,
} = vi.hoisted(() => ({
  listCommunityCausesByProfileMock: vi.fn(),
  getUserMock: vi.fn(),
  createCommunityCauseForOwnerMock: vi.fn(),
  voteForCommunityCauseMock: vi.fn(),
}));

vi.mock("../auth", () => ({
  isAuthenticated: (req: any, _res: any, next: any) => {
    const userId = req.headers["x-test-user-id"] || "test-user";
    req.user = { id: String(userId) };
    next();
  },
}));

vi.mock("../storage", () => ({
  storage: {
    listCommunityCausesByProfile: listCommunityCausesByProfileMock,
    getUser: getUserMock,
    createCommunityCauseForOwner: createCommunityCauseForOwnerMock,
    voteForCommunityCause: voteForCommunityCauseMock,
  },
}));

import communityCausesRouter from "../routes/community-causes-routes";

describe("community causes route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns weighted representation fields from vote endpoint", async () => {
    getUserMock.mockResolvedValue({ id: "test-user", roles: ["community_builder"] });
    voteForCommunityCauseMock.mockResolvedValue({
      vote: { id: "vote-1", causeId: "cause-1", userId: "test-user" },
      voteCount: 3,
      weightedVoteTotal: 7.5,
      allocationShare: 42.55,
      voteWeight: 2.5,
    });

    const app = express();
    app.use(express.json());
    app.use("/api/community-causes", communityCausesRouter);

    const res = await request(app)
      .post("/api/community-causes/cause-1/vote")
      .set("x-test-user-id", "test-user")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.voteCount).toBe(3);
    expect(res.body.weightedVoteTotal).toBe(7.5);
    expect(res.body.allocationShare).toBe(42.55);
    expect(res.body.voteWeight).toBe(2.5);
  });

  it("keeps repeated vote responses stable when storage vote handling is idempotent", async () => {
    getUserMock.mockResolvedValue({ id: "test-user", roles: ["community_builder"] });
    voteForCommunityCauseMock
      .mockResolvedValueOnce({
        vote: { id: "vote-stable", causeId: "cause-1", userId: "test-user" },
        voteCount: 4,
        weightedVoteTotal: 9.25,
        allocationShare: 37.5,
        voteWeight: 2.25,
      })
      .mockResolvedValueOnce({
        vote: { id: "vote-stable", causeId: "cause-1", userId: "test-user" },
        voteCount: 4,
        weightedVoteTotal: 9.25,
        allocationShare: 37.5,
        voteWeight: 2.25,
      });

    const app = express();
    app.use(express.json());
    app.use("/api/community-causes", communityCausesRouter);

    const first = await request(app)
      .post("/api/community-causes/cause-1/vote")
      .set("x-test-user-id", "test-user")
      .send({});

    const second = await request(app)
      .post("/api/community-causes/cause-1/vote")
      .set("x-test-user-id", "test-user")
      .send({});

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    expect(second.body.vote.id).toBe(first.body.vote.id);
    expect(second.body.voteCount).toBe(first.body.voteCount);
    expect(second.body.weightedVoteTotal).toBe(first.body.weightedVoteTotal);
    expect(second.body.allocationShare).toBe(first.body.allocationShare);
    expect(second.body.voteWeight).toBe(first.body.voteWeight);
  });

  it("blocks vote endpoint when user is not a community builder", async () => {
    getUserMock.mockResolvedValue({ id: "test-user", roles: ["homeowner"] });

    const app = express();
    app.use(express.json());
    app.use("/api/community-causes", communityCausesRouter);

    const res = await request(app)
      .post("/api/community-causes/cause-1/vote")
      .set("x-test-user-id", "test-user")
      .send({});

    expect(res.status).toBe(403);
    expect(String(res.body?.error || "")).toContain(
      "Community Builder badge required to vote on causes"
    );
  });

  it("allows cause creation only for platform curator roles", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/community-causes", communityCausesRouter);

    getUserMock.mockResolvedValueOnce({ id: "test-user", roles: ["community_builder"] });
    const denied = await request(app)
      .post("/api/community-causes")
      .set("x-test-user-id", "test-user")
      .send({ profileId: "profile-1", title: "Local Tools" });

    expect(denied.status).toBe(403);
    expect(String(denied.body?.error || "")).toContain(
      "Platform curator access required to create causes"
    );

    getUserMock.mockResolvedValueOnce({ id: "admin-user", roles: ["super_admin"] });
    createCommunityCauseForOwnerMock.mockResolvedValue({
      id: "cause-1",
      profileId: "profile-1",
      title: "Local Tools",
    });

    const allowed = await request(app)
      .post("/api/community-causes")
      .set("x-test-user-id", "admin-user")
      .send({ profileId: "profile-1", title: "Local Tools" });

    expect(allowed.status).toBe(201);
    expect(allowed.body.id).toBe("cause-1");
    expect(createCommunityCauseForOwnerMock).toHaveBeenCalledWith("admin-user", {
      profileId: "profile-1",
      title: "Local Tools",
      description: null,
    });
  });
});
