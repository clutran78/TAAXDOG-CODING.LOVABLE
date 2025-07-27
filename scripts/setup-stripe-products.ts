#!/usr/bin/env node
import { getStripe } from '../lib/stripe/config';
import { SUBSCRIPTION_PLANS, getProductParams, getPriceParams } from '../lib/stripe/pricing';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products and prices...\n');

  const { stripe } = getStripe();
  const isLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');

  console.log(`Mode: ${isLiveMode ? '🔴 LIVE' : '🟢 TEST'}`);
  console.log('⚠️  WARNING: This will create real products in your Stripe account!\n');

  try {
    // Process each plan
    for (const [planKey, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
      console.log(`\n📦 Processing ${plan.name}...`);

      // Check if product already exists
      let product: any;
      try {
        const existingProducts = await stripe.products.list({
          ids: [plan.productId],
          limit: 1,
        });

        if (existingProducts.data.length > 0) {
          product = existingProducts.data[0];
          console.log(`✅ Product already exists: ${product.id}`);
        }
      } catch (error) {
        // Product doesn't exist, create it
      }

      if (!product) {
        // Create product
        const productParams = getProductParams(plan);
        product = await stripe.products.create(productParams);
        console.log(`✅ Created product: ${product.id}`);
      }

      // Create prices
      const pricesToCreate = [
        { tier: 'promotional', data: plan.prices.promotional },
        { tier: 'regular', data: plan.prices.regular },
        { tier: 'annual', data: plan.prices.annual },
      ];

      for (const { tier, data } of pricesToCreate) {
        try {
          // Check if price already exists
          const existingPrices = await stripe.prices.list({
            product: product.id,
            lookup_keys: [data.id],
            limit: 1,
          });

          if (existingPrices.data.length > 0) {
            console.log(`✅ Price already exists (${tier}): ${existingPrices.data[0].id}`);
            continue;
          }

          // Create price
          const priceParams = getPriceParams(product.id, data);
          const price = await stripe.prices.create(priceParams);
          console.log(`✅ Created price (${tier}): ${price.id} - ${data.name}`);
          console.log(`   Amount: $${(data.amount / 100).toFixed(2)} AUD (inc. GST)`);
          console.log(`   GST: $${(parseInt(data.metadata.gstAmount) / 100).toFixed(2)}`);

          if (tier === 'promotional') {
            console.log(`   Promotional period: ${data.metadata.promotionalMonths} months`);
            console.log(`   Transitions to: ${data.metadata.transitionToPriceId}`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to create price (${tier}):`, error.message);
        }
      }
    }

    // Create webhook endpoint if not exists
    console.log('\n🔗 Setting up webhook endpoint...');
    const webhookUrl = process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/api/stripe/webhooks`
      : 'https://taxreturnpro.com.au/api/stripe/webhooks';

    try {
      const existingEndpoints = await stripe.webhookEndpoints.list({ limit: 100 });
      const existingEndpoint = existingEndpoints.data.find((ep) => ep.url === webhookUrl);

      if (existingEndpoint) {
        console.log(`✅ Webhook endpoint already exists: ${existingEndpoint.url}`);
        console.log(`   Secret: ${existingEndpoint.secret}`);
      } else {
        const endpoint = await stripe.webhookEndpoints.create({
          url: webhookUrl,
          enabled_events: [
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted',
            'customer.subscription.trial_will_end',
            'invoice.paid',
            'invoice.payment_failed',
            'payment_method.attached',
            'payment_method.detached',
            'checkout.session.completed',
          ],
        });
        console.log(`✅ Created webhook endpoint: ${endpoint.url}`);
        console.log(`   Secret: ${endpoint.secret}`);
        console.log(
          '\n⚠️  IMPORTANT: Update your STRIPE_WEBHOOK_SECRET in .env with the secret above!',
        );
      }
    } catch (error: any) {
      console.error('❌ Failed to setup webhook:', error.message);
    }

    // Display summary
    console.log('\n✨ Setup Summary:');
    console.log('================');
    console.log('\nTAAX Smart Plan:');
    console.log('- 3-day free trial');
    console.log('- Promotional: $4.99/month (first 2 months)');
    console.log('- Regular: $9.99/month');
    console.log('- Annual: $99.00/year (save $20.88)');

    console.log('\nTAAX Pro Plan:');
    console.log('- 7-day free trial');
    console.log('- Promotional: $10.99/month (first 2 months)');
    console.log('- Regular: $18.99/month');
    console.log('- Annual: $189.00/year (save $38.88)');

    console.log('\n✅ All prices include 10% GST');
    console.log('✅ Automatic transition from promotional to regular pricing');
    console.log('✅ Australian tax invoices will be generated');

    console.log('\n🎉 Stripe setup complete!');
  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setupStripeProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Setup error:', error);
    process.exit(1);
  });
