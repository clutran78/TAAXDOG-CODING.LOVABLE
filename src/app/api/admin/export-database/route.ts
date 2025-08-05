import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';

// Security: Only allow in development or with admin token
const ADMIN_TOKEN = process.env.ADMIN_EXPORT_TOKEN || 'dev-only-token';

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (token !== ADMIN_TOKEN) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only allow in development or with explicit permission
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DB_EXPORT) {
      return NextResponse.json({ error: 'Database export not allowed in production' }, { status: 403 });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ error: 'Database URL not configured' }, { status: 500 });
    }

    // Parse database URL to extract connection details
    const dbUrl = new URL(databaseUrl);
    const host = dbUrl.hostname;
    const port = dbUrl.port || '5432';
    const username = dbUrl.username;
    const password = dbUrl.password;
    const database = dbUrl.pathname.slice(1); // Remove leading slash

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpFile = `/tmp/database_export_${timestamp}.dump`;

    return new Promise((resolve) => {
      // Use pg_dump to create database export
      const pgDump = spawn('pg_dump', [
        '-h', host,
        '-p', port,
        '-U', username,
        '-d', database,
        '-Fc', // Custom format
        '-b',  // Include blobs
        '-v',  // Verbose
        '-f', dumpFile
      ], {
        env: {
          ...process.env,
          PGPASSWORD: password
        }
      });

      let stderr = '';

      pgDump.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('pg_dump progress:', data.toString());
      });

      pgDump.on('close', async (code) => {
        if (code === 0) {
          try {
            // Stream the file back to client
            const fileStream = createReadStream(dumpFile);
            const response = new Response(fileStream as any, {
              headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="database_export_${timestamp}.dump"`,
                'X-Export-Status': 'success'
              }
            });

            // Clean up file after streaming (with delay)
            setTimeout(async () => {
              try {
                await unlink(dumpFile);
              } catch (error) {
                console.error('Error cleaning up dump file:', error);
              }
            }, 5000);

            resolve(response);
          } catch (error) {
            console.error('Error streaming file:', error);
            resolve(NextResponse.json({ 
              error: 'Failed to stream export file',
              details: error.message 
            }, { status: 500 }));
          }
        } else {
          console.error('pg_dump failed with code:', code, 'stderr:', stderr);
          resolve(NextResponse.json({ 
            error: 'Database export failed',
            exitCode: code,
            details: stderr 
          }, { status: 500 }));
        }
      });

      pgDump.on('error', (error) => {
        console.error('pg_dump process error:', error);
        resolve(NextResponse.json({ 
          error: 'Failed to start database export',
          details: error.message 
        }, { status: 500 }));
      });
    });

  } catch (error) {
    console.error('Database export error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to check if export is available
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  if (token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  return NextResponse.json({
    available: true,
    databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured',
    environment: process.env.NODE_ENV,
    exportAllowed: process.env.NODE_ENV !== 'production' || process.env.ALLOW_DB_EXPORT === 'true'
  });
}