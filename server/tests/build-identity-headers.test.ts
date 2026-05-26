import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildIdentityHeadersMiddleware,
  resolveBuildRevision,
} from "../middleware/buildIdentityHeaders";

describe("build identity header middleware", () => {
  let previousRenderCommit: string | undefined;

  beforeEach(() => {
    previousRenderCommit = process.env.RENDER_GIT_COMMIT;
    process.env.RENDER_GIT_COMMIT = "test-build-identity";
  });

  afterEach(() => {
    if (typeof previousRenderCommit === "undefined") {
      delete process.env.RENDER_GIT_COMMIT;
    } else {
      process.env.RENDER_GIT_COMMIT = previousRenderCommit;
    }
  });

  it("emits the build header on public and API paths", async () => {
    const app = express();
    app.use(buildIdentityHeadersMiddleware);

    app.get("/direct-connect", (_req, res) => {
      res.status(200).send("public-ok");
    });
    app.get("/api/version", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const publicRes = await request(app).get("/direct-connect");
    const apiRes = await request(app).get("/api/version");
    const expectedBuild = resolveBuildRevision();

    expect(publicRes.status).toBe(200);
    expect(apiRes.status).toBe(200);
    expect(publicRes.headers["x-tradescout-build"]).toBe(expectedBuild);
    expect(apiRes.headers["x-tradescout-build"]).toBe(expectedBuild);
  });
});
