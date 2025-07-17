#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function monitorRLSPerformance() {
  console.log('📊 RLS Performance Monitor\n');
  
  try {
    // Check slow queries
    console.log('1️⃣ Checking for slow queries (>100ms)...');
    const slowQueries = await prisma.$queryRawUnsafe(`
      SELECT 
        query,
        calls,
        mean_exec_time as avg_ms,
        max_exec_time as max_ms
      FROM pg_stat_statements
      WHERE query LIKE '%current_user_id%'
      AND mean_exec_time > 100
      ORDER BY mean_exec_time DESC
      LIMIT 10;
    `).catch(() => []);
    
    if ((slowQueries as any[]).length > 0) {
      console.table(slowQueries);
    } else {
      console.log('✅ No slow RLS queries found\n');
    }

    // Check index usage
    console.log('2️⃣ Checking RLS-related index usage...');
    const indexUsage = await prisma.$queryRawUnsafe(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE indexname LIKE '%userid%'
      ORDER BY idx_scan DESC;
    `) as any[];
    
    if (indexUsage.length > 0) {
      console.log('Index usage statistics:');
      console.table(indexUsage);
    }

    // Check table sizes
    console.log('\n3️⃣ Checking protected table sizes...');
    const tableSizes = await prisma.$queryRawUnsafe(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(tablename::regclass)) as total_size,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes
      FROM pg_stat_user_tables
      WHERE tablename IN ('users', 'goals', 'receipts', 'bank_transactions', 'budgets')
      ORDER BY pg_total_relation_size(tablename::regclass) DESC;
    `) as any[];
    
    console.table(tableSizes);

    // Check RLS policy execution
    console.log('\n4️⃣ Testing RLS policy performance...');
    
    // Test user data access
    console.time('RLS User Query');
    await prisma.$queryRawUnsafe(`
      SET LOCAL app.current_user_id = '00000000-0000-0000-0000-000000000000';
    `);
    await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) FROM goals;
    `);
    console.timeEnd('RLS User Query');
    
    // Test admin access
    console.time('RLS Admin Query');
    await prisma.$queryRawUnsafe(`
      SET LOCAL app.current_user_id = '00000000-0000-0000-0000-000000000001';
    `);
    await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) FROM goals;
    `);
    console.timeEnd('RLS Admin Query');

    // Recommendations
    console.log('\n📝 Performance Recommendations:');
    console.log('1. Add indexes on frequently queried columns');
    console.log('2. Use EXPLAIN ANALYZE for slow queries');
    console.log('3. Consider partitioning large tables');
    console.log('4. Monitor connection pool usage');
    console.log('5. Set up alerts for slow queries');

  } catch (error: any) {
    if (error.message?.includes('pg_stat_statements')) {
      console.log('⚠️  pg_stat_statements extension not available');
      console.log('   Enable it for detailed query performance monitoring');
    } else {
      console.error('❌ Monitoring failed:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

monitorRLSPerformance().catch(console.error);