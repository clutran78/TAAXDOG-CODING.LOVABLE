#!/usr/bin/env node

const https = require('https');

const PRODUCTION_URL = 'https://taxreturnpro.com.au';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, PRODUCTION_URL);
    
    const reqOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function verifyEmailConfiguration() {
  log('\n🔍 Verifying TaxReturnPro Email Configuration\n', 'cyan');
  log(`Production URL: ${PRODUCTION_URL}\n`, 'blue');

  // Step 1: Check if the site is live
  log('1. Checking if site is accessible...', 'yellow');
  try {
    const response = await makeRequest('/');
    if (response.status === 200) {
      log('   ✅ Site is live and accessible', 'green');
    } else {
      log(`   ⚠️  Site returned status: ${response.status}`, 'red');
    }
  } catch (error) {
    log(`   ❌ Site is not accessible: ${error.message}`, 'red');
    return;
  }

  // Step 2: Check email status endpoint
  log('\n2. Checking email configuration status...', 'yellow');
  try {
    const response = await makeRequest('/api/auth/email-status');
    
    if (response.status === 200) {
      const data = response.data;
      log('   ✅ Email status endpoint is working', 'green');
      log('\n   Configuration Details:', 'cyan');
      log(`   - Provider: ${data.provider || 'Not set'}`, data.configured ? 'green' : 'red');
      log(`   - Can Send Emails: ${data.canSendEmails ? 'Yes' : 'No'}`, data.canSendEmails ? 'green' : 'red');
      log(`   - Email Verification Required: ${data.requiresEmailVerification ? 'Yes' : 'No'}`);
      log(`   - Environment: ${data.environment}`);
      log(`   - From Address: ${data.emailFrom}`);
      
      if (!data.configured) {
        log('\n   ⚠️  Email provider is not properly configured!', 'red');
        log('   Please ensure SENDGRID_API_KEY is set in DigitalOcean environment variables.', 'yellow');
      }
    } else if (response.status === 404) {
      log('   ⚠️  Email status endpoint not found (404)', 'red');
      log('   The endpoint might not be deployed yet. Redeploy the application.', 'yellow');
    } else {
      log(`   ❌ Email status check failed with status: ${response.status}`, 'red');
      if (response.data) {
        log(`   Error: ${JSON.stringify(response.data)}`, 'red');
      }
    }
  } catch (error) {
    log(`   ❌ Failed to check email status: ${error.message}`, 'red');
  }

  // Step 3: Test admin email endpoint (requires API key)
  if (process.env.ADMIN_API_KEY || process.env.NEXTAUTH_SECRET) {
    log('\n3. Testing email sending capability...', 'yellow');
    const testEmail = process.argv[2] || 'test@example.com';
    
    try {
      const response = await makeRequest('/api/admin/test-email', {
        method: 'POST',
        headers: {
          'x-admin-api-key': process.env.ADMIN_API_KEY || process.env.NEXTAUTH_SECRET
        },
        body: {
          email: testEmail
        }
      });
      
      if (response.status === 200) {
        log('   ✅ Test email sent successfully!', 'green');
        log(`   Email sent to: ${testEmail}`, 'green');
        log('\n   Configuration:', 'cyan');
        const config = response.data.configuration;
        log(`   - Provider: ${config.provider}`, 'green');
        log(`   - From: ${config.from}`, 'green');
      } else if (response.status === 404) {
        log('   ⚠️  Test email endpoint not found (404)', 'red');
        log('   The endpoint might not be deployed yet.', 'yellow');
      } else if (response.status === 503) {
        log('   ❌ Email service not configured', 'red');
        const data = response.data;
        log(`   - Provider: ${data.provider || 'Not set'}`, 'red');
        log(`   - Has API Key: ${data.hasKey ? 'Yes' : 'No'}`, data.hasKey ? 'yellow' : 'red');
        if (data.keyPrefix) {
          log(`   - Key Prefix: ${data.keyPrefix}...`, 'yellow');
        }
      } else {
        log(`   ❌ Test email failed with status: ${response.status}`, 'red');
        if (response.data.error) {
          log(`   Error: ${response.data.error}`, 'red');
          log(`   Message: ${response.data.message}`, 'red');
        }
      }
    } catch (error) {
      log(`   ❌ Failed to test email: ${error.message}`, 'red');
    }
  } else {
    log('\n3. Skipping email send test (no API key provided)', 'yellow');
    log('   To test email sending, run:', 'cyan');
    log('   ADMIN_API_KEY=your-nextauth-secret node scripts/verify-production-email.js your-email@example.com', 'cyan');
  }

  // Summary
  log('\n📋 Summary:', 'cyan');
  log('1. To check email status: curl https://taxreturnpro.com.au/api/auth/email-status', 'blue');
  log('2. To send test email: Use the ADMIN_API_KEY environment variable', 'blue');
  log('3. To fix email issues: Ensure SENDGRID_API_KEY is set in DigitalOcean', 'blue');
  log('\nNote: After updating environment variables, you may need to redeploy the app.\n', 'yellow');
}

// Run the verification
verifyEmailConfiguration().catch(error => {
  log(`\n❌ Verification failed: ${error.message}`, 'red');
  process.exit(1);
});