import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { goalInstances } from './server/storage.ts';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/intention_growth_hub";
const client = postgres(connectionString);
const db = drizzle(client);

async function checkCompletedGoals() {
  try {
    console.log('Checking for completed goals...');
    
    const completedGoals = await db
      .select()
      .from(goalInstances)
      .where(eq(goalInstances.status, "completed"));
    
    console.log(`Found ${completedGoals.length} completed goals:`);
    
    completedGoals.forEach(goal => {
      console.log(`- Goal ID: ${goal.id}`);
      console.log(`  Status: ${goal.status}`);
      console.log(`  Completed At: ${goal.completedAt}`);
      console.log(`  Current Value: ${goal.currentValue}`);
      console.log('---');
    });
    
    if (completedGoals.length === 0) {
      console.log('No completed goals found in database.');
      console.log('This explains why no completed dates are showing.');
    }
    
  } catch (error) {
    console.error('Error checking completed goals:', error);
  } finally {
    await client.end();
  }
}

checkCompletedGoals(); 