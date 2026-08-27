import type { Express } from "express";
import { isAuthenticated } from "../../auth";
import { aiCodeFixingService } from "../../ai-code-fixes";

interface UIIssue {
  id: string;
  type: "bug" | "ux_issue" | "performance" | "accessibility" | "layout";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  element?: string;
  location: string;
  timestamp: Date;
  userAgent: string;
  suggestions: string[];
  status?: "new" | "investigating" | "resolved" | "ignored";
}

interface UIIssuesStore {
  issues: UIIssue[];
  stats: {
    totalIssues: number;
    resolvedIssues: number;
    criticalIssues: number;
    lastAnalysis: Date;
  };
}

// In-memory store for demo - in production, use database
const uiIssuesStore: UIIssuesStore = {
  issues: [],
  stats: {
    totalIssues: 0,
    resolvedIssues: 0,
    criticalIssues: 0,
    lastAnalysis: new Date(),
  },
};

const UI_MONITORING_ALLOWED_ROLES = new Set(["super_admin", "ops_admin"]);

function normalizeRole(role: unknown): string {
  const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!raw) return "";
  if (raw === "owner" || raw === "head_admin") return "super_admin";
  return raw;
}

function canAccessUIMonitoring(user: any): boolean {
  if (!user) return false;

  const primaryRole = normalizeRole(user.role);
  const activeRole = normalizeRole(user.activeRole);
  const roles = Array.isArray(user.roles) ? user.roles.map((r: any) => normalizeRole(r)) : [];

  return (
    UI_MONITORING_ALLOWED_ROLES.has(primaryRole) ||
    UI_MONITORING_ALLOWED_ROLES.has(activeRole) ||
    roles.some((r: string) => UI_MONITORING_ALLOWED_ROLES.has(r))
  );
}

