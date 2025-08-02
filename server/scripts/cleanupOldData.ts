import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function cleanupOldData() {
  try {
    console.log('Cleaning up old data to start fresh...');
    
    // Clean up in order to respect foreign key constraints
    console.log('1. Deleting progress snapshots...');
    await sql`DELETE FROM progress_snapshots`;
    console.log('   ✅ Progress snapshots deleted');
    
    console.log('2. Deleting habit completions...');
    await sql`DELETE FROM habit_completions`;
    console.log('   ✅ Habit completions deleted');
    
    console.log('3. Deleting suggested habits...');
    await sql`DELETE FROM suggested_habits`;
    console.log('   ✅ Suggested habits deleted');
    
    console.log('4. Deleting insights...');
    await sql`DELETE FROM insights`;
    console.log('   ✅ Insights deleted');
    
    console.log('5. Deleting goal instances...');
    await sql`DELETE FROM goal_instances`;
    console.log('   ✅ Goal instances deleted');
    
    console.log('6. Deleting goal definitions...');
    await sql`DELETE FROM goal_definitions`;
    console.log('   ✅ Goal definitions deleted');
    
    // Keep life metric definitions and users as they're the foundation
    
    console.log('✅ All old data cleaned up successfully!');
    console.log('Ready for fresh seeding with new habit structure.');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await sql.end();
  }
}

cleanupOldData(); 