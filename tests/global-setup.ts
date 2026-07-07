import { request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:5000";

  const email = process.env.E2E_EMAIL || process.env.MASTER_ADMIN_EMAIL;
  const password = process.env.E2E_PASSWORD || process.env.MASTER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing auth creds for E2E. Set E2E_EMAIL + E2E_PASSWORD (or MASTER_ADMIN_EMAIL + MASTER_ADMIN_PASSWORD)."
    );
  }

  const authDir = path.resolve(process.cwd(), "tests/.auth");
  fs.mkdirSync(authDir, { recursive: true });

  const ctx = await request.newContext({ baseURL, timeout: 90_000 });

  let lastFailure = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const resp = await ctx.post("/api/auth/login", {
        data: { email, password },
        headers: { "Content-Type": "application/json" },
        timeout: 90_000,
      });

      if (resp.ok()) {
        await ctx.storageState({ path: path.join(authDir, "storageState.json") });
        await ctx.dispose();
        return;
      }

      const body = await resp.text();
      lastFailure = `${resp.status()} ${resp.statusText()} :: ${body}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }

  await ctx.dispose();
  throw new Error(`E2E login failed after retries: ${lastFailure}`);
}
