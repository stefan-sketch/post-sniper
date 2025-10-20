/**
 * Test script to verify Post Sniper endpoints
 * Run with: tsx test-endpoints.ts
 */

import { appRouter } from './server/routers';

async function testEndpoints() {
  console.log('🧪 Testing Post Sniper Endpoints\n');

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
    // Test 1: Get user settings (should return undefined for new user)
    console.log('✅ Test 1: Get user settings');
    const settings = await caller.settings.get();
    console.log('   Settings:', settings || 'No settings yet');

    // Test 2: List monitored pages (should return empty array)
    console.log('\n✅ Test 2: List monitored pages');
    const pages = await caller.pages.list();
    console.log('   Pages count:', pages.length);

    // Test 3: List alerts (should return empty array)
    console.log('\n✅ Test 3: List alerts');
    const alerts = await caller.alerts.list();
    console.log('   Alerts count:', alerts.length);

    // Test 4: Get unread alert count
    console.log('\n✅ Test 4: Get unread alert count');
    const unreadCount = await caller.alerts.unreadCount();
    console.log('   Unread alerts:', unreadCount);

    console.log('\n✨ All endpoint tests passed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure your Fanpage Karma API token in Settings');
    console.log('   2. Add Facebook pages to monitor');
    console.log('   3. Press Play to start monitoring');
    console.log('   4. Posts will auto-refresh every 10 minutes');
    console.log('   5. Alerts will trigger when posts exceed thresholds');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testEndpoints();

