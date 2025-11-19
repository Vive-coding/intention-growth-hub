/**
 * Add the missing 'term' column to goal_definitions table
 */

import 'dotenv/config';
import { ensureGoalTermColumn } from '../db';

async function addTermColumn() {
  try {
    await ensureGoalTermColumn();
    console.log('✅ Successfully added term column to goal_definitions');
  } catch (e: any) {
    console.error('❌ Error adding term column:', e);
    throw e;
  } finally {
    process.exit(0);
  }
}

addTermColumn();

