import { hashPassword } from "../server/auth";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.env.E2E_EMAIL || process.env.MASTER_ADMIN_EMAIL;
  const plaintext = process.env.E2E_PASSWORD || process.env.MASTER_ADMIN_PASSWORD;

  if (!email || !plaintext) {
    console.log("[seed-e2e-user] E2E_EMAIL/E2E_PASSWORD (or MASTER_ADMIN_*) not set; skipping seed.");
    return;
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length) {
    console.log(`[seed-e2e-user] User ${email} already exists. Skipping insert.`);
    return;
  }

  const password = await hashPassword(plaintext);
  await db.insert(users).values({
    email,
    password,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`[seed-e2e-user] Seeded user ${email} for E2E login.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-e2e-user] Failed to seed E2E user:", err);
    process.exit(1);
  });
