#!/usr/bin/env ts-node

import { PrismaClient } from "@prisma/client";
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyOptimizations() {
  console.log('🚀 Applying query optimizations to database...\n');

  try {
    // 1. Create materialized views
    console.log('📊 Creating materialized views...');
    const viewsSQL = fs.readFileSync(
      path.join(__dirname, '../prisma/views/create-analytics-views-fixed.sql'),
      'utf-8'
    );

    // Split SQL statements and execute them
    const statements = viewsSQL
      .split(';')
      .filter(stmt => stmt.trim())
      .map(stmt => stmt.trim() + ';');

    for (const statement of statements) {
      if (statement.includes('CREATE')) {
        console.log(`  Creating view: ${statement.match(/VIEW\s+(\w+)/)?.[1] || 'unknown'}`);
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch (error: any) {
          if (error.code === '42P07') { // Relation already exists
            console.log('  ✓ View already exists, skipping...');
          } else {
            throw error;
          }
        }
      }
    }

    // 2. Create indexes for better query performance
    console.log('\n🔍 Creating performance indexes...');
    const indexes = [
      // Transaction indexes
      'CREATE INDEX IF NOT EXISTS idx_transaction_user_date ON bank_transactions(user_id, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_transaction_user_category ON bank_transactions(user_id, category)',
      'CREATE INDEX IF NOT EXISTS idx_transaction_deductible ON bank_transactions(user_id, is_tax_deductible) WHERE is_tax_deductible = true',
      
      // Goal indexes
      'CREATE INDEX IF NOT EXISTS idx_goal_user_active ON goals(user_id, is_active) WHERE is_active = true',
      'CREATE INDEX IF NOT EXISTS idx_goal_target_date ON goals(target_date) WHERE target_date IS NOT NULL',
      
      // Receipt indexes
      'CREATE INDEX IF NOT EXISTS idx_receipt_user_date ON receipts(user_id, date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_receipt_category ON receipts(user_id, category)',
      
      // Banking connection indexes
      'CREATE INDEX IF NOT EXISTS idx_banking_user_active ON bank_connections(user_id, is_active) WHERE is_active = true',
    ];

    for (const index of indexes) {
      const indexName = index.match(/INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)/)?.[1] || 'unknown';
      console.log(`  Creating index: ${indexName}`);
      try {
        await prisma.$executeRawUnsafe(index);
        console.log('  ✓ Index created successfully');
      } catch (error: any) {
        if (error.code === '42P07') { // Relation already exists
          console.log('  ✓ Index already exists');
        } else {
          console.error(`  ✗ Failed to create index: ${error.message}`);
        }
      }
    }

    // 3. Analyze tables for query planner optimization
    console.log('\n📈 Analyzing tables for query optimization...');
    const tables = ['users', 'bank_transactions', 'goals', 'receipts', 'bank_connections'];
    
    for (const table of tables) {
      console.log(`  Analyzing table: ${table}`);
      await prisma.$executeRawUnsafe(`ANALYZE ${table}`);
    }

    // 4. Refresh materialized views
    console.log('\n🔄 Refreshing materialized views...');
    try {
      await prisma.$executeRaw`SELECT refresh_analytics_views()`;
      console.log('  ✓ Views refreshed successfully');
    } catch (error) {
      console.log('  ℹ️  Could not refresh views (function might not exist yet)');
    }

    // 5. Display current statistics
    console.log('\n📊 Database Statistics:');
    
    // Table sizes
    const tableSizes = await prisma.$queryRaw<any[]>`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `;

    console.log('\n  Top 10 Tables by Size:');
    tableSizes.forEach((table, index) => {
      console.log(`    ${index + 1}. ${table.tablename}: ${table.size} (${table.row_count} rows)`);
    });

    // Index usage
    const indexUsage = await prisma.$queryRaw<any[]>`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as index_scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes
      WHERE idx_scan > 0
      ORDER BY idx_scan DESC
      LIMIT 10
    `;

    console.log('\n  Top 10 Most Used Indexes:');
    indexUsage.forEach((index, i) => {
      console.log(`    ${i + 1}. ${index.indexname} on ${index.tablename}: ${index.index_scans} scans`);
    });

    console.log('\n✅ Query optimizations applied successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Set up Redis for caching (if not already done)');
    console.log('  2. Configure connection pool settings in your .env file');
    console.log('  3. Monitor query performance using the health-check endpoint');
    console.log('  4. Schedule regular view refreshes (daily recommended)');

  } catch (error) {
    console.error('\n❌ Error applying optimizations:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
applyOptimizations();