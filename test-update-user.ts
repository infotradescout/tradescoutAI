import 'dotenv/config';
import { storage } from './server/storage';
import { hashPassword } from './server/auth';

async function test() {
  try {
    console.log('[TEST] Starting...');
    
    // Get test user
    console.log('[TEST] Getting test user...');
    const user = await storage.getUserByEmail('test@example.com');
    console.log('[TEST] Found user:', { id: user?.id, email: user?.email });
    
    if (!user) {
      console.log('[TEST] User not found!');
      process.exit(1);
    }
    
    // Hash new password
    console.log('[TEST] Hashing new password...');
    const newHash = await hashPassword('UpdatedPass123!');
    console.log('[TEST] Hash created:', newHash.substring(0, 20) + '...');
    
    // Update user
    console.log('[TEST] Updating user password...');
    const updated = await storage.updateUser(user.id, {
      password: newHash,
      updatedAt: new Date(),
    });
    
    console.log('[TEST] Update successful!', { id: updated?.id, email: updated?.email });
    console.log('[TEST] PASS');
    process.exit(0);
  } catch (error) {
    console.error('[TEST] FAIL:', error);
    process.exit(1);
  }
}

test();
