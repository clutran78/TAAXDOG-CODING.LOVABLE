#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function applyOptimizations() {
  console.log('🚀 Applying simple query optimizations to database...\n');

  try {
    // Create indexes for better query performance
    console.log('🔍 Creating performance indexes...');
    const indexes = [
      // Transaction indexes
      'CREATE INDEX IF NOT EXISTS idx_transaction_user_date ON bank_transactions(bank_account_id, transaction_date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_transaction_category ON bank_transactions(category) WHERE category IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_transaction_business ON bank_transactions(is_business_expense) WHERE is_business_expense = true',
      'CREATE INDEX IF NOT EXISTS idx_transaction_tax_cat ON bank_transactions(tax_category) WHERE tax_category IS NOT NULL',
      
      // Goal indexes
      'CREATE INDEX IF NOT EXISTS idx_goal_user ON goals(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_goal_status ON goals(status)',
      'CREATE INDEX IF NOT EXISTS idx_goal_target_date ON goals(target_date) WHERE target_date IS NOT NULL',
      
      // Receipt indexes
      'CREATE INDEX IF NOT EXISTS idx_receipt_user ON receipts("userId")',
      'CREATE INDEX IF NOT EXISTS idx_receipt_date ON receipts(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_receipt_tax_cat ON receipts(tax_category) WHERE tax_category IS NOT NULL',
      
      // Bank connections indexes
      'CREATE INDEX IF NOT EXISTS idx_bank_conn_user ON bank_connections(basiq_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_bank_conn_status ON bank_connections(status)',
      
      // Bank accounts indexes
      'CREATE INDEX IF NOT EXISTS idx_bank_acc_user ON bank_accounts(basiq_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_bank_acc_conn ON bank_accounts(connection_id)',
      
      // User indexes
      'CREATE INDEX IF NOT EXISTS idx_user_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_user_role ON users(role)',
    ];

    for (const index of indexes) {
      const indexName = index.match(/INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)/)?.[1] || 'unknown';
      console.log(`  Creating index: ${indexName}`);
      try {
        await prisma.$executeRawUnsafe(index);
        console.log('  ✓ Index created successfully');
      } catch (error: any) {
        if (error.code === 'P2010' && error.meta?.code === '42P07') {
          console.log('  ✓ Index already exists');
        } else {
          console.error(`  ✗ Failed to create index: ${error.message}`);
        }
      }
    }

    // Analyze tables for query planner optimization
    console.log('\n📈 Analyzing tables for query optimization...');
    const tables = [
      'users', 
      'bank_transactions', 
      'goals', 
      'receipts', 
      'bank_connections',
      'bank_accounts',
      'audit_logs',
      'sessions'
    ];
    
    for (const table of tables) {
      try {
        console.log(`  Analyzing table: ${table}`);
        await prisma.$executeRawUnsafe(`ANALYZE ${table}`);
        console.log('  ✓ Analysis complete');
      } catch (error) {
        console.error(`  ✗ Failed to analyze table: ${error}`);
      }
    }

    // Display current statistics
    console.log('\n📊 Database Statistics:');
    
    // Table sizes
    const tableSizes = await prisma.$queryRaw<any[]>`
      SELECT 
        relname as tablename,
        pg_size_pretty(pg_total_relation_size('public.'||relname)) AS size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size('public.'||relname) DESC
      LIMIT 10
    `;

    console.log('\n  Top 10 Tables by Size:');
    tableSizes.forEach((table, index) => {
      console.log(`    ${index + 1}. ${table.tablename}: ${table.size} (${table.row_count} rows)`);
    });

    // Connection stats
    const connStats = await prisma.$queryRaw<any[]>`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    console.log('\n  Connection Pool Status:');
    if (connStats[0]) {
      console.log(`    Total: ${connStats[0].total_connections}`);
      console.log(`    Active: ${connStats[0].active_connections}`);
      console.log(`    Idle: ${connStats[0].idle_connections}`);
    }

    console.log('\n✅ Query optimizations applied successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Monitor query performance using pg_stat_statements');
    console.log('  2. Set up Redis for caching frequently accessed data');
    console.log('  3. Consider implementing materialized views for complex aggregations');
    console.log('  4. Use the health-check endpoint to monitor performance');

  } catch (error) {
    console.error('\n❌ Error applying optimizations:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
applyOptimizations();