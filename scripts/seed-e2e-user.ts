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
    console.log(`[seed-e2e-user] User ${email} already exists. Updating profile data...`);
    await db.update(users)
      .set({
        businessSlug: 'test-business',
        role: 'business_owner',
        preferences: {
          provisional: {
            profileDraft: {
              businessName: 'Test Business',
              description: 'We are a test business serving the community.',
              countyFips: '12345',
              countyName: 'Test County',
              stateCode: 'TS',
              city: 'Test City',
              website: 'https://example.com',
              serviceAreas: [{ countyFips: '12345' }]
            }
          }
        }
      })
      .where(eq(users.email, email));
    console.log(`[seed-e2e-user] Updated user ${email} with business profile 'test-business'.`);
    return;
  }

  const password = await hashPassword(plaintext);
  
  // Create user with business profile data for E2E tests
  await db.insert(users).values({
    email,
    password,
    businessSlug: 'test-business',
    firstName: 'Test',
    lastName: 'Business',
    role: 'business_owner',
    preferences: {
      provisional: {
        profileDraft: {
          businessName: 'Test Business',
          description: 'We are a test business serving the community.',
          countyFips: '12345',
          countyName: 'Test County',
          stateCode: 'TS',
          city: 'Test City',
          website: 'https://example.com',
          serviceAreas: [{ countyFips: '12345' }]
        }
      }
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`[seed-e2e-user] Seeded user ${email} for E2E login with business profile 'test-business'.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-e2e-user] Failed to seed E2E user:", err);
    process.exit(1);
  });
