/**
 * Script to add deleted_at column to chat_threads table in production
 * 
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx server/scripts/addDeletedAtColumn.ts
 */

import postgres from 'postgres';

async function addDeletedAtColumn() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is required');
    console.log('Usage: DATABASE_URL="postgresql://..." npx tsx server/scripts/addDeletedAtColumn.ts');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...');
  const sql = postgres(databaseUrl);

  try {
    // Check if column already exists
    console.log('🔍 Checking if deleted_at column exists...');
    const existing = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chat_threads' 
      AND column_name = 'deleted_at'
    `;

    if (existing.length > 0) {
      console.log('✅ Column deleted_at already exists in chat_threads table');
      await sql.end();
      process.exit(0);
    }

    // Add the column
    console.log('➕ Adding deleted_at column to chat_threads table...');
    await sql`
      ALTER TABLE chat_threads 
      ADD COLUMN deleted_at TIMESTAMP
    `;

    console.log('✅ Successfully added deleted_at column');

    // Verify it was added
    console.log('🔍 Verifying column was added...');
    const verification = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chat_threads' 
      AND column_name = 'deleted_at'
    `;

    if (verification.length > 0) {
      console.log('✅ Verification successful!');
      console.log('   Column:', verification[0].column_name);
      console.log('   Type:', verification[0].data_type);
    } else {
      console.error('❌ Verification failed - column not found after creation');
      process.exit(1);
    }

    // Show current schema
    console.log('\n📋 Current chat_threads schema:');
    const schema = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'chat_threads'
      ORDER BY ordinal_position
    `;
    console.table(schema);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await sql.end();
    console.log('\n✨ Done!');
  }
}

addDeletedAtColumn();