export function registerUIIssuesRoutes(app: Express) {
  // Get all UI issues and stats
  app.get("/api/admin/ui-issues", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      // Only allow admin users to access UI monitoring
      if (!canAccessUIMonitoring(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Calculate stats
      const totalIssues = uiIssuesStore.issues.length;
      const resolvedIssues = uiIssuesStore.issues.filter(
        (issue) => issue.status === "resolved"
      ).length;
      const criticalIssues = uiIssuesStore.issues.filter(
        (issue) => issue.severity === "critical"
      ).length;

      // Group issues by type and severity
      const byType: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const byStatus: Record<string, number> = {};

      uiIssuesStore.issues.forEach((issue) => {
        byType[issue.type] = (byType[issue.type] || 0) + 1;
        bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
        byStatus[issue.status || "new"] = (byStatus[issue.status || "new"] || 0) + 1;
      });

      const response = {
        issues: uiIssuesStore.issues.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
        stats: {
          totalIssues,
          resolvedIssues,
          criticalIssues,
          lastAnalysis: new Date(),
        },
        summary: {
          total: totalIssues,
          byType,
          bySeverity,
          byStatus,
        },
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching UI issues:", error);
      res.status(500).json({ message: "Failed to fetch UI issues" });
    }
  });

  // Submit new UI issues from client-side monitoring
  app.post("/api/admin/ui-issues", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      // Only allow admin users to submit issues
      if (!canAccessUIMonitoring(user)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { issues } = (req.body ?? {}) as any;

      if (!Array.isArray(issues)) {
        return res.status(400).json({ message: "Issues must be an array" });
      }

      // Process and store new issues
      const newIssues = issues.map((issue) => ({
        ...issue,
        id: issue.id || `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(issue.timestamp || new Date()),
        status: issue.status || "new",
      }));

      // Add to store (avoid duplicates)
      newIssues.forEach((newIssue) => {
        const existingIssue = uiIssuesStore.issues.find(
          (existing) =>
            existing.title === newIssue.title &&
            existing.location === newIssue.location &&
            Math.abs(
              new Date(existing.timestamp).getTime() - new Date(newIssue.timestamp).getTime()
            ) < 60000
        );

        if (!existingIssue) {
          uiIssuesStore.issues.push(newIssue);
        }
      });

      // Update stats
      uiIssuesStore.stats.lastAnalysis = new Date();
      uiIssuesStore.stats.totalIssues = uiIssuesStore.issues.length;
      uiIssuesStore.stats.resolvedIssues = uiIssuesStore.issues.filter(
        (issue) => issue.status === "resolved"
      ).length;
      uiIssuesStore.stats.criticalIssues = uiIssuesStore.issues.filter(
        (issue) => issue.severity === "critical"
      ).length;

      console.log(`📊 AI Monitoring: Received ${newIssues.length} new issues`);

      // Auto-analyze new issues for potential fixes
      for (const issue of process.env.NODE_ENV === "production" ? [] : newIssues) {
        if (issue.severity === "high" || issue.severity === "critical") {
          try {
            const fix = await aiCodeFixingService.analyzeAndFixIssue(
              issue.description,
              issue.location
            );
            if (fix && fix.confidence >= 0.9) {
              console.log(`🤖 AI Generated High-Confidence Fix: ${fix.description}`);
              // Auto-apply critical fixes with very high confidence
              if (issue.severity === "critical" && fix.confidence >= 0.95) {
                setTimeout(() => aiCodeFixingService.applyFix(fix.id), 2000);
                console.log(`🚀 Auto-Applied Critical Fix: ${fix.description}`);
              }
            }
          } catch (error) {
            console.error(`AI Fix Analysis Error for issue ${issue.id}:`, error);
          }
        }
      }

      res.json({
        message: "Issues received successfully",
        count: newIssues.length,
        total: uiIssuesStore.issues.length,
      });
    } catch (error) {
      console.error("Error storing UI issues:", error);
      res.status(500).json({ message: "Failed to store UI issues" });
    }
  });

  // Update issue status
  app.patch("/api/admin/ui-issues/:issueId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      if (!canAccessUIMonitoring(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { issueId } = req.params;
      const { status } = (req.body ?? {}) as any;

      const issue = uiIssuesStore.issues.find((issue) => issue.id === issueId);

      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }

      issue.status = status;

      // Update stats
      uiIssuesStore.stats.resolvedIssues = uiIssuesStore.issues.filter(
        (issue) => issue.status === "resolved"
      ).length;

      res.json({ message: "Issue updated successfully", issue });
    } catch (error) {
      console.error("Error updating UI issue:", error);
      res.status(500).json({ message: "Failed to update UI issue" });
    }
  });

  // Delete issue
  app.delete("/api/admin/ui-issues/:issueId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      if (!canAccessUIMonitoring(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { issueId } = req.params;

      const issueIndex = uiIssuesStore.issues.findIndex((issue) => issue.id === issueId);

      if (issueIndex === -1) {
        return res.status(404).json({ message: "Issue not found" });
      }

      uiIssuesStore.issues.splice(issueIndex, 1);

      // Update stats
      uiIssuesStore.stats.totalIssues = uiIssuesStore.issues.length;
      uiIssuesStore.stats.resolvedIssues = uiIssuesStore.issues.filter(
        (issue) => issue.status === "resolved"
      ).length;
      uiIssuesStore.stats.criticalIssues = uiIssuesStore.issues.filter(
        (issue) => issue.severity === "critical"
      ).length;

      res.json({ message: "Issue deleted successfully" });
    } catch (error) {
      console.error("Error deleting UI issue:", error);
      res.status(500).json({ message: "Failed to delete UI issue" });
    }
  });

  // Get AI analysis and recommendations
  app.get("/api/admin/ui-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      if (!canAccessUIMonitoring(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const issues = uiIssuesStore.issues;
      const totalIssues = issues.length;
      const resolvedIssues = issues.filter((issue) => issue.status === "resolved").length;
      const criticalIssues = issues.filter((issue) => issue.severity === "critical").length;
      const unresolvedIssues = totalIssues - resolvedIssues;

      // Calculate resolution rate
      const resolutionRate =
        totalIssues > 0 ? ((resolvedIssues / totalIssues) * 100).toFixed(1) : "0";

      // Analyze patterns
      const pageIssues: Record<string, number> = {};
      const typeCount: Record<string, number> = {};
      const elementIssues: Record<string, number> = {};

      issues.forEach((issue) => {
        // Count issues per page
        pageIssues[issue.location] = (pageIssues[issue.location] || 0) + 1;

        // Count by type
        typeCount[issue.type] = (typeCount[issue.type] || 0) + 1;

        // Count by element
        if (issue.element) {
          elementIssues[issue.element] = (elementIssues[issue.element] || 0) + 1;
        }
      });

      // Get top problematic pages
      const topProblematicPages = Object.entries(pageIssues)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([page, count]) => ({ page, issueCount: count }));

      // Get common problematic elements
      const commonElements = Object.entries(elementIssues)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([element, count]) => ({ element, issueCount: count }));

      // Generate priorities
      const priorities: Array<{
        level: string;
        title: string;
        description: string;
        action: string;
      }> = [];

      if (criticalIssues > 0) {
        priorities.push({
          level: "critical",
          title: "Critical Issues Need Immediate Attention",
          description: `${criticalIssues} critical issues detected that may impact user experience`,
          action: "Review and fix critical issues first",
        });
      }

      if (unresolvedIssues > 10) {
        priorities.push({
          level: "high",
          title: "High Volume of Unresolved Issues",
          description: `${unresolvedIssues} issues remain unresolved`,
          action: "Prioritize issue resolution workflow",
        });
      }

      if (typeCount.accessibility > 0) {
        priorities.push({
          level: "medium",
          title: "Accessibility Improvements Needed",
          description: `${typeCount.accessibility} accessibility issues found`,
          action: "Improve site accessibility for all users",
        });
      }

      // Generate recommendations
      const recommendations = [
        "Regularly monitor and address critical issues to maintain user experience",
        "Implement automated testing to catch issues before they reach users",
        "Focus on the most problematic pages to maximize impact",
        "Set up alerts for critical and high-severity issues",
        "Review accessibility standards compliance regularly",
      ];

      // Add specific recommendations based on patterns
      if (typeCount.performance > 0) {
        recommendations.push("Optimize page load times and JavaScript performance");
      }

      if (typeCount.ux_issue > 0) {
        recommendations.push("Conduct user testing to identify UX pain points");
      }

      if (topProblematicPages.length > 0) {
        recommendations.push(
          `Focus attention on ${topProblematicPages[0].page} which has the most issues`
        );
      }

      const analysis = {
        summary: {
          totalIssues,
          criticalIssues,
          unresolvedIssues,
          resolutionRate,
        },
        patterns: {
          topProblematicPages,
          commonIssueTypes: typeCount,
          commonElements,
        },
        priorities,
        recommendations,
      };

      res.json(analysis);
    } catch (error) {
      console.error("Error generating UI analysis:", error);
      res.status(500).json({ message: "Failed to generate analysis" });
    }
  });
}
