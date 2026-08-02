import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { tutorialStorage } from "../tutorialStorage";

export function registerTutorialRoutes(app: Express): void {
  app.get("/api/tutorials/user-progress", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const progress = await tutorialStorage.getUserTutorialProgress(userId);
      res.json(progress);
    } catch (error: any) {
      console.error("Error fetching tutorial progress:", error);
      res.status(500).json({ message: "Failed to fetch tutorial progress" });
    }
  });

  app.get("/api/tutorials/recommended", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const userRole = req.user?.role || "homeowner";

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const recommended = await tutorialStorage.getRecommendedTutorialsForUser(userId, userRole);
      res.json(recommended);
    } catch (error: any) {
      console.error("Error fetching recommended tutorials:", error);
      res.status(500).json({ message: "Failed to fetch recommended tutorials" });
    }
  });

  app.get("/api/tutorials/:tutorialId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { tutorialId } = req.params;
      const tutorial = await tutorialStorage.getTutorialById(tutorialId);

      if (!tutorial) {
        return res.status(404).json({ message: "Tutorial not found" });
      }

      res.json(tutorial);
    } catch (error: any) {
      console.error("Error fetching tutorial:", error);
      res.status(500).json({ message: "Failed to fetch tutorial" });
    }
  });

  app.post("/api/tutorials/:tutorialId/start", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const tutorial = await tutorialStorage.getTutorialById(tutorialId);
      if (!tutorial) {
        return res.status(404).json({ message: "Tutorial not found" });
      }

      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: tutorial.steps[0]?.id || "start",
        action: "started",
        userAgent: req.headers["user-agent"],
        viewport: req.body.viewport,
      });

      const progress = await tutorialStorage.createOrUpdateTutorialProgress({
        userId,
        tutorialId,
        tutorialType: tutorial.type as "onboarding" | "feature",
        stepIndex: "0",
        isCompleted: false,
        isSkipped: false,
      });

      res.json({ progress, tutorial });
    } catch (error: any) {
      console.error("Error starting tutorial:", error);
      res.status(500).json({ message: "Failed to start tutorial" });
    }
  });

  app.put("/api/tutorials/:tutorialId/progress", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;
      const { stepIndex, action, timeSpent, metadata } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const tutorial = await tutorialStorage.getTutorialById(tutorialId);
      if (!tutorial) {
        return res.status(404).json({ message: "Tutorial not found" });
      }

      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: tutorial.steps[parseInt(stepIndex)]?.id || stepIndex,
        action,
        timeSpent: timeSpent?.toString(),
        userAgent: req.headers["user-agent"],
        viewport: req.body.viewport,
        metadata,
      });

      const progress = await tutorialStorage.createOrUpdateTutorialProgress({
        userId,
        tutorialId,
        tutorialType: tutorial.type as "onboarding" | "feature",
        stepIndex,
        isCompleted: action === "completed",
        isSkipped: action === "skipped",
        metadata,
        ...(action === "completed" || action === "skipped" ? { completedAt: new Date() } : {}),
      });

      res.json(progress);
    } catch (error: any) {
      console.error("Error updating tutorial progress:", error);
      res.status(500).json({ message: "Failed to update tutorial progress" });
    }
  });

  app.post("/api/tutorials/:tutorialId/complete", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;
      const { finalStepIndex } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const progress = await tutorialStorage.markTutorialCompleted(
        userId,
        tutorialId,
        finalStepIndex
      );

      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: "completion",
        action: "completed",
        userAgent: req.headers["user-agent"],
        viewport: req.body.viewport,
      });

      res.json(progress);
    } catch (error: any) {
      console.error("Error completing tutorial:", error);
      res.status(500).json({ message: "Failed to complete tutorial" });
    }
  });

  app.post("/api/tutorials/:tutorialId/skip", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const progress = await tutorialStorage.markTutorialSkipped(userId, tutorialId);

      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: "skip",
        action: "skipped",
        userAgent: req.headers["user-agent"],
        viewport: req.body.viewport,
      });

      res.json(progress);
    } catch (error: any) {
      console.error("Error skipping tutorial:", error);
      res.status(500).json({ message: "Failed to skip tutorial" });
    }
  });

  app.get("/api/tutorials/check/:featureId", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { featureId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const shouldShow = await tutorialStorage.shouldShowTutorial(userId, featureId);
      const tutorial = shouldShow ? await tutorialStorage.getTutorialById(featureId) : null;

      res.json({ shouldShow, tutorial });
    } catch (error: any) {
      console.error("Error checking tutorial:", error);
      res.status(500).json({ message: "Failed to check tutorial" });
    }
  });
}
