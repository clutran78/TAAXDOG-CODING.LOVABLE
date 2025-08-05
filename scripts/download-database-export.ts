#!/usr/bin/env tsx

/**
 * Script to download database export from the deployed application
 * This works around DigitalOcean database network restrictions
 */

import fs from 'fs';
import path from 'path';

const ADMIN_TOKEN = process.env.ADMIN_EXPORT_TOKEN || 'dev-only-token';
const APP_URL = process.env.NEXTAUTH_URL || 'https://dev.taxreturnpro.com.au';

async function downloadDatabaseExport() {
  console.log('🗄️ Downloading database export from deployed app...');
  console.log(`📍 App URL: ${APP_URL}`);
  
  try {
    // First, check if export is available
    console.log('🔍 Checking export availability...');
    const checkResponse = await fetch(`${APP_URL}/api/admin/export-database`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!checkResponse.ok) {
      const error = await checkResponse.text();
      throw new Error(`Export check failed: ${checkResponse.status} - ${error}`);
    }

    const checkResult = await checkResponse.json();
    console.log('✅ Export availability:', checkResult);

    if (!checkResult.exportAllowed) {
      throw new Error('Database export is not allowed in current environment');
    }

    // Request the database export
    console.log('📦 Requesting database export...');
    const exportResponse = await fetch(`${APP_URL}/api/admin/export-database`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!exportResponse.ok) {
      const error = await exportResponse.text();
      throw new Error(`Export failed: ${exportResponse.status} - ${error}`);
    }

    // Check if response is binary (the dump file) or JSON (error)
    const contentType = exportResponse.headers.get('Content-Type');
    
    if (contentType?.includes('application/octet-stream')) {
      // Success - we got the dump file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `digitalocean_backup_${timestamp}.dump`;
      const filepath = path.join(process.cwd(), filename);

      console.log(`💾 Saving database export to: ${filename}`);
      
      const arrayBuffer = await exportResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      fs.writeFileSync(filepath, buffer);
      
      console.log('✅ Database export completed successfully!');
      console.log(`📁 File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
      console.log(`📂 Location: ${filepath}`);
      
      return filepath;
    } else {
      // Error response
      const errorData = await exportResponse.json();
      throw new Error(`Export failed: ${JSON.stringify(errorData, null, 2)}`);
    }

  } catch (error) {
    console.error('❌ Database export failed:', error.message);
    
    if (error.message.includes('Unauthorized')) {
      console.log('\n🔑 Authentication failed. Make sure:');
      console.log('1. ADMIN_EXPORT_TOKEN is set correctly');
      console.log('2. The token matches the one in your deployed app');
      console.log('\n💡 You can set it with:');
      console.log('export ADMIN_EXPORT_TOKEN="your-secure-token"');
    }
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      console.log('\n🌐 Network connection failed. Make sure:');
      console.log('1. Your app is deployed and running');
      console.log('2. The NEXTAUTH_URL is correct');
      console.log(`3. You can access: ${APP_URL}`);
    }
    
    process.exit(1);
  }
}

// Run the export
if (require.main === module) {
  downloadDatabaseExport();
}

export { downloadDatabaseExport };