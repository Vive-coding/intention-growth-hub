// Test script to verify the timezone fix
import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Test the fixed getUserTodayWindow function
async function testFixedTimezoneCalculation(userId) {
  try {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const tz = rows[0]?.timezone || 'UTC';
    
    const now = new Date();
    console.log('=== FIXED TIMEZONE CALCULATION ===');
    console.log('User timezone:', tz);
    console.log('Server time (UTC):', now.toISOString());
    
    // Get the current date in the user's timezone
    const userLocalDate = new Date(now.toLocaleString("en-CA", { timeZone: tz }));
    const year = userLocalDate.getFullYear();
    const month = userLocalDate.getMonth();
    const day = userLocalDate.getDate();
    
    console.log('User local date:', { year, month: month + 1, day });
    
    // Create start and end of day in user's timezone
    const startOfDayLocal = new Date(year, month, day, 0, 0, 0, 0);
    const endOfDayLocal = new Date(year, month, day, 23, 59, 59, 999);
    
    console.log('Start/End of day (user local):', {
      start: startOfDayLocal.toISOString(),
      end: endOfDayLocal.toISOString()
    });
    
    // Convert to UTC using the fixed method
    const startUTC = new Date(startOfDayLocal.toLocaleString("en-CA", { timeZone: "UTC" }));
    const endUTC = new Date(endOfDayLocal.toLocaleString("en-CA", { timeZone: "UTC" }));
    
    console.log('FIXED - Start UTC:', startUTC.toISOString());
    console.log('FIXED - End UTC:', endUTC.toISOString());
    
    // Test with a completion time (e.g., 8pm user time)
    const testCompletionTime = new Date(year, month, day, 20, 0, 0, 0); // 8pm user time
    const testCompletionUTC = new Date(testCompletionTime.toLocaleString("en-CA", { timeZone: "UTC" }));
    
    console.log('\n=== TEST COMPLETION TIME ===');
    console.log('Test completion (8pm user time):', testCompletionTime.toISOString());
    console.log('Test completion (UTC):', testCompletionUTC.toISOString());
    console.log('Is in today window?', startUTC <= testCompletionUTC && testCompletionUTC < endUTC);
    
    return { start: startUTC, end: endUTC };
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

// Test with different timezones
async function testMultipleTimezones() {
  console.log('=== TESTING MULTIPLE TIMEZONES ===');
  
  const testTimezones = ['America/Toronto', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];
  
  for (const tz of testTimezones) {
    console.log(`\n--- Testing ${tz} ---`);
    
    const now = new Date();
    const userLocalDate = new Date(now.toLocaleString("en-CA", { timeZone: tz }));
    const year = userLocalDate.getFullYear();
    const month = userLocalDate.getMonth();
    const day = userLocalDate.getDate();
    
    const startOfDayLocal = new Date(year, month, day, 0, 0, 0, 0);
    const endOfDayLocal = new Date(year, month, day, 23, 59, 59, 999);
    
    const startUTC = new Date(startOfDayLocal.toLocaleString("en-CA", { timeZone: "UTC" }));
    const endUTC = new Date(endOfDayLocal.toLocaleString("en-CA", { timeZone: "UTC" }));
    
    console.log(`Today in ${tz}:`, `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    console.log(`UTC window: ${startUTC.toISOString()} to ${endUTC.toISOString()}`);
    
    // Test 8pm completion
    const testCompletionTime = new Date(year, month, day, 20, 0, 0, 0);
    const testCompletionUTC = new Date(testCompletionTime.toLocaleString("en-CA", { timeZone: "UTC" }));
    console.log(`8pm ${tz} = ${testCompletionUTC.toISOString()} UTC`);
    console.log(`In today window? ${startUTC <= testCompletionUTC && testCompletionUTC < endUTC}`);
  }
}

// Run the tests
async function runTests() {
  console.log('=== TIMEZONE FIX VERIFICATION ===');
  
  // Test with a specific user (replace with actual user ID)
  const testUserId = 'your-user-id-here'; // Replace with actual user ID
  
  if (testUserId !== 'your-user-id-here') {
    await testFixedTimezoneCalculation(testUserId);
  }
  
  await testMultipleTimezones();
}

runTests().catch(console.error);
