import { PrismaClient } from "@prisma/client";
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyIndexesMigration() {
  console.log('🚀 Applying performance indexes migration...\n');

  try {
    // Check database connection
    const dbInfo = await prisma.$queryRaw`
      SELECT current_database() as database, 
             current_user as user,
             version() as version
    `;
    console.log('📊 Database Info:', dbInfo);

    // Check if we're in production
    const isProduction = process.env.NODE_ENV === 'production' || 
                        process.env.DATABASE_URL?.includes('production');
    
    if (isProduction) {
      console.log('\n⚠️  WARNING: You are connected to a production database!');
      console.log('Please review the migration before proceeding.\n');
    }

    // Read migration SQL
    const migrationPath = path.join(__dirname, '../migrations/add_performance_indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Migration SQL to be applied:');
    console.log('================================');
    console.log(migrationSQL);
    console.log('================================\n');

    // Check existing indexes
    console.log('🔍 Checking existing indexes...\n');
    const existingIndexes = await prisma.$queryRaw`
      SELECT 
        tablename,
        indexname
      FROM 
        pg_indexes
      WHERE 
        schemaname = 'public' 
        AND tablename IN ('users', 'goals', 'bank_transactions', 'receipts')
      ORDER BY 
        tablename, 
        indexname
    `;

    console.log('Existing indexes:');
    console.table(existingIndexes);

    // Apply migration
    if (process.argv.includes('--dry-run')) {
      console.log('\n✅ Dry run completed. No changes were made.');
      console.log('Remove --dry-run flag to apply the migration.');
    } else {
      console.log('\n🔄 Applying migration...');
      
      // Split SQL into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('select'));

      for (const statement of statements) {
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            console.log(`⏭️  Skipped (already exists): ${statement.substring(0, 50)}...`);
          } else {
            console.error(`❌ Failed: ${statement.substring(0, 50)}...`);
            console.error(error.message);
          }
        }
      }

      // Verify new indexes
      console.log('\n🔍 Verifying indexes after migration...\n');
      const newIndexes = await prisma.$queryRaw`
        SELECT 
          tablename,
          indexname,
          indexdef
        FROM 
          pg_indexes
        WHERE 
          schemaname = 'public' 
          AND tablename IN ('users', 'goals', 'bank_transactions', 'receipts')
          AND indexname LIKE '%idx%'
        ORDER BY 
          tablename, 
          indexname
      `;

      console.log('Indexes after migration:');
      console.table(newIndexes);

      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
console.log('Performance Indexes Migration Tool');
console.log('==================================\n');
console.log('Usage: ts-node apply-indexes-migration.ts [--dry-run]\n');

applyIndexesMigration();