import { logEnvValidation, validateEnv } from './config/env-validator';

// Run startup checks
export function runStartupChecks(): void {
  console.log('\n🚀 Starting TAAXDOG Application...\n');
  
  // Validate environment variables
  logEnvValidation();
  
  const { isValid, errors } = validateEnv();
  
  // In production, fail if environment is invalid
  if (process.env.NODE_ENV === 'production' && !isValid) {
    console.error('\n❌ Cannot start application in production with invalid environment configuration');
    console.error('Please fix the errors above and restart the application\n');
    process.exit(1);
  }
  
  // Log email provider status
  const emailProvider = process.env.EMAIL_PROVIDER || 
    (process.env.SENDGRID_API_KEY ? 'sendgrid' : 
     process.env.SMTP_USER ? 'smtp' : 'console');
  
  console.log(`📧 Email Provider: ${emailProvider}`);
  if (emailProvider === 'console') {
    console.log('   ⚠️  Emails will be logged to console (development mode)');
  }
  
  // Log database connection
  const dbUrl = process.env.NODE_ENV === 'production' 
    ? process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;
    
  if (dbUrl) {
    const dbHost = dbUrl.match(/@([^:\/]+)/)?.[1] || 'unknown';
    console.log(`🗄️  Database: ${dbHost}`);
  }
  
  // Log authentication status
  console.log(`🔐 Authentication: ${process.env.NEXTAUTH_URL || 'not configured'}`);
  
  // Log feature status
  console.log('\n📋 Feature Status:');
  console.log(`   ✅ Authentication: Enabled`);
  console.log(`   ${process.env.STRIPE_SECRET_KEY ? '✅' : '❌'} Payments: ${process.env.STRIPE_SECRET_KEY ? 'Enabled' : 'Disabled'}`);
  console.log(`   ${process.env.BASIQ_API_KEY ? '✅' : '❌'} Banking: ${process.env.BASIQ_API_KEY ? 'Enabled' : 'Disabled'}`);
  console.log(`   ${(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY) ? '✅' : '❌'} AI: ${(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY) ? 'Enabled' : 'Disabled'}`);
  
  console.log('\n✅ Startup checks complete\n');
}

// Run checks if this is the main module
if (require.main === module) {
  runStartupChecks();
}