import { pool } from "./db";
import { z } from "zod";

const DISABLED_ROUTES_MODES = new Set(["simple", "routes-simple"]);

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST_WORKER_ID);
}

function formatZodError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path?.length ? issue.path.join(".") : "env";
    return `- ${path}: ${issue.message}`;
  });
  return lines.join("\n");
}

function validateStartupEnv(): void {
  const isProd = process.env.NODE_ENV === "production";

  const EnvSchema = z
    .object({
      NODE_ENV: z.string().optional(),
      ROUTES_MODE: z.string().optional(),

      DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required."),
      TEST_DATABASE_URL: z.string().trim().optional(),

      SESSION_SECRET: z.string().trim().optional(),

      PUBLIC_WEB_URL: z.string().trim().url().optional(),
      APP_URL: z.string().trim().url().optional(),

      GOOGLE_CALLBACK_URL: z.string().trim().url().optional(),
      FACEBOOK_CALLBACK_URL: z.string().trim().url().optional(),

      CORS_ALLOWED_ORIGINS: z.string().optional(),

      // Optional integrations (validated only for presence/shape when provided)
      STRIPE_SECRET_KEY: z.string().trim().optional(),
      STRIPE_WEBHOOK_SECRET: z.string().trim().optional(),
      SENTRY_DSN: z.string().trim().optional(),
      GOOGLE_MAPS_API_KEY: z.string().trim().optional(),
      GOOGLE_SOLAR_API_KEY: z.string().trim().optional(),
      PRINTFUL_API_KEY: z.string().trim().optional(),

      FEATURE_SOLAR_V1: z.string().trim().optional(),
      FEATURE_SOLAR_GOOGLE_PROVIDER: z.string().trim().optional(),
      SOLAR_DEFAULT_COST_PER_WATT_USD: z.string().trim().optional(),
      SOLAR_DEFAULT_ELECTRIC_RATE_USD: z.string().trim().optional(),

      VAPID_PUBLIC_KEY: z.string().trim().optional(),
      VAPID_PRIVATE_KEY: z.string().trim().optional(),
      VAPID_SUBJECT: z.string().trim().optional(),
    })
    .passthrough();

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    // Always fatal: missing DATABASE_URL (and any malformed URLs listed above).
    throw new Error(`Invalid environment configuration:\n${formatZodError(result.error)}`);
  }

  if (isProd) {
    const sessionSecret = String(process.env.SESSION_SECRET || "").trim();
    if (!sessionSecret) {
      throw new Error("SESSION_SECRET is required in production.");
    }
  }

  // Non-fatal consistency checks for optional bundles.
  const vapid = {
    public: String(process.env.VAPID_PUBLIC_KEY || "").trim(),
    private: String(process.env.VAPID_PRIVATE_KEY || "").trim(),
    subject: String(process.env.VAPID_SUBJECT || "").trim(),
  };
  const anyVapid = Boolean(vapid.public || vapid.private || vapid.subject);
  const allVapid = Boolean(vapid.public && vapid.private && vapid.subject);
  if (anyVapid && !allVapid) {
    console.warn(
      "[Startup] VAPID_* env vars are partially configured. Web push will remain disabled until all three are set."
    );
  }
}

export async function assertStartupInvariants(): Promise<void> {
  if (isTestRuntime()) return;

  validateStartupEnv();

  const routesMode = String(process.env.ROUTES_MODE || "full")
    .trim()
    .toLowerCase();
  if (DISABLED_ROUTES_MODES.has(routesMode)) {
    throw new Error(
      `ROUTES_MODE=${routesMode} is disabled for this server. Full routes are required.`
    );
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required at startup.");
  }

  await pool.query("select 1");
}
