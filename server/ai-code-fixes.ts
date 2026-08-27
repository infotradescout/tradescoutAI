import { Express } from "express";
import { isAuthenticated } from "./auth";
import * as fs from "fs/promises";
import * as path from "path";

interface CodeFix {
  id: string;
  issueId: string;
  description: string;
  filePath: string;
  originalCode: string;
  fixedCode: string;
  confidence: number;
  status: "pending" | "applied" | "failed" | "rejected";
  timestamp: Date;
  aiReasoning: string;
}

interface AutoFixRule {
  pattern: RegExp;
  fix: (match: string, filePath: string) => string | Promise<string>;
  description: string;
  confidence: number;
}

class AICodeFixingService {
  private fixes: CodeFix[] = [];
  private autoFixRules: AutoFixRule[] = [
    {
      pattern: /A <Select\.Item \/> must have a value prop that is not an empty string/,
      fix: (match, filePath) => this.fixSelectItemEmptyValue(filePath),
      description: "Fix Select.Item empty value prop",
      confidence: 0.95,
    },
    {
      pattern: /Cannot read properties of null \(reading 'useContext'\)/,
      fix: (match, filePath) => this.fixReactHookNullContext(filePath),
      description: "Fix React hook null context issues",
      confidence: 0.85,
    },
    {
      pattern:
        /Invalid hook call\. Hooks can only be called inside of the body of a function component/,
      fix: (match, filePath) => this.fixInvalidHookCall(filePath),
      description: "Fix invalid React hook calls",
      confidence: 0.9,
    },
    {
      pattern: /Failed to fetch/,
      fix: (match, filePath) => this.addErrorHandlingToFetch(filePath),
      description: "Add proper error handling to fetch calls",
      confidence: 0.8,
    },
  ];

  async analyzeAndFixIssue(issueDescription: string, location: string): Promise<CodeFix | null> {
    for (const rule of this.autoFixRules) {
      if (rule.pattern.test(issueDescription)) {
        try {
          const filePath = this.inferFilePathFromLocation(location, issueDescription);
          if (!filePath) continue;

          const originalCode = await this.readFile(filePath);
          const fixedCode = await Promise.resolve(rule.fix(issueDescription, filePath));

          if (fixedCode && fixedCode !== originalCode) {
            const fix: CodeFix = {
              id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              issueId: this.extractIssueId(issueDescription),
              description: rule.description,
              filePath,
              originalCode,
              fixedCode,
              confidence: rule.confidence,
              status: "pending",
              timestamp: new Date(),
              aiReasoning: this.generateReasoning(rule, issueDescription),
            };

            this.fixes.push(fix);
            return fix;
          }
        } catch (error) {
          console.error(`AI Code Fix Error for ${rule.description}:`, error);
        }
      }
    }
    return null;
  }

  private async fixSelectItemEmptyValue(filePath: string): Promise<string> {
    const code = await this.readFile(filePath);

    // Fix empty SelectItem values
    const fixed = code
      .replace(/<SelectItem\s+value=""\s*>/g, '<SelectItem value="placeholder" disabled>')
      .replace(/<SelectItem\s+value={""}\s*>/g, '<SelectItem value="placeholder" disabled>')
      .replace(/<SelectItem(?!\s+value)/g, '<SelectItem value="auto-generated-value"');

    return fixed;
  }

  private async fixReactHookNullContext(filePath: string): Promise<string> {
    const code = await this.readFile(filePath);

    // Add null checks for React context usage
    const fixed = code
      .replace(/const\s+(\w+)\s+=\s+useContext\((\w+)\)/g, "const $1 = useContext($2) || {}")
      .replace(
        /const\s+\{([^}]+)\}\s+=\s+useContext\((\w+)\)/g,
        "const context = useContext($2); const {$1} = context || {}"
      );

    // Add safety imports if needed
    if (fixed.includes("useContext") && !code.includes("useContext")) {
      return `import { useContext } from 'react';\n${fixed}`;
    }

