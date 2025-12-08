import { hashPassword } from "../server/auth";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = "test@example.com";
  const plaintext = "Test1234!";

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    console.log(`User ${email} already exists. Skipping insert.`);
    return;
  }

  const password = await hashPassword(plaintext);
  await db.insert(users).values({
    email,
    password,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`Seeded user ${email} with password ${plaintext}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
