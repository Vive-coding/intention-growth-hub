import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function backupData() {
  try {
    console.log('Backing up existing data before migration...');
    
    // Backup goal_habits data
    const goalHabits = await sql`SELECT * FROM goal_habits`;
    console.log(`Backed up ${goalHabits.length} goal_habits records`);
    
    // Backup habit_completions data
    const habitCompletions = await sql`SELECT * FROM habit_completions`;
    console.log(`Backed up ${habitCompletions.length} habit_completions records`);
    
    // Backup suggested_habits data
    const suggestedHabits = await sql`SELECT * FROM suggested_habits`;
    console.log(`Backed up ${suggestedHabits.length} suggested_habits records`);
    
    // Save to JSON files for reference
    const fs = await import('fs');
    const backupData = {
      goalHabits,
      habitCompletions,
      suggestedHabits,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('backup_before_migration.json', JSON.stringify(backupData, null, 2));
    console.log('Backup saved to backup_before_migration.json');
    
  } catch (error) {
    console.error('Error backing up data:', error);
  } finally {
    await sql.end();
  }
}

backupData(); 