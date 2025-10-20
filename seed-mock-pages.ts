/**
 * Seed script to add default mock pages for testing
 * Run with: tsx seed-mock-pages.ts
 */

import { appRouter } from './server/routers';

async function seedMockPages() {
  console.log('🌱 Seeding mock pages for testing\n');

  // Create a mock context for testing
  const mockContext = {
    user: {
      id: 'test-user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user' as const,
    },
    req: {} as any,
    res: {} as any,
  };

  const caller = appRouter.createCaller(mockContext);

  try {
    // Check if pages already exist
    const existingPages = await caller.pages.list();
    if (existingPages.length > 0) {
      console.log('✅ Mock pages already exist. Skipping seed.');
      console.log(`   Found ${existingPages.length} pages`);
      return;
    }

    // Create sample pages with different colors
    const mockPages = [
      {
        profileId: 'tech-news-daily',
        profileName: 'Tech News Daily',
        profilePicture: 'https://api.dicebear.com/7.x/initials/svg?seed=TN&backgroundColor=22d3ee',
        borderColor: '#22d3ee', // cyan
        network: 'facebook',
        alertThreshold: 150,
        alertEnabled: true,
      },
      {
        profileId: 'social-media-tips',
        profileName: 'Social Media Tips',
        profilePicture: 'https://api.dicebear.com/7.x/initials/svg?seed=SM&backgroundColor=a855f7',
        borderColor: '#a855f7', // purple
        network: 'facebook',
        alertThreshold: 200,
        alertEnabled: true,
      },
      {
        profileId: 'marketing-insights',
        profileName: 'Marketing Insights',
        profilePicture: 'https://api.dicebear.com/7.x/initials/svg?seed=MI&backgroundColor=ec4899',
        borderColor: '#ec4899', // pink
        network: 'facebook',
        alertThreshold: 100,
        alertEnabled: true,
      },
      {
        profileId: 'business-growth',
        profileName: 'Business Growth',
        profilePicture: 'https://api.dicebear.com/7.x/initials/svg?seed=BG&backgroundColor=10b981',
        borderColor: '#10b981', // green
        network: 'facebook',
        alertThreshold: 180,
        alertEnabled: true,
      },
    ];

    console.log('Creating mock pages...\n');
    for (const page of mockPages) {
      await caller.pages.create(page);
      console.log(`✅ Created: ${page.profileName} (${page.borderColor})`);
    }

    console.log('\n✨ Mock pages seeded successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Open the app and click Play ▶️');
    console.log('   2. Watch as mock posts populate the columns');
    console.log('   3. Posts will auto-refresh every 10 minutes');
    console.log('   4. Alerts will trigger when posts exceed thresholds');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedMockPages();

