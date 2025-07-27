#!/usr/bin/env ts-node

import { readFile, writeFile, readdir } from 'fs/promises';
import { resolve, basename, join } from 'path';
import { promises as fs } from 'fs';

interface MigrationResult {
  file: string;
  status: 'success' | 'skipped' | 'error';
  message: string;
}

async function migrateFile(filePath: string): Promise<MigrationResult> {
  const fileName = basename(filePath);

  // Skip already migrated files
  if (fileName.includes('-updated') || fileName.includes('-rls')) {
    return {
      file: filePath,
      status: 'skipped',
      message: 'Already migrated',
    };
  }

  try {
    let content = await readFile(filePath, 'utf-8');

    // Check if file uses session/userId pattern
    if (!content.includes('getServerSession') || !content.includes('userId')) {
      return {
        file: filePath,
        status: 'skipped',
        message: 'No userId filtering detected',
      };
    }

    // Apply transformations
    let transformed = content;
    let changes: string[] = [];

    // 1. Update imports
    if (content.includes("import { NextApiRequest, NextApiResponse } from 'next'")) {
      transformed = transformed.replace(
        "import { NextApiRequest, NextApiResponse } from 'next'",
        "import type { NextApiResponse } from 'next'",
      );
      changes.push('Updated Next.js imports');
    }

    // Add RLS imports after next imports
    if (!content.includes('withRLSMiddleware')) {
      const nextImportMatch = transformed.match(/import.*from ['"]next.*['"];?\n/);
      if (nextImportMatch) {
        transformed = transformed.replace(
          nextImportMatch[0],
          nextImportMatch[0] +
            "import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';\n",
        );
        changes.push('Added RLS imports');
      }
    }

    // 2. Replace prisma import
    if (content.includes('import { PrismaClient }') || content.includes('import prisma from')) {
      transformed = transformed.replace(
        /import \{ PrismaClient \}.*\n.*new PrismaClient\(\);?/g,
        "import prismaWithRLS from '@/lib/prisma-rls';",
      );
      transformed = transformed.replace(
        /import prisma from.*['"];?/g,
        "import prismaWithRLS from '@/lib/prisma-rls';",
      );
      changes.push('Updated Prisma import');
    }

    // 3. Update handler signature
    transformed = transformed.replace(
      /export default async function handler\s*\(\s*req:\s*NextApiRequest,\s*res:\s*NextApiResponse\s*\)/g,
      'async function handler(req: NextApiRequestWithRLS, res: NextApiResponse)',
    );
    changes.push('Updated handler signature');

    // 4. Remove session checks
    transformed = transformed.replace(
      /const session = await getServerSession.*\n.*if \(!session.*\) \{[\s\S]*?return res\.status\(401\).*\n.*\}\n.*const userId = session\.user\.id;?/g,
      "if (!req.rlsContext) {\n    return res.status(500).json({ error: 'RLS context not initialized' });\n  }",
    );
    changes.push('Removed session checks');

    // 5. Wrap database operations in RLS context
    // Find all prisma operations
    const prismaOps = transformed.match(/await prisma\.\w+\.\w+\([^)]*\)/g) || [];
    prismaOps.forEach((op) => {
      if (!op.includes('req.rlsContext.execute')) {
        const wrapped = `await req.rlsContext.execute(async () => {\n      return ${op};\n    })`;
        transformed = transformed.replace(op, wrapped);
      }
    });
    if (prismaOps.length > 0) {
      changes.push(`Wrapped ${prismaOps.length} Prisma operations in RLS context`);
    }

    // 6. Remove userId from where clauses
    transformed = transformed.replace(
      /where:\s*\{[^}]*userId:?\s*(?:session\.user\.id|userId)[^}]*\}/g,
      (match) => {
        // Remove userId field but keep other conditions
        const cleaned = match.replace(/userId:?\s*(?:session\.user\.id|userId),?\s*/g, '');
        // Clean up trailing commas
        return cleaned.replace(/,(\s*\})/g, '$1');
      },
    );
    changes.push('Removed manual userId filters');

    // 7. Update error handling
    transformed = transformed.replace(
      /catch \(error.*\) \{[\s\S]*?return res\.status\(500\).*\}/g,
      'catch (error) {\n    return handleRLSError(error, res);\n  }',
    );
    changes.push('Updated error handling');

    // 8. Add export with middleware
    if (!transformed.includes('export default withRLSMiddleware')) {
      transformed = transformed.replace(
        /export default handler;?$/,
        'export default withRLSMiddleware(handler);',
      );
      changes.push('Added RLS middleware export');
    }

    // 9. Fix prisma references
    transformed = transformed.replace(/\bprisma\./g, 'prismaWithRLS.');

    // Write to new file
    const newPath = filePath.replace('.ts', '-rls-migrated.ts');
    await writeFile(newPath, transformed);

    return {
      file: filePath,
      status: 'success',
      message: `Migrated successfully. Changes: ${changes.join(', ')}`,
    };
  } catch (error: any) {
    return {
      file: filePath,
      status: 'error',
      message: error.message,
    };
  }
}

async function findApiFiles(dir: string, files: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await findApiFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      // Skip already migrated files and nextauth
      if (
        !entry.name.includes('-updated') &&
        !entry.name.includes('-rls') &&
        !entry.name.includes('[...nextauth]')
      ) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function main() {
  console.log('🚀 Starting RLS Migration Assistant\n');

  const apiDir = resolve(__dirname, '../pages/api');
  const files = await findApiFiles(apiDir);

  console.log(`Found ${files.length} API files to analyze\n`);

  const results: MigrationResult[] = [];

  for (const filePath of files) {
    const relativePath = filePath.replace(apiDir + '/', '');
    console.log(`Processing: ${relativePath}`);
    const result = await migrateFile(filePath);
    results.push(result);
    console.log(
      `  ${result.status === 'success' ? '✅' : result.status === 'skipped' ? '⏭️' : '❌'} ${result.message}\n`,
    );
  }

  // Summary
  console.log('\n📊 Migration Summary:');
  console.log('═'.repeat(50));

  const successful = results.filter((r) => r.status === 'success');
  const skipped = results.filter((r) => r.status === 'skipped');
  const errors = results.filter((r) => r.status === 'error');

  console.log(`✅ Successfully migrated: ${successful.length}`);
  console.log(`⏭️  Skipped: ${skipped.length}`);
  console.log(`❌ Errors: ${errors.length}`);

  if (successful.length > 0) {
    console.log('\n📝 Successfully migrated files:');
    successful.forEach((r) => {
      console.log(`  - ${r.file} → ${r.file.replace('.ts', '-rls-migrated.ts')}`);
    });
  }

  if (errors.length > 0) {
    console.log('\n❌ Files with errors:');
    errors.forEach((r) => {
      console.log(`  - ${r.file}: ${r.message}`);
    });
  }

  console.log('\n🎯 Next Steps:');
  console.log('1. Review the migrated files (*-rls-migrated.ts)');
  console.log('2. Test each endpoint thoroughly');
  console.log('3. Replace original files with migrated versions');
  console.log('4. Delete the -rls-migrated suffix from filenames');
}

main().catch(console.error);
