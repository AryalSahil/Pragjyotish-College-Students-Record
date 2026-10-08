import { db } from './index.ts';
import { settings, activityLogs } from './schema.ts';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Seeding database...');
  try {
    // Check if settings exist
    const existingSettings = await db.select().from(settings).where(eq(settings.id, 1));
    
    if (existingSettings.length === 0) {
      console.log('No existing settings found. Initializing with default config...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await db.insert(settings).values({
        id: 1,
        collegeName: 'Pragjyotish College',
        departmentName: 'Department of Computer Application (BCA)',
        publicSearchEnabled: true,
        emailVisibleToPublic: false,
        mobileVisibleToPublic: false,
        adminPasswordHash: hashedPassword,
        timezone: 'Asia/Kolkata',
        maintenanceMode: false,
        maintenanceMessage: 'We are currently updating the student records system. Please check back later.',
      });
      
      await db.insert(activityLogs).values({
        adminEmail: 'system',
        action: 'Settings Created',
        details: 'System settings initialized with default administrator credentials (password: admin123).',
      });
      
      console.log('Seed completed successfully!');
    } else {
      console.log('Settings already initialized. Skipping seed.');
    }
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(1);
  }
}

seed().then(() => process.exit(0));
