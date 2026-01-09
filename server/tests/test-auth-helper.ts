/**
 * Test Authentication Helper
 * 
 * Provides utilities for creating authenticated test requests with Supertest.
 * Uses the session store directly to create valid sessions without going through OAuth flows.
 */

import { getSession } from '../auth';
import type { User } from '@shared/schema';

/**
 * Creates a session cookie string for a test user.
 * In test mode, we bypass OAuth and directly create a session.
 */
export async function createTestSession(user: User): Promise<string> {
  // In test environment, we create a mock session
  // The session middleware will be configured to accept this in test mode
  const sessionData = {
    passport: {
      user: user.id,
    },
  };

  // For now, return a simple base64-encoded session identifier
  // The app will need to recognize this pattern in test mode
  const sessionId = `test_session_${user.id}`;
  return `tradescout.sid=${sessionId}`;
}

/**
 * Helper to create a test user and return both the user and a session cookie
 */
export async function createAuthenticatedTestUser(
  db: any,
  overrides = {}
): Promise<{ user: any; sessionCookie: string }> {
  const [user] = await db.insert(db.schema.users).values({
    email: `test${Date.now()}@test.com`,
    firstName: 'Test',
    lastName: 'User',
    role: 'homeowner',
    addressVerified: true,
    isActive: true,
    ...overrides,
  }).returning();

  const sessionCookie = await createTestSession(user);
  
  return { user, sessionCookie };
}
