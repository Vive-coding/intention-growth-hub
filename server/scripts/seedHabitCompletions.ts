import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { habitCompletions, habitDefinitions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

config();

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

async function seedHabitCompletions() {
  try {
    console.log('Seeding habit completions for the last 6 months...');
    
    const userId = "dev-user-123";
    
    // Get all habit definitions
    const habits = await db.select().from(habitDefinitions).where(eq(habitDefinitions.userId, userId));
    
    console.log(`Found ${habits.length} habits to seed completions for`);
    
    // Define completion patterns for different habits
    const completionPatterns = [
      // High consistency habits (80-90% completion rate)
      {
        habitNames: ["Exercise 30 minutes", "Get 8 hours of sleep", "Practice meditation"],
        completionRate: 0.85, // 85% completion rate
        streakPattern: "regular", // Regular streaks
      },
      // Medium consistency habits (60-75% completion rate)
      {
        habitNames: ["Drink 8 glasses of water", "Read 20 pages", "Practice coding 1 hour"],
        completionRate: 0.70, // 70% completion rate
        streakPattern: "moderate", // Moderate streaks
      },
      // Lower consistency habits (40-60% completion rate)
      {
        habitNames: ["Track expenses", "Save money", "Write in journal"],
        completionRate: 0.55, // 55% completion rate
        streakPattern: "irregular", // Irregular streaks
      },
      // Social/relationship habits (30-50% completion rate)
      {
        habitNames: ["Call a friend", "Spend quality time", "Express appreciation"],
        completionRate: 0.45, // 45% completion rate
        streakPattern: "sporadic", // Sporadic completion
      },
      // Default pattern for other habits
      {
        habitNames: ["*"], // Catch-all for other habits
        completionRate: 0.65, // 65% completion rate
        streakPattern: "moderate",
      },
    ];
    
    const insertedCompletions: Array<{habit: string, date: string}> = [];
    
    // Generate completions for the last 6 months (180 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 6);
    
    for (const habit of habits) {
      // Find the completion pattern for this habit
      const pattern = completionPatterns.find(p => 
        p.habitNames.includes(habit.name) || p.habitNames.includes("*")
      ) || completionPatterns[completionPatterns.length - 1];
      
      // Generate completions for each day
      const currentDate = new Date(startDate);
      let currentStreak = 0;
      
      while (currentDate <= endDate) {
        // Determine if this day should have a completion based on pattern
        let shouldComplete = false;
        
        switch (pattern.streakPattern) {
          case "regular":
            // Regular streaks with occasional breaks
            shouldComplete = Math.random() < pattern.completionRate;
            if (currentStreak > 7) {
              // Take a break after a week
              shouldComplete = Math.random() < 0.3;
            }
            break;
            
          case "moderate":
            // Moderate consistency with some variation
            shouldComplete = Math.random() < pattern.completionRate;
            if (currentStreak > 5) {
              // Shorter streaks
              shouldComplete = Math.random() < 0.4;
            }
            break;
            
          case "irregular":
            // Irregular patterns with longer breaks
            shouldComplete = Math.random() < pattern.completionRate;
            if (currentStreak > 3) {
              // Frequent breaks
              shouldComplete = Math.random() < 0.2;
            }
            break;
            
          case "sporadic":
            // Sporadic completion, often in bursts
            shouldComplete = Math.random() < pattern.completionRate;
            if (currentStreak > 2) {
              // Very short streaks
              shouldComplete = Math.random() < 0.1;
            }
            break;
            
          default:
            shouldComplete = Math.random() < pattern.completionRate;
        }
        
        if (shouldComplete) {
          // Create completion record
          const completionTime = new Date(currentDate);
          completionTime.setHours(9 + Math.floor(Math.random() * 12)); // Random time between 9 AM and 9 PM
          completionTime.setMinutes(Math.floor(Math.random() * 60));
          
          await db.insert(habitCompletions).values({
            habitDefinitionId: habit.id,
            userId,
            completedAt: completionTime,
            notes: `Seeded completion for ${habit.name}`,
          });
          
          currentStreak++;
          insertedCompletions.push({
            habit: habit.name,
            date: currentDate.toISOString().split('T')[0],
          });
        } else {
          // Break the streak
          currentStreak = 0;
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    console.log(`✅ Successfully seeded ${insertedCompletions.length} habit completions`);
    
    // Log some statistics
    const uniqueHabits = Array.from(new Set(insertedCompletions.map(c => c.habit)));
    console.log(`\nCompletions seeded for ${uniqueHabits.length} unique habits`);
    
    // Show completion counts by habit
    const completionCounts = uniqueHabits.map(habitName => {
      const count = insertedCompletions.filter(c => c.habit === habitName).length;
      return { habit: habitName, completions: count };
    }).sort((a, b) => b.completions - a.completions);
    
    console.log('\nTop 10 habits by completion count:');
    completionCounts.slice(0, 10).forEach(({ habit, completions }) => {
      console.log(`- ${habit}: ${completions} completions`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding habit completions:', error);
  } finally {
    await sql.end();
  }
}

seedHabitCompletions(); 