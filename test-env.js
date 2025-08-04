// Test script to verify environment variables are loaded
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Testing Environment Variables:');
console.log('================================');

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY ? 'SET ✅' : 'NOT SET ❌');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'SET ✅' : 'NOT SET ❌');
console.log('STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? 'SET ✅' : 'NOT SET ❌');
console.log('STRIPE_TEST_PUBLISHABLE_KEY:', process.env.STRIPE_TEST_PUBLISHABLE_KEY ? 'SET ✅' : 'NOT SET ❌');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET ✅' : 'NOT SET ❌');
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? 'SET ✅' : 'NOT SET ❌');

console.log('\n🎯 Expected Stripe Keys:');
console.log('==========================');
if (process.env.STRIPE_PUBLISHABLE_KEY) {
  console.log('STRIPE_PUBLISHABLE_KEY starts with:', process.env.STRIPE_PUBLISHABLE_KEY.substring(0, 20) + '...');
  console.log('Valid pk_test format:', process.env.STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_') ? '✅' : '❌');
}

if (process.env.STRIPE_SECRET_KEY) {
  console.log('STRIPE_SECRET_KEY starts with:', process.env.STRIPE_SECRET_KEY.substring(0, 20) + '...');
  console.log('Valid sk_test format:', process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? '✅' : '❌');
}

console.log('\n📋 Summary:');
console.log('============');
const requiredVars = ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length === 0) {
  console.log('🎉 All required Stripe environment variables are SET!');
  console.log('🟢 Stripe integration should be GREEN now!');
} else {
  console.log('❌ Missing variables:', missingVars.join(', '));
}