#!/usr/bin/env ts-node

import { runMigrations, rollbackMigrations, migrationStatus } from '../lib/migrations';
import { config } from 'dotenv';

// Load environment variables
config();

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    switch (command) {
      case 'up':
      case 'run':
        const dryRun = args.includes('--dry-run');
        console.log(`Running migrations${dryRun ? ' (dry run)' : ''}...`);
        await runMigrations({ dryRun });
        break;

      case 'down':
      case 'rollback':
        const steps = parseInt(args[0]) || 1;
        console.log(`Rolling back ${steps} migration(s)...`);
        await rollbackMigrations(steps);
        break;

      case 'status':
        await migrationStatus();
        break;

      default:
        console.log(`
Database Migration Tool

Usage:
  npm run migrate [command] [options]

Commands:
  up, run         Run pending migrations
  down, rollback  Rollback migrations (default: 1 step)
  status          Show migration status

Options:
  --dry-run       Show what migrations would be run without applying them

Examples:
  npm run migrate up              # Run all pending migrations
  npm run migrate up --dry-run    # Show pending migrations without running
  npm run migrate down 2          # Rollback last 2 migrations
  npm run migrate status          # Show migration status
        `);
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();