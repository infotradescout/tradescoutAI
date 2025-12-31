import 'dotenv/config';
import { storage } from './server/storage';

async function setAdminRole() {
  const email = 'info.tradescout@gmail.com';
  
  console.log(`🔍 Looking for user: ${email}`);
  
  const user = await storage.getUserByEmail(email);
  
  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }
  
  console.log(`✅ Found user: ${user.email}`);
  console.log(`   Current role: ${user.role}`);
  
  await storage.updateUser(user.id, {
    role: 'super_admin',
    updatedAt: new Date(),
  });
  
  console.log(`✅ Updated ${email} to super_admin`);
  console.log('   Refresh your browser to see admin controls');
  
  process.exit(0);
}

setAdminRole().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
