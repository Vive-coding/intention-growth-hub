#!/usr/bin/env node

/**
 * Check database schema and table structure
 * Run with: node check_schema.js
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

async function checkSchema() {
  try {
    console.log('🔍 Checking database schema...\n');

    // Check if tables exist
    const tables = [
      'progress_snapshots',
      'life_metric_definitions', 
      'goal_instances',
      'goal_definitions',
      'users'
    ];

    for (const tableName of tables) {
      try {
        const result = await sql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = ${tableName}
          ORDER BY ordinal_position;
        `;
        
        console.log(`📋 Table: ${tableName}`);
        if (result.length === 0) {
          console.log('   ❌ Table does not exist');
        } else {
          console.log(`   ✅ Table exists with ${result.length} columns:`);
          result.forEach(col => {
            console.log(`      - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
          });
        }
        console.log('');
      } catch (error) {
        console.log(`   ❌ Error checking table ${tableName}:`, error.message);
        console.log('');
      }
    }

    // Check indexes
    console.log('🔍 Checking indexes...');
    try {
      const indexes = await sql`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename IN ('progress_snapshots', 'life_metric_definitions', 'goal_instances', 'goal_definitions', 'users')
        ORDER BY tablename, indexname;
      `;
      
      console.log(`   Found ${indexes.length} indexes:`);
      indexes.forEach(idx => {
        console.log(`   - ${idx.tablename}.${idx.indexname}`);
      });
    } catch (error) {
      console.log('   ❌ Error checking indexes:', error.message);
    }

    // Check constraints
    console.log('\n🔍 Checking constraints...');
    try {
      const constraints = await sql`
        SELECT 
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name IN ('progress_snapshots', 'life_metric_definitions', 'goal_instances', 'goal_definitions', 'users')
        ORDER BY tc.table_name, tc.constraint_type;
      `;
      
      console.log(`   Found ${constraints.length} constraints:`);
      constraints.forEach(constraint => {
        console.log(`   - ${constraint.table_name}.${constraint.constraint_name} (${constraint.constraint_type}) on ${constraint.column_name}`);
      });
    } catch (error) {
      console.log('   ❌ Error checking constraints:', error.message);
    }

    // Check data counts
    console.log('\n📊 Checking data counts...');
    for (const tableName of tables) {
      try {
        const result = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
        console.log(`   ${tableName}: ${result[0].count} rows`);
      } catch (error) {
        console.log(`   ${tableName}: ❌ Error - ${error.message}`);
      }
    }

    console.log('\n✅ Schema check complete!');

  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    await sql.end();
  }
}

checkSchema();