    return fixed;
  }

  private async fixInvalidHookCall(filePath: string): Promise<string> {
    const code = await this.readFile(filePath);

    // Move hooks to component body if they're in wrong places
    const fixed = code.replace(
      /(\w+)\s*=>\s*\{([^}]*)(use\w+\([^)]*\))/g,
      "$1 => {\n  const hookResult = $3;\n$2"
    );

    return fixed;
  }

  private async addErrorHandlingToFetch(filePath: string): Promise<string> {
    const code = await this.readFile(filePath);

    // Add try-catch to fetch calls
    const fixed = code
      .replace(
        /fetch\(([^)]+)\)(?!\.catch)/g,
        'fetch($1).catch(error => { console.error("Fetch error:", error); throw error; })'
      )
      .replace(
        /await\s+fetch\(([^)]+)\)(?!\s*\.catch)/g,
        'await fetch($1).catch(error => { console.error("Fetch error:", error); throw error; })'
      );

    return fixed;
  }

  private inferFilePathFromLocation(location: string, description: string): string | null {
    // Extract file path from error description
    const filePathMatch = description.match(/at\s+([^:]+\.tsx?)/);
    if (filePathMatch) {
      return filePathMatch[1].replace(/.*\/workspace\//, "");
    }

    // Fallback based on common patterns
    if (description.includes("Select.Item")) {
      return "client/src/components/ui/select.tsx";
    }
    if (description.includes("AddressVerificationBanner")) {
      return "client/src/components/AddressVerificationBanner.tsx";
    }
    if (description.includes("BugReportButton")) {
      return "client/src/components/BugReportButton.tsx";
    }

    return null;
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  private extractIssueId(description: string): string {
    const match = description.match(/issue-[\w-]+/);
    return match ? match[0] : `unknown-${Date.now()}`;
  }

  private generateReasoning(rule: AutoFixRule, issue: string): string {
    return `Applied automated fix for: ${rule.description}. 
    Issue pattern matched: ${rule.pattern.source}
    Confidence level: ${(rule.confidence * 100).toFixed(1)}%
    Issue details: ${issue.substring(0, 200)}...`;
  }

  async applyFix(fixId: string): Promise<boolean> {
    const fix = this.fixes.find((f) => f.id === fixId);
    if (!fix || fix.status !== "pending") {
      return false;
    }

    try {
      // Create backup
      const backupPath = `${fix.filePath}.backup.${Date.now()}`;
      await fs.copyFile(fix.filePath, backupPath);

      // Apply fix
      await fs.writeFile(fix.filePath, fix.fixedCode, "utf-8");

      fix.status = "applied";
      console.log(`✅ AI Auto-Fix Applied: ${fix.description} in ${fix.filePath}`);

      return true;
    } catch (error) {
      fix.status = "failed";
      console.error(`❌ AI Auto-Fix Failed: ${fix.description}`, error);
      return false;
    }
  }

  getFixes(): CodeFix[] {
    return [...this.fixes];
  }

  async autoApplyHighConfidenceFixes(): Promise<void> {
    const highConfidenceFixes = this.fixes.filter(
      (fix) => fix.status === "pending" && fix.confidence >= 0.9
    );

    for (const fix of highConfidenceFixes) {
      await this.applyFix(fix.id);
    }
  }
}

export const aiCodeFixingService = new AICodeFixingService();

const AI_FIX_ALLOWED_ROLES = new Set(["super_admin", "ops_admin"]);

function normalizeRole(role: unknown): string {
  const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!raw) return "";
  if (raw === "owner" || raw === "head_admin") return "super_admin";
  return raw;
}

function canAccessAICodeFixes(user: any): boolean {
  if (!user) return false;

  const primaryRole = normalizeRole(user.role);
  const activeRole = normalizeRole(user.activeRole);
  const roles = Array.isArray(user.roles) ? user.roles.map((r: any) => normalizeRole(r)) : [];

  return (
    AI_FIX_ALLOWED_ROLES.has(primaryRole) ||
    AI_FIX_ALLOWED_ROLES.has(activeRole) ||
    roles.some((r: string) => AI_FIX_ALLOWED_ROLES.has(r))
  );
}

function sourceMutationUnavailableInProduction(res: any): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  res.status(410).json({
    message:
      "Runtime source mutation is unavailable in production; submit the issue for the normal reviewed release workflow.",
    code: "RUNTIME_SOURCE_MUTATION_DISABLED",
  });
  return true;
}

export function registerAICodeFixRoutes(app: Express) {
  // Auto-analyze and potentially fix new issues
  app.post("/api/ai/analyze-issue", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      if (!canAccessAICodeFixes(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      if (sourceMutationUnavailableInProduction(res)) return;

      const { issueDescription, location } = (req.body ?? {}) as any;

      const fix = await aiCodeFixingService.analyzeAndFixIssue(issueDescription, location);

      if (fix) {
        res.json({
          message: "AI fix generated",
          fix,
          autoApplied: fix.confidence >= 0.95,
        });

        // Auto-apply very high confidence fixes
        if (fix.confidence >= 0.95) {
          setTimeout(() => aiCodeFixingService.applyFix(fix.id), 1000);
        }
      } else {
        res.json({ message: "No automated fix available for this issue" });
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      res.status(500).json({ message: "Failed to analyze issue" });
    }
  });

  // Get all pending fixes
  app.get("/api/ai/fixes", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      if (!canAccessAICodeFixes(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      if (sourceMutationUnavailableInProduction(res)) return;

      const fixes = aiCodeFixingService.getFixes();
      res.json({ fixes });
    } catch (error) {
      console.error("Error fetching fixes:", error);
      res.status(500).json({ message: "Failed to fetch fixes" });
    }
  });

  // Apply a specific fix
  app.post("/api/ai/apply-fix/:fixId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      if (!canAccessAICodeFixes(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      if (sourceMutationUnavailableInProduction(res)) return;

      const { fixId } = req.params;
      const success = await aiCodeFixingService.applyFix(fixId);

      res.json({
        success,
        message: success ? "Fix applied successfully" : "Failed to apply fix",
      });
    } catch (error) {
      console.error("Error applying fix:", error);
      res.status(500).json({ message: "Failed to apply fix" });
    }
  });

  // Auto-apply all high confidence fixes
  app.post("/api/ai/auto-fix", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      if (!canAccessAICodeFixes(user)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      if (sourceMutationUnavailableInProduction(res)) return;

      await aiCodeFixingService.autoApplyHighConfidenceFixes();

      res.json({ message: "High confidence fixes applied automatically" });
    } catch (error) {
      console.error("Auto-fix error:", error);
      res.status(500).json({ message: "Failed to auto-apply fixes" });
    }
  });
}
