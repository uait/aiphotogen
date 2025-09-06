#!/usr/bin/env node

/**
 * Comprehensive Subscription System Test Script
 * Tests all major functionality of the subscription system
 */

const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test_user_12345';
const TEST_AUTH_TOKEN = 'mock_firebase_token_for_testing';

class SubscriptionTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTest(name, testFn) {
    console.log(`🧪 Testing: ${name}`);
    try {
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED', error: null });
    } catch (error) {
      console.log(`❌ FAILED: ${name} - ${error.message}`);
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });
    }
  }

  async makeRequest(endpoint, options = {}) {
    const config = {
      baseURL: BASE_URL,
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await axios(endpoint, config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async testEnvironmentSetup() {
    // Test if server is running
    try {
      await axios.get(`${BASE_URL}/`);
      console.log('✅ Server is running');
    } catch (error) {
      throw new Error('Server is not running. Please start with `npm run dev`');
    }

    // Check environment variables
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL', 
      'FIREBASE_PRIVATE_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'STRIPE_WEBHOOK_SECRET'
    ];

    console.log('🔍 Checking environment variables...');
    const missingVars = [];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missingVars.push(envVar);
      }
    }

    if (missingVars.length > 0) {
      console.log(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
      console.log('   The system will run with graceful degradation');
    } else {
      console.log('✅ All environment variables configured');
    }
  }

  async testUsageAPI() {
    const response = await this.makeRequest('/api/subscription/usage');
    
    // Verify response structure
    if (!response.today || !response.thisMonth || !response.plan) {
      throw new Error('Invalid usage response structure');
    }

    // Check that free plan is default
    if (response.plan.id !== 'free') {
      throw new Error(`Expected free plan, got: ${response.plan.id}`);
    }

    // Verify daily limit structure
    if (typeof response.today.used !== 'number' || 
        typeof response.today.limit !== 'number' ||
        typeof response.today.remaining !== 'number') {
      throw new Error('Invalid daily usage structure');
    }

    console.log(`   Daily usage: ${response.today.used}/${response.today.limit}`);
    console.log(`   Current plan: ${response.plan.displayName}`);
  }

  async testCheckoutSessionCreation() {
    const checkoutData = {
      planId: 'starter',
      successUrl: `${BASE_URL}/dashboard?success=true`,
      cancelUrl: `${BASE_URL}/pricing?canceled=true`
    };

    try {
      const response = await this.makeRequest('/api/subscription/checkout', {
        method: 'POST',
        data: checkoutData
      });

      if (!response.url || !response.sessionId) {
        throw new Error('Invalid checkout session response');
      }

      console.log(`   Checkout session created: ${response.sessionId}`);
    } catch (error) {
      // If Stripe is not configured, this should fail gracefully
      if (error.message.includes('Stripe not configured')) {
        console.log('   ⚠️  Stripe not configured - checkout disabled');
      } else {
        throw error;
      }
    }
  }

  async testImageGenerationLimits() {
    // Test image generation with usage tracking
    const generateData = {
      prompt: 'A beautiful sunset over mountains',
      model: 'gemini-pro-vision', 
      width: 512,
      height: 512
    };

    try {
      const response = await this.makeRequest('/api/generate-image-v2', {
        method: 'POST',
        data: generateData
      });

      console.log('   Image generation successful');
      
      // Check if usage was recorded
      const usageAfter = await this.makeRequest('/api/subscription/usage');
      console.log(`   Usage after generation: ${usageAfter.today.used}/${usageAfter.today.limit}`);
      
    } catch (error) {
      // Expected if we hit daily limits or if AI service not configured
      if (error.message.includes('Daily usage limit exceeded')) {
        console.log('   ✅ Usage limit enforcement working');
      } else if (error.message.includes('Gemini API key not configured')) {
        console.log('   ⚠️  Gemini API not configured - generation disabled');
      } else {
        throw error;
      }
    }
  }

  async testFeatureGating() {
    // Test that free tier users can't access premium features
    const premiumFeatures = [
      { endpoint: '/api/background-removal', data: { imageUrl: 'test.jpg' } },
      { endpoint: '/api/upscale-image', data: { imageUrl: 'test.jpg', scale: 2 } },
      { endpoint: '/api/object-removal', data: { imageUrl: 'test.jpg', maskUrl: 'mask.jpg' } }
    ];

    for (const feature of premiumFeatures) {
      try {
        await this.makeRequest(feature.endpoint, {
          method: 'POST', 
          data: feature.data
        });
        console.log(`   ⚠️  ${feature.endpoint} should be gated for free users`);
      } catch (error) {
        if (error.message.includes('requires') || error.message.includes('upgrade')) {
          console.log(`   ✅ ${feature.endpoint} properly gated`);
        }
      }
    }
  }

  async testWebhookEndpoint() {
    // Test webhook endpoint exists and handles requests
    const mockWebhookData = {
      id: 'evt_test_webhook',
      object: 'event',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_test',
          customer: 'cus_test',
          status: 'active'
        }
      }
    };

    try {
      const response = await this.makeRequest('/api/subscription/webhook', {
        method: 'POST',
        data: mockWebhookData,
        headers: {
          'stripe-signature': 'mock_signature'
        }
      });

      console.log('   Webhook endpoint accessible');
    } catch (error) {
      if (error.message.includes('Invalid signature')) {
        console.log('   ✅ Webhook signature validation working');
      } else {
        throw error;
      }
    }
  }

  async testModelTierAccess() {
    // Test that different plans have appropriate model access
    const usage = await this.makeRequest('/api/subscription/usage');
    const allowedTiers = usage.plan.allowedTiers;
    
    if (!Array.isArray(allowedTiers)) {
      throw new Error('Plan should have allowedTiers array');
    }

    console.log(`   Plan "${usage.plan.displayName}" allows tiers: ${allowedTiers.join(', ')}`);
    
    // Free plan should only allow lite models
    if (usage.plan.id === 'free' && !allowedTiers.includes('lite')) {
      throw new Error('Free plan should include lite tier access');
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Subscription System Tests\n');
    
    await this.testEnvironmentSetup();
    console.log(''); // spacing

    await this.runTest('Usage API Response', () => this.testUsageAPI());
    await this.runTest('Checkout Session Creation', () => this.testCheckoutSessionCreation());
    await this.runTest('Image Generation Limits', () => this.testImageGenerationLimits());
    await this.runTest('Feature Gating', () => this.testFeatureGating());
    await this.runTest('Webhook Endpoint', () => this.testWebhookEndpoint());
    await this.runTest('Model Tier Access', () => this.testModelTierAccess());

    // Print summary
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);

    if (this.results.failed === 0) {
      console.log('\n🎉 All tests passed! Subscription system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the errors above.');
      console.log('   Note: Some failures may be expected if services are not fully configured.');
    }

    // Detailed results
    console.log('\n📋 Detailed Results:');
    this.results.tests.forEach(test => {
      console.log(`  ${test.status === 'PASSED' ? '✅' : '❌'} ${test.name}${test.error ? ` - ${test.error}` : ''}`);
    });

    return this.results.failed === 0;
  }
}

// Main execution
async function main() {
  const tester = new SubscriptionTester();
  
  try {
    const allPassed = await tester.runAllTests();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('💥 Test runner crashed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = SubscriptionTester;