const { InsightService } = require('./server/services/insightService');

async function testAgent() {
  try {
    console.log('Testing agent with existing journal entry...');
    
    // Get the most recent journal entry
    const response = await fetch('http://localhost:3000/api/journals');
    const entries = await response.json();
    
    if (entries.length === 0) {
      console.log('No journal entries found');
      return;
    }
    
    const latestEntry = entries[0]; // Most recent entry
    console.log('Testing with entry:', latestEntry.title);
    
    // Trigger insight generation
    const insight = await InsightService.generateInsightsForJournal(latestEntry);
    console.log('Insight generated:', insight);
    
  } catch (error) {
    console.error('Error testing agent:', error);
  }
}

testAgent(); 