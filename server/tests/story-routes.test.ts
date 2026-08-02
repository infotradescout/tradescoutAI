import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateStory: vi.fn(),
  getTemplates: vi.fn(),
  insert: vi.fn(),
  logEvent: vi.fn(),
  select: vi.fn(),
}));

vi.mock("../auth", () => ({
  isAuthenticated: (req: any, _res: any, next: () => void) => {
    req.user = { id: "story-user-1" };
    next();
  },
}));

vi.mock("../db", () => ({
  db: {
    insert: mocks.insert,
    select: mocks.select,
  },
}));

vi.mock("../storage", () => ({
  storage: {
    logEvent: mocks.logEvent,
  },
}));

vi.mock("../story-generation-service", () => ({
  StoryGenerationService: {
    generateStory: mocks.generateStory,
    getTemplates: mocks.getTemplates,
  },
}));

import { registerStoryRoutes } from "../routes/stories";

function buildApp() {
  const app = express();
  app.use(express.json());
  registerStoryRoutes(app);
  return app;
}

describe("professional story routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("generates a story with the authenticated user and default inputs", async () => {
    const generatedStory = { id: "generated-1", title: "A professional story" };
    mocks.generateStory.mockResolvedValueOnce(generatedStory);

    const response = await request(buildApp())
      .post("/api/stories/generate")
      .send({ templateId: "template-1" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(generatedStory);
    expect(mocks.generateStory).toHaveBeenCalledWith({
      templateId: "template-1",
      userInputs: {},
      userId: "story-user-1",
    });
  });

  it("rejects generation without a template id", async () => {
    const response = await request(buildApp()).post("/api/stories/generate").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Template ID is required" });
    expect(mocks.generateStory).not.toHaveBeenCalled();
  });

  it("validates, saves, and logs a generated story", async () => {
    const savedStory = {
      id: "story-1",
      userId: "story-user-1",
      templateId: "template-1",
      title: "Saved story",
      content: "Saved content",
    };
    const returning = vi.fn().mockResolvedValueOnce([savedStory]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.insert.mockReturnValue({ values });
    mocks.logEvent.mockResolvedValueOnce(undefined);

    const response = await request(buildApp()).post("/api/stories").send({
      templateId: "template-1",
      title: "Saved story",
      content: "Saved content",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(savedStory);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "story-user-1",
        templateId: "template-1",
        title: "Saved story",
        content: "Saved content",
      })
    );
    expect(mocks.logEvent).toHaveBeenCalledWith("story_saved", {
      storyId: "story-1",
      userId: "story-user-1",
      templateId: "template-1",
    });
  });

  it("lists the authenticated user's stories with the existing pagination", async () => {
    const stories = [{ id: "story-3" }];
    const offset = vi.fn().mockResolvedValueOnce(stories);
    const limit = vi.fn().mockReturnValue({ offset });
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mocks.select.mockReturnValue({ from });

    const response = await request(buildApp()).get("/api/stories?page=3&limit=5&public_only=true");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(stories);
    expect(limit).toHaveBeenCalledWith(5);
    expect(offset).toHaveBeenCalledWith(10);
  });

  it("keeps story templates public", async () => {
    const templates = [{ id: "template-1", name: "Professional profile" }];
    mocks.getTemplates.mockReturnValueOnce(templates);

    const response = await request(buildApp()).get("/api/stories/templates");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(templates);
  });
});
